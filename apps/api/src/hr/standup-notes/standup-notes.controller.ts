import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StandupNotesService } from './standup-notes.service';

@Controller('hr/standup-notes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.Manager)
export class StandupNotesController {
  constructor(private readonly standupNotes: StandupNotesService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query('date') date?: string) {
    return this.standupNotes.findAll(user, date);
  }

  @Get('project/:projectId')
  findByProject(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.standupNotes.findByProject(user, projectId, dateFrom, dateTo);
  }

  @Put(':subjectUserId')
  save(
    @CurrentUser() user: any,
    @Param('subjectUserId') subjectUserId: string,
    @Body() body: { standup_date: string; content: string; project_id: string },
  ) {
    return this.standupNotes.save(user, subjectUserId, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.standupNotes.remove(user, id);
  }
}
