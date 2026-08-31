import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { CommercialAccessGuard } from '../common/guards/commercial-access.guard';

@Module({
  providers: [ClientsService, CommercialAccessGuard],
  controllers: [ClientsController],
  exports: [ClientsService],
})
export class ClientsModule {}
