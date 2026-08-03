import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

@Controller('projects/:projectId/issues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssuesController {
  constructor(private issuesService: IssuesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @CurrentUser() user: any, @Query('sprintId') sprintId?: string) {
    return this.issuesService.findAll(projectId, sprintId, user.id, user.role);
  }

  @Get('backlog')
  backlog(@Param('projectId') projectId: string, @CurrentUser() user: any) {
    return this.issuesService.backlog(projectId, user.id, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.issuesService.findById(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  create(@Param('projectId') projectId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.issuesService.create(projectId, user.id, body);
  }

  @Post('bulk')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  bulkCreate(@Param('projectId') projectId: string, @CurrentUser() user: any, @Body() body: { issues: any[] }) {
    return this.issuesService.bulkCreate(projectId, user.id, body.issues ?? []);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  update(@Param('id') id: string, @Body() body: any) {
    return this.issuesService.update(id, body);
  }

  @Patch(':id/move')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  move(@Param('id') id: string, @Body() body: { status: string; position: number }) {
    return this.issuesService.moveStatus(id, body.status, body.position);
  }

  @Post(':id/comments')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  comment(@Param('id') id: string, @CurrentUser() user: any, @Body() body: { body: string }) {
    return this.issuesService.addComment(id, user.id, body.body);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  remove(@Param('id') id: string) {
    return this.issuesService.remove(id);
  }
}
