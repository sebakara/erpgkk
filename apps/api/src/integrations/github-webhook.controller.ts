import { Controller, Post, Req, RawBodyRequest, Headers, HttpCode, Logger, BadRequestException, Inject } from '@nestjs/common';
import { Request } from 'express';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { GitHubAppClient } from './github-app.client';
import { GitHubService } from './github.service';
import { GitHubSyncService } from './github-sync.service';
import { verifyGitHubSignature } from './github-webhooks/verify';
import { claimDelivery, markDelivery, processGitHubEvent } from './github-webhooks/process';
import { asGhId } from './github-mappers';

@Controller('integrations/github')
export class GitHubWebhookController {
  private readonly logger = new Logger(GitHubWebhookController.name);

  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly client: GitHubAppClient,
    private readonly github: GitHubService,
    private readonly sync: GitHubSyncService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody || !verifyGitHubSignature(rawBody, signature, this.client.webhookSecret())) {
      this.logger.warn('GitHub webhook signature verification failed');
      throw new BadRequestException('Invalid GitHub signature');
    }
    if (!event || !deliveryId) {
      throw new BadRequestException('Missing GitHub webhook headers');
    }

    const payload = req.body ?? {};
    const claimed = await claimDelivery(
      this.knex,
      deliveryId,
      event,
      payload.action,
      asGhId(payload.installation?.id),
      asGhId(payload.repository?.id),
    );
    if (claimed === 'duplicate') {
      return { ok: true, duplicate: true };
    }

    this.processLater(deliveryId, event, payload);
    return { ok: true };
  }

  private processLater(deliveryId: string, event: string, payload: any) {
    processGitHubEvent(event, payload, this.github, this.sync)
      .then(() => markDelivery(this.knex, deliveryId, 'processed'))
      .catch(async (err) => {
        this.logger.error(`GitHub webhook ${event} failed`, err);
        await markDelivery(this.knex, deliveryId, 'failed', (err as Error).message);
      });
  }
}
