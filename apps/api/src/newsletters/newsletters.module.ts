import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NewslettersService } from './newsletters.service';
import { NewslettersController } from './newsletters.controller';
import { MailService } from '../common/services/mail.service';
import { CommercialAccessGuard } from '../common/guards/commercial-access.guard';

@Module({
  imports: [ConfigModule],
  providers: [NewslettersService, MailService, CommercialAccessGuard],
  controllers: [NewslettersController],
})
export class NewslettersModule {}
