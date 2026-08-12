import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { NewslettersService } from './newsletters.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

@Controller('newsletters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NewslettersController {
  constructor(private newslettersService: NewslettersService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.newslettersService.findAll(user.company_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.newslettersService.findById(id, user.company_id);
  }

  @Post()
  @Roles(Role.Admin, Role.Manager)
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.newslettersService.create(user.company_id, user.id, body);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.newslettersService.update(id, user.company_id, body);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Manager)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.newslettersService.remove(id, user.company_id);
  }

  @Post(':id/send')
  @Roles(Role.Admin, Role.Manager)
  send(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { recipients: Array<{ email: string; name?: string }> },
  ) {
    return this.newslettersService.send(id, user.company_id, body.recipients);
  }

  @Get(':id/sends')
  getSends(@Param('id') id: string) {
    return this.newslettersService.getSends(id);
  }
}
