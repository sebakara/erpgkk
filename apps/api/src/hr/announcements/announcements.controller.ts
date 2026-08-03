import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@Controller('hr/announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.announcementsService.findAll(user.company_id);
  }

  @Post()
  @Roles(Role.Admin, Role.Manager, Role.Hr)
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.announcementsService.create(user.company_id, user.id, body);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager, Role.Hr)
  update(@Param('id') id: string, @Body() body: any) {
    return this.announcementsService.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.announcementsService.remove(id, user.company_id);
  }
}
