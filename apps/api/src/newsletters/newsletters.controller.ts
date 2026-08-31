import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { NewslettersService } from './newsletters.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CommercialAccessGuard } from '../common/guards/commercial-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('newsletters')
@UseGuards(JwtAuthGuard, CommercialAccessGuard)
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
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.newslettersService.create(user.company_id, user.id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.newslettersService.update(id, user.company_id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.newslettersService.remove(id, user.company_id);
  }

  @Post(':id/send')
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
