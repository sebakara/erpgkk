import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CommercialAccessGuard } from '../common/guards/commercial-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('clients')
@UseGuards(JwtAuthGuard, CommercialAccessGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.clientsService.findAll(user.company_id, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.findById(id, user.company_id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.clientsService.create(user.company_id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.clientsService.update(id, user.company_id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.remove(id, user.company_id);
  }

  @Post(':id/projects/:projectId')
  linkProject(@Param('id') id: string, @Param('projectId') projectId: string) {
    return this.clientsService.linkProject(id, projectId);
  }

  @Delete(':id/projects/:projectId')
  unlinkProject(@Param('id') id: string, @Param('projectId') projectId: string) {
    return this.clientsService.unlinkProject(id, projectId);
  }
}
