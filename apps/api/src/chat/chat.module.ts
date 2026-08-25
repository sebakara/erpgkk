import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { HrModule } from '../hr/hr.module';
import { IssuesModule } from '../issues/issues.module';

@Module({
  imports: [NotificationsModule, HrModule, IssuesModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
