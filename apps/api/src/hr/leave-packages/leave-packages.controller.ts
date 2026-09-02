import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { LeavePackagesService } from './leave-packages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@Controller('hr/leave-packages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeavePackagesController {
  constructor(private svc: LeavePackagesService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.svc.findAll(user.company_id);
  }

  @Get('balance')
  myBalance(@CurrentUser() user: any) {
    return this.svc.getBalance(user.id);
  }

  @Get('balance/:userId')
  @Roles(Role.Admin, Role.Manager, Role.Hr)
  balance(@Param('userId') userId: string) {
    return this.svc.getBalance(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @Roles(Role.Hr)
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.svc.create(user.company_id, user.id, body);
  }

  @Patch(':id')
  @Roles(Role.Hr)
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/allocate')
  @Roles(Role.Hr)
  allocate(@Param('id') id: string, @CurrentUser() user: any, @Body() body: { userIds: string[] | 'all' }) {
    return this.svc.allocate(id, user.company_id, body.userIds);
  }

  @Delete(':id/allocate/:userId')
  @Roles(Role.Hr)
  removeAllocation(@Param('id') id: string, @Param('userId') userId: string) {
    return this.svc.removeAllocation(id, userId);
  }
}
