import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.projectsService.findAll(user.company_id, user.id, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.findById(id, user.company_id);
  }

  @Post()
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.projectsService.create(user.company_id, user.id, body);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  update(@Param('id') id: string, @Body() body: any) {
    return this.projectsService.update(id, body);
  }

  @Post(':id/members')
  @Roles(Role.Admin, Role.Manager)
  addMember(@Param('id') id: string, @Body() body: { userId: string; role?: string }) {
    return this.projectsService.addMember(id, body.userId, body.role);
  }

  @Delete(':id/members/:userId')
  @Roles(Role.Admin, Role.Manager)
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.projectsService.removeMember(id, userId);
  }

  @Get(':id/contributors')
  contributors(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.contributors(id, user.company_id);
  }

  @Get(':id/analytics')
  analytics(@Param('id') id: string) {
    return this.projectsService.analytics(id);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.remove(id, user.company_id);
  }
}
