import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { GitHubService } from './github.service';

@Controller('integrations/github')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GitHubController {
  constructor(private readonly github: GitHubService) {}

  @Get()
  @Roles(Role.Admin)
  status(@CurrentUser() user: any) {
    return this.github.status(user.company_id);
  }

  @Post('install')
  @Roles(Role.Admin)
  install(@CurrentUser() user: any, @Body() body: { installation_id: string | number }) {
    return this.github.completeInstall(user.company_id, user.id, body.installation_id);
  }

  @Post('sync')
  @Roles(Role.Admin)
  sync(@CurrentUser() user: any) {
    return this.github.syncAll(user.company_id, user.id);
  }

  @Patch()
  @Roles(Role.Admin)
  update(@CurrentUser() user: any, @Body() body: { notify_project_chat?: boolean }) {
    return this.github.updateInstallation(user.company_id, user.id, body);
  }

  @Delete()
  @Roles(Role.Admin)
  disconnect(@CurrentUser() user: any) {
    return this.github.disconnect(user.company_id, user.id);
  }

  @Get('repos')
  @Roles(Role.Admin)
  repos(@CurrentUser() user: any) {
    return this.github.listCompanyRepos(user.company_id);
  }

  @Get('people')
  @Roles(Role.Admin)
  people(@CurrentUser() user: any) {
    return this.github.listPeople(user.company_id);
  }

  @Get('me')
  me(@CurrentUser() user: any) {
    return this.github.getUserAccount(user.id);
  }

  @Post('me')
  mapMe(@CurrentUser() user: any, @Body() body: { github_username: string }) {
    return this.github.mapUser(user, user.id, body.github_username);
  }

  @Delete('me')
  unmapMe(@CurrentUser() user: any) {
    return this.github.unmapUser(user, user.id);
  }

  @Post('users/:userId')
  @Roles(Role.Admin)
  mapUser(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
    @Body() body: { github_username: string },
  ) {
    return this.github.mapUser(user, userId, body.github_username);
  }

  @Delete('users/:userId')
  @Roles(Role.Admin)
  unmapUser(@CurrentUser() user: any, @Param('userId') userId: string) {
    return this.github.unmapUser(user, userId);
  }
}
