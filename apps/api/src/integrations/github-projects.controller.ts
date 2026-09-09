import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { GitHubService } from './github.service';

@Controller('projects/:id/github')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GitHubProjectsController {
  constructor(private readonly github: GitHubService) {}

  @Get('overview')
  overview(@Param('id') id: string, @CurrentUser() user: any) {
    return this.github.projectOverview(id, user);
  }

  @Get('repos')
  repos(@Param('id') id: string, @CurrentUser() user: any) {
    return this.github.listProjectRepos(id, user);
  }

  @Get('available-repos')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  available(@Param('id') id: string, @CurrentUser() user: any) {
    return this.github.listAvailableRepos(id, user);
  }

  @Post('repos')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  attach(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { repository_id: string; notify_chat?: boolean },
  ) {
    return this.github.attachRepo(id, user, body.repository_id, body.notify_chat);
  }

  @Patch('repos/:repoId')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  updateRepo(
    @Param('id') id: string,
    @Param('repoId') repoId: string,
    @CurrentUser() user: any,
    @Body() body: { notify_chat?: boolean },
  ) {
    return this.github.updateProjectRepo(id, user, repoId, body);
  }

  @Delete('repos/:repoId')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  detach(@Param('id') id: string, @Param('repoId') repoId: string, @CurrentUser() user: any) {
    return this.github.detachRepo(id, user, repoId);
  }

  @Post('sync')
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  sync(@Param('id') id: string, @CurrentUser() user: any) {
    return this.github.syncProject(id, user);
  }

  @Get('pull-requests')
  pullRequests(@Param('id') id: string, @CurrentUser() user: any, @Query('state') state?: string) {
    return this.github.listPullRequests(id, user, { state });
  }

  @Get('commits')
  commits(@Param('id') id: string, @CurrentUser() user: any) {
    return this.github.listCommits(id, user);
  }

  @Get('releases')
  releases(@Param('id') id: string, @CurrentUser() user: any) {
    return this.github.listReleases(id, user);
  }

  @Get('issues')
  issues(@Param('id') id: string, @CurrentUser() user: any, @Query('state') state?: string) {
    return this.github.listIssues(id, user, { state });
  }

  @Get('contributors')
  contributors(@Param('id') id: string, @CurrentUser() user: any) {
    return this.github.listContributors(id, user);
  }
}
