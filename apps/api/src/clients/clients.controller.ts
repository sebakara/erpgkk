import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(Role.Admin, Role.Manager)
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.clientsService.create(user.company_id, body);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.clientsService.update(id, user.company_id, body);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Manager)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clientsService.remove(id, user.company_id);
  }

  @Post(':id/projects/:projectId')
  @Roles(Role.Admin, Role.Manager)
  linkProject(@Param('id') id: string, @Param('projectId') projectId: string) {
    return this.clientsService.linkProject(id, projectId);
  }

  @Delete(':id/projects/:projectId')
  @Roles(Role.Admin, Role.Manager)
  unlinkProject(@Param('id') id: string, @Param('projectId') projectId: string) {
    return this.clientsService.unlinkProject(id, projectId);
  }
}
