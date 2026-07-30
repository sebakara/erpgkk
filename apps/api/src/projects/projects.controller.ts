import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard)
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
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.projectsService.create(user.company_id, user.id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.projectsService.update(id, body);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: { userId: string; role?: string }) {
    return this.projectsService.addMember(id, body.userId, body.role);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.projectsService.removeMember(id, userId);
  }

  @Get(':id/analytics')
  analytics(@Param('id') id: string) {
    return this.projectsService.analytics(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.remove(id, user.company_id);
  }
}
