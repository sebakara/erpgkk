import { Module } from '@nestjs/common';
import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';
import { GitHubController } from './github.controller';
import { GitHubWebhookController } from './github-webhook.controller';
import { GitHubProjectsController } from './github-projects.controller';
import { GitHubAppClient } from './github-app.client';
import { GitHubService } from './github.service';
import { GitHubSyncService } from './github-sync.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [NotificationsModule, ChatModule],
  controllers: [SlackController, GitHubController, GitHubWebhookController, GitHubProjectsController],
  providers: [SlackService, GitHubAppClient, GitHubService, GitHubSyncService],
})
export class IntegrationsModule {}
