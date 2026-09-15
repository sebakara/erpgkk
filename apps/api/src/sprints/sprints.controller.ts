import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects/:projectId/sprints')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SprintsController {
  constructor(private sprintsService: SprintsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.sprintsService.findAll(projectId);
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.sprintsService.stats(id);
  }

  @Post(':id/start')
  @Roles(Role.Admin, Role.Manager, Role.ProjectManager)
  start(@Param('projectId') projectId: string, @Param('id') id: string, @CurrentUser() user: any) {
    return this.sprintsService.start(projectId, id, user.id);
  }

  @Post(':id/complete')
  @Roles(Role.Admin, Role.Manager, Role.ProjectManager)
  complete(@Param('projectId') projectId: string, @Param('id') id: string, @CurrentUser() user: any) {
    return this.sprintsService.complete(projectId, id, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sprintsService.findById(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Manager, Role.ProjectManager)
  create(@Param('projectId') projectId: string, @Body() body: any) {
    return this.sprintsService.create(projectId, body);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager, Role.ProjectManager)
  update(@Param('id') id: string, @Body() body: any) {
    return this.sprintsService.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Manager, Role.ProjectManager)
  remove(@Param('id') id: string) {
    return this.sprintsService.remove(id);
  }
}
