import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@Controller('hr/leave')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(private leaveService: LeaveService) {}

  @Get()
  @Roles(Role.Admin, Role.Manager, Role.Hr)
  findAll(@CurrentUser() user: any, @Query('userId') userId?: string) {
    return this.leaveService.findAll(user, userId);
  }

  @Get('mine')
  mine(@CurrentUser() user: any) {
    return this.leaveService.findAll(user, user.id);
  }

  @Get('summary')
  @Roles(Role.Admin, Role.Manager, Role.Hr)
  summary(@CurrentUser() user: any) {
    return this.leaveService.summary(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leaveService.findById(id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.leaveService.create(user.company_id, user.id, body);
  }

  @Patch(':id/approve')
  @Roles(Role.Admin, Role.Manager, Role.Hr)
  approve(@Param('id') id: string, @CurrentUser() user: any, @Body() body: { note?: string }) {
    return this.leaveService.approve(id, user, body.note);
  }

  @Patch(':id/reject')
  @Roles(Role.Admin, Role.Manager, Role.Hr)
  reject(@Param('id') id: string, @CurrentUser() user: any, @Body() body: { note?: string }) {
    return this.leaveService.reject(id, user, body.note);
  }
}
