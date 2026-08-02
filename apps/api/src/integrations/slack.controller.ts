import { Controller, Post, Req, RawBodyRequest, Headers, HttpCode, Logger, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { SlackService } from './slack.service';

@Controller('integrations/slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(private readonly slackService: SlackService) {}

  @Post('events')
  @HttpCode(200)
  async handleEvent(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-slack-signature') signature: string,
    @Headers('x-slack-request-timestamp') timestamp: string,
  ) {
    const rawBody = req.rawBody;
    const body = req.body;

    // Verify the request came from Slack
    if (!rawBody || !signature || !timestamp || !this.slackService.verifySignature(rawBody, timestamp, signature)) {
      this.logger.warn('Slack signature verification failed');
      throw new BadRequestException('Invalid Slack signature');
    }

    // Slack sends a one-time challenge when you first save the Events URL
    if (body.type === 'url_verification') {
      return { challenge: body.challenge };
    }

    if (body.type === 'event_callback') {
      const event = body.event;
      this.logger.log(`Slack event received: ${event?.type}`);

      if (event?.type === 'team_join') {
        // Handle asynchronously so Slack gets a 200 immediately
        this.slackService.handleTeamJoin(event.user).catch((err) =>
          this.logger.error('team_join handler error', err),
        );
      }
    }

    return { ok: true };
  }
}
