import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import * as crypto from 'crypto';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Verify the request actually came from Slack using HMAC-SHA256
  verifySignature(rawBody: Buffer, timestamp: string, signature: string): boolean {
    const signingSecret = this.config.get<string>('SLACK_SIGNING_SECRET', '');
    if (!signingSecret) return false;

    // Reject requests older than 5 minutes to prevent replay attacks
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

    const baseString = `v0:${timestamp}:${rawBody.toString()}`;
    const expected = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  async handleTeamJoin(slackUser: any) {
    const email: string = slackUser.profile?.email;
    if (!email) {
      this.logger.warn('team_join event received but user has no email');
      return;
    }

    // Find the ERP user with this email
    const user = await this.knex('users').where({ email }).first();
    if (!user) {
      this.logger.log(`Slack team_join: no ERP user found for email ${email}`);
      return;
    }

    const fullName = `${user.first_name} ${user.last_name}`;

    // Notify the employee themselves
    await this.notificationsGateway.notifyUser(user.id, {
      type: 'slack_joined',
      title: 'You joined the Slack workspace',
      body: 'Your GKK ERP account is now linked. Welcome aboard!',
      data: { slack_user_id: slackUser.id },
    });

    // Notify all admins and managers
    const admins = await this.knex('users')
      .where({ company_id: user.company_id })
      .whereIn('role', ['admin', 'manager'])
      .select('id');

    for (const admin of admins) {
      if (admin.id === user.id) continue;
      await this.notificationsService.create(admin.id, {
        type: 'slack_employee_joined',
        title: 'New employee joined Slack',
        body: `${fullName} (${email}) has joined the Slack workspace`,
        data: { user_id: user.id, slack_user_id: slackUser.id },
      });
    }

    this.logger.log(`Slack team_join handled for ${fullName} (${email})`);
  }
}
