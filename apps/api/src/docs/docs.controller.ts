import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { DocsService } from './docs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

@Controller('projects/:projectId/docs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocsController {
  constructor(private docsService: DocsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.docsService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.docsService.findById(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  create(@Param('projectId') projectId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.docsService.create(projectId, user.id, body);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  update(@Param('id') id: string, @Body() body: any) {
    return this.docsService.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  remove(@Param('id') id: string) {
    return this.docsService.remove(id);
  }
}
