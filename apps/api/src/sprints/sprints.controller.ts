import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects/:projectId/sprints')
@UseGuards(JwtAuthGuard)
export class SprintsController {
  constructor(private sprintsService: SprintsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.sprintsService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sprintsService.findById(id);
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.sprintsService.stats(id);
  }

  @Post()
  create(@Param('projectId') projectId: string, @Body() body: any) {
    return this.sprintsService.create(projectId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.sprintsService.update(id, body, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sprintsService.remove(id);
  }
}
