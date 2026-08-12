import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NewslettersService } from './newsletters.service';
import { NewslettersController } from './newsletters.controller';
import { MailService } from '../common/services/mail.service';

@Module({
  imports: [ConfigModule],
  providers: [NewslettersService, MailService],
  controllers: [NewslettersController],
})
export class NewslettersModule {}
