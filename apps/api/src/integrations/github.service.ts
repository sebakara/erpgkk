import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ChatService } from '../chat/chat.service';
import { canManageAllProjects } from '../common/access/engineering';
import { NotificationEventType, Role } from '../common/enums';
import { GitHubAppClient } from './github-app.client';
import { GitHubSyncService } from './github-sync.service';
import { asGhId, mapRepository } from './github-mappers';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly client: GitHubAppClient,
    private readonly sync: GitHubSyncService,
    @Optional() private readonly notifications?: NotificationsGateway,
    @Optional() private readonly chat?: ChatService,
  ) {}

  async status(companyId: string) {
    const rows = await this.installationsForCompany(companyId);
    const ids = rows.map((row) => row.id);
    const [repoCount, mappedRepoCount, mappedUserCount, perInstall] = ids.length
      ? await Promise.all([
          this.knex('github_repositories').whereIn('installation_id', ids).count('* as c').first(),
          this.knex('project_github_repositories as pgr')
            .join('github_repositories as r', 'pgr.github_repository_id', 'r.id')
            .whereIn('r.installation_id', ids)
            .countDistinct('pgr.id as c')
            .first(),
          this.knex('user_github_accounts as a')
            .join('users as u', 'a.user_id', 'u.id')
            .where('u.company_id', companyId)
            .count('* as c')
            .first(),
          this.knex('github_repositories')
            .whereIn('installation_id', ids)
            .groupBy('installation_id')
            .select('installation_id')
            .count('* as c'),
        ])
      : [{ c: 0 }, { c: 0 }, { c: 0 }, [] as Array<{ installation_id: string; c: any }>];

    const repoByInstall = new Map(
      (perInstall as Array<{ installation_id: string; c: any }>).map((row) => [
        String(row.installation_id),
        Number(row.c ?? 0),
      ]),
    );
    const installations = rows.map((row) => ({
      ...this.serializeInstallation(row),
      repo_count: repoByInstall.get(String(row.id)) ?? 0,
    }));
    const installation = installations[0] ?? null;

    return {
      configured: this.client.isConfigured(),
      missing_env: this.client.missingEnv(),
      connected: installations.some((row) => row.status === 'active'),
      install_url: this.client.isConfigured() ? this.client.installUrl(companyId) : null,
      installation,
      installations,
      repo_count: Number(repoCount?.c ?? 0),
      mapped_repo_count: Number(mappedRepoCount?.c ?? 0),
      mapped_user_count: Number(mappedUserCount?.c ?? 0),
    };
  }

  async completeInstall(companyId: string, actorId: string, installationId: string | number) {
    if (!installationId) throw new BadRequestException('installation_id is required');
    let ghInstall: any;
    try {
      ghInstall = await this.sync.fetchInstallation(installationId);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      this.logger.error(`GitHub installation lookup failed (${status ?? 'unknown'}): ${err?.message}`);
      if (status === 401) {
        throw new ServiceUnavailableException(
          'GitHub rejected the App credentials. Check GITHUB_APP_ID and GITHUB_PRIVATE_KEY, then restart the API.',
        );
      }
      if (status === 404) {
        throw new NotFoundException('That GitHub installation was not found for this App.');
      }
      throw new ServiceUnavailableException(err?.message || 'Failed to talk to GitHub');
    }
    const account = ghInstall.account as any;
    const githubInstallationId = asGhId(ghInstall.id);
    const githubAccountId = asGhId(account?.id);
    if (!githubInstallationId || !githubAccountId) {
      throw new BadRequestException('GitHub installation is missing account data');
    }

    const taken = await this.knex('github_installations')
      .where('github_installation_id', githubInstallationId)
      .whereNot('company_id', companyId)
      .first();
    if (taken) throw new ConflictException('This GitHub installation is already linked to another company');

    const now = new Date();
    const payload = {
      github_installation_id: githubInstallationId,
      github_account_id: githubAccountId,
      github_account_login: account?.login ?? 'unknown',
      account_type: account?.type ?? 'Organization',
      repository_selection: ghInstall.repository_selection ?? 'selected',
      status: 'active',
      installed_at: ghInstall.created_at ? new Date(ghInstall.created_at) : now,
      updated_at: now,
    };

    let row =
      (await this.knex('github_installations')
        .where({ company_id: companyId, github_installation_id: githubInstallationId })
        .first()) ||
      (await this.knex('github_installations')
        .where({ company_id: companyId, github_account_id: githubAccountId })
        .first());

    if (row) {
      await this.knex('github_installations').where('id', row.id).update(payload);
    } else {
      const id = uuid();
      await this.knex('github_installations').insert({
        id,
        company_id: companyId,
        ...payload,
        notify_project_chat: false,
        created_at: now,
      });
      row = { id, company_id: companyId, ...payload };
    }

    row = await this.knex('github_installations')
      .where({ company_id: companyId, github_installation_id: githubInstallationId })
      .first();
    await this.sync.syncInstallationRepositories(row);
    await this.audit(companyId, actorId, 'github.install', 'github_installation', row.id, {
      github_installation_id: githubInstallationId,
      account: account?.login,
    });

    const admins = await this.knex('users').where({ company_id: companyId, role: Role.Admin, is_active: true }).select('id');
    await this.notifications?.notifyUsers(
      admins.map((u) => u.id),
      {
        type: NotificationEventType.GitHubInstallationConnected,
        title: 'GitHub connected',
        body: `${account?.login ?? 'GitHub'} is now linked to CompanyOS.`,
        data: { href: '/settings?section=integrations' },
      },
    );

    return this.status(companyId);
  }

  async disconnect(companyId: string, actorId: string, installationRowId?: string) {
    const installation = installationRowId
      ? await this.requireCompanyInstallation(companyId, installationRowId)
      : await this.requireInstallation(companyId);
    await this.knex('github_installations').where('id', installation.id).delete();
    this.client.clearToken(installation.github_installation_id);
    await this.audit(companyId, actorId, 'github.disconnect', 'github_installation', installation.id, {
      github_account_login: installation.github_account_login,
    });
    return { ok: true };
  }

  async updateInstallation(
    companyId: string,
    actorId: string,
    data: { installation_id?: string; notify_project_chat?: boolean },
  ) {
    const installation = data.installation_id
      ? await this.requireCompanyInstallation(companyId, data.installation_id)
      : await this.requireInstallation(companyId);
    const patch: any = { updated_at: new Date() };
    if (typeof data.notify_project_chat === 'boolean') patch.notify_project_chat = data.notify_project_chat;
    await this.knex('github_installations').where('id', installation.id).update(patch);
    await this.audit(companyId, actorId, 'github.update', 'github_installation', installation.id, data);
    return this.status(companyId);
  }

  async syncAll(companyId: string, actorId: string) {
    const installations = await this.installationsForCompany(companyId);
    if (!installations.length) throw new NotFoundException('GitHub is not connected');
    const errors: string[] = [];
    let listedCount = 0;
    let repoCount = 0;
    for (const installation of installations) {
      const listed = await this.sync.syncInstallationRepositories(installation);
      listedCount += listed.repo_count;
      const repos = await this.knex('github_repositories').where('installation_id', installation.id);
      repoCount += repos.length;
      for (const repo of repos) {
        try {
          await this.sync.syncRepoActivity(repo);
        } catch (err) {
          const message = `${repo.full_name}: ${(err as Error).message}`;
          errors.push(message);
          this.logger.warn(message);
        }
      }
      await this.knex('github_installations').where('id', installation.id).update({
        last_synced_at: new Date(),
        updated_at: new Date(),
      });
    }
    await this.audit(companyId, actorId, 'github.sync', 'github_installation', installations[0].id, {
      orgs: installations.length,
      repos: repoCount,
      errors,
    });
    return { ...await this.status(companyId), errors, listed_repo_count: listedCount };
  }

  async workspaceDashboard(user: any) {
    const companyId = user.company_id;
    const installations = await this.installationsForCompany(companyId);
    const projects = await this.visibleProjectsForUser(user);
    const projectIds = projects.map((p) => p.id);
    const mappings = projectIds.length
      ? await this.knex('project_github_repositories as pgr')
          .join('github_repositories as r', 'pgr.github_repository_id', 'r.id')
          .whereIn('pgr.project_id', projectIds)
          .select('pgr.project_id', 'r.id as repo_id', 'r.full_name')
      : [];
    const repoIds = [...new Set(mappings.map((m) => m.repo_id))];
    const mappedProjectIds = new Set(mappings.map((m) => m.project_id));
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const empty = { c: 0 };

    const [openPrs, mergedPrs, recentPrs, recentCommits] = repoIds.length
      ? await Promise.all([
          this.knex('github_pull_requests').whereIn('github_repository_id', repoIds).andWhere('state', 'open').count('* as c').first(),
          this.knex('github_pull_requests').whereIn('github_repository_id', repoIds).where('merged', true).where('merged_at', '>=', since30).count('* as c').first(),
          this.knex('github_pull_requests as pr')
            .join('github_repositories as r', 'pr.github_repository_id', 'r.id')
            .whereIn('pr.github_repository_id', repoIds)
            .orderBy('pr.github_updated_at', 'desc')
            .select('pr.id', 'pr.number', 'pr.title', 'pr.state', 'pr.merged', 'pr.html_url', 'pr.author_login', 'pr.github_updated_at', 'r.full_name as repository')
            .limit(8),
          this.knex('github_commits as c')
            .join('github_repositories as r', 'c.github_repository_id', 'r.id')
            .whereIn('c.github_repository_id', repoIds)
            .orderBy('c.committed_at', 'desc')
            .select('c.id', 'c.sha', 'c.message', 'c.html_url', 'c.author_login', 'c.author_name', 'c.committed_at', 'r.full_name as repository')
            .limit(8),
        ])
      : [empty, empty, [], []];

    const reposByProject = new Map<string, number>();
    for (const row of mappings) {
      reposByProject.set(row.project_id, (reposByProject.get(row.project_id) ?? 0) + 1);
    }

    return {
      connected: installations.some((row) => row.status === 'active'),
      organizations: installations.map((row) => ({
        id: row.id,
        login: row.github_account_login,
        account_type: row.account_type,
      })),
      mapped_project_count: mappedProjectIds.size,
      unmapped_project_count: projects.filter((p) => !mappedProjectIds.has(p.id)).length,
      mapped_repo_count: repoIds.length,
      open_prs: Number((openPrs as any)?.c ?? 0),
      merged_prs_30d: Number((mergedPrs as any)?.c ?? 0),
      recent_pull_requests: recentPrs,
      recent_commits: recentCommits,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        status: p.status,
        github_repos: reposByProject.get(p.id) ?? 0,
      })),
    };
  }

  async listCompanyRepos(companyId: string) {
    const ids = await this.installationIdsForCompany(companyId);
    if (!ids.length) throw new NotFoundException('GitHub is not connected');
    const repos = await this.knex('github_repositories as r')
      .whereIn('r.installation_id', ids)
      .orderBy('r.full_name', 'asc')
      .select('r.*');
    const links = await this.knex('project_github_repositories as pgr')
      .join('projects as p', 'pgr.project_id', 'p.id')
      .whereIn('pgr.github_repository_id', repos.map((r) => r.id))
      .select('pgr.github_repository_id', 'p.id as project_id', 'p.name as project_name');
    const byRepo = new Map<string, Array<{ id: string; name: string }>>();
    for (const link of links) {
      const list = byRepo.get(link.github_repository_id) ?? [];
      list.push({ id: link.project_id, name: link.project_name });
      byRepo.set(link.github_repository_id, list);
    }
    return repos.map((repo) => ({ ...this.serializeRepo(repo), projects: byRepo.get(repo.id) ?? [] }));
  }

  async listPeople(companyId: string) {
    const users = await this.knex('users as u')
      .leftJoin('user_github_accounts as a', 'a.user_id', 'u.id')
      .where('u.company_id', companyId)
      .andWhere('u.is_active', true)
      .select(
        'u.id', 'u.first_name', 'u.last_name', 'u.email', 'u.job_title', 'u.avatar_url', 'u.role',
        'a.github_user_id', 'a.github_username', 'a.avatar_url as github_avatar_url', 'a.connected_at',
      )
      .orderBy('u.first_name', 'asc');
    return users.map((u) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      job_title: u.job_title,
      avatar_url: u.avatar_url,
      role: u.role,
      github: u.github_username
        ? {
            github_user_id: String(u.github_user_id),
            github_username: u.github_username,
            avatar_url: u.github_avatar_url,
            connected_at: u.connected_at,
          }
        : null,
    }));
  }

  async getUserAccount(userId: string) {
    const row = await this.knex('user_github_accounts').where('user_id', userId).first();
    if (!row) return null;
    return {
      github_user_id: String(row.github_user_id),
      github_username: row.github_username,
      avatar_url: row.avatar_url,
      connected_at: row.connected_at,
    };
  }

  async mapUser(actor: any, targetUserId: string, githubUsername: string) {
    const username = (githubUsername ?? '').trim().replace(/^@/, '');
    if (!username) throw new BadRequestException('github_username is required');
    const target = await this.knex('users').where({ id: targetUserId, company_id: actor.company_id }).first();
    if (!target) throw new NotFoundException('User not found');
    this.assertCanMapUser(actor, target);

    let ghUser: any;
    try {
      ghUser = await this.sync.fetchUserByUsername(username);
    } catch {
      throw new NotFoundException(`GitHub user @${username} was not found`);
    }
    const githubUserId = asGhId(ghUser.id);
    if (!githubUserId) throw new BadRequestException('GitHub user is missing an id');

    const taken = await this.knex('user_github_accounts').where('github_user_id', githubUserId).whereNot('user_id', targetUserId).first();
    if (taken) throw new ConflictException('That GitHub account is already linked to someone else');

    const existing = await this.knex('user_github_accounts').where('user_id', targetUserId).first();
    const now = new Date();
    const row = {
      github_user_id: githubUserId,
      github_username: ghUser.login,
      avatar_url: ghUser.avatar_url ?? null,
      last_synced_at: now,
      updated_at: now,
    };
    if (existing) {
      await this.knex('user_github_accounts').where('id', existing.id).update(row);
    } else {
      await this.knex('user_github_accounts').insert({
        id: uuid(),
        user_id: targetUserId,
        ...row,
        connected_at: now,
        created_at: now,
      });
    }
    await this.audit(actor.company_id, actor.id, 'github.map_user', 'user', targetUserId, {
      github_username: ghUser.login,
      github_user_id: githubUserId,
    });
    return this.getUserAccount(targetUserId);
  }

  async unmapUser(actor: any, targetUserId: string) {
    const target = await this.knex('users').where({ id: targetUserId, company_id: actor.company_id }).first();
    if (!target) throw new NotFoundException('User not found');
    this.assertCanMapUser(actor, target);
    await this.knex('user_github_accounts').where('user_id', targetUserId).delete();
    await this.audit(actor.company_id, actor.id, 'github.unmap_user', 'user', targetUserId);
    return { ok: true };
  }

  async attachRepo(projectId: string, user: any, repositoryId: string, notifyChat = false) {
    const project = await this.assertCanManageProject(projectId, user);
    const ids = await this.installationIdsForCompany(user.company_id);
    if (!ids.length) throw new NotFoundException('GitHub is not connected');
    const repo = await this.knex('github_repositories')
      .where({ id: repositoryId })
      .whereIn('installation_id', ids)
      .first();
    if (!repo) throw new NotFoundException('Repository is not in this GitHub installation');

    const existing = await this.knex('project_github_repositories')
      .where({ project_id: projectId, github_repository_id: repositoryId })
      .first();
    if (!existing) {
      await this.knex('project_github_repositories').insert({
        id: uuid(),
        project_id: projectId,
        github_repository_id: repositoryId,
        created_by: user.id,
        notify_chat: !!notifyChat,
      });
    }
    await this.audit(user.company_id, user.id, 'github.attach_repo', 'project', projectId, {
      repository: repo.full_name,
    });
    try {
      await this.sync.syncRepoActivity(repo);
    } catch (err) {
      this.logger.warn(`Activity sync after attach failed for ${repo.full_name}: ${(err as Error).message}`);
    }
    return this.listProjectRepos(project.id, user);
  }

  async detachRepo(projectId: string, user: any, repositoryId: string) {
    await this.assertCanManageProject(projectId, user);
    await this.knex('project_github_repositories')
      .where({ project_id: projectId, github_repository_id: repositoryId })
      .delete();
    await this.audit(user.company_id, user.id, 'github.detach_repo', 'project', projectId, {
      github_repository_id: repositoryId,
    });
    return { ok: true };
  }

  async updateProjectRepo(projectId: string, user: any, repositoryId: string, data: { notify_chat?: boolean }) {
    await this.assertCanManageProject(projectId, user);
    const patch: any = {};
    if (typeof data.notify_chat === 'boolean') patch.notify_chat = data.notify_chat;
    if (!Object.keys(patch).length) return this.listProjectRepos(projectId, user);
    await this.knex('project_github_repositories')
      .where({ project_id: projectId, github_repository_id: repositoryId })
      .update(patch);
    return this.listProjectRepos(projectId, user);
  }

  async listProjectRepos(projectId: string, user: any) {
    await this.assertCanViewProject(projectId, user);
    return this.knex('project_github_repositories as pgr')
      .join('github_repositories as r', 'pgr.github_repository_id', 'r.id')
      .where('pgr.project_id', projectId)
      .orderBy('r.full_name', 'asc')
      .select('r.*', 'pgr.notify_chat', 'pgr.created_at as attached_at', 'pgr.id as mapping_id');
  }

  async listAvailableRepos(projectId: string, user: any) {
    await this.assertCanManageProject(projectId, user);
    const ids = await this.installationIdsForCompany(user.company_id);
    if (!ids.length) throw new NotFoundException('GitHub is not connected');
    const attached = await this.knex('project_github_repositories').where('project_id', projectId).pluck('github_repository_id');
    const q = this.knex('github_repositories').whereIn('installation_id', ids).orderBy('full_name', 'asc');
    if (attached.length) q.whereNotIn('id', attached);
    return q;
  }

  async projectOverview(projectId: string, user: any) {
    await this.assertCanViewProject(projectId, user);
    const repoIds = await this.projectRepoIds(projectId);
    if (!repoIds.length) {
      return {
        repo_count: 0,
        open_prs: 0,
        merged_prs_30d: 0,
        open_issues: 0,
        latest_release: null,
        recent_pull_requests: [],
        recent_commits: [],
        recent_releases: [],
      };
    }
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [openPrs, mergedPrs, openIssues, latestRelease, recentPrs, recentCommits, recentReleases] = await Promise.all([
      this.knex('github_pull_requests').whereIn('github_repository_id', repoIds).andWhere('state', 'open').count('* as c').first(),
      this.knex('github_pull_requests').whereIn('github_repository_id', repoIds).where('merged', true).where('merged_at', '>=', since30).count('* as c').first(),
      this.knex('github_issues').whereIn('github_repository_id', repoIds).andWhere('state', 'open').count('* as c').first(),
      this.knex('github_releases as rel')
        .join('github_repositories as r', 'rel.github_repository_id', 'r.id')
        .whereIn('rel.github_repository_id', repoIds)
        .andWhere('rel.draft', false)
        .orderBy('rel.published_at', 'desc')
        .select('rel.*', 'r.full_name as repository')
        .first(),
      this.listPullRequests(projectId, user, { limit: 8 }),
      this.listCommits(projectId, user, { limit: 8 }),
      this.listReleases(projectId, user, { limit: 5 }),
    ]);
    return {
      repo_count: repoIds.length,
      open_prs: Number(openPrs?.c ?? 0),
      merged_prs_30d: Number(mergedPrs?.c ?? 0),
      open_issues: Number(openIssues?.c ?? 0),
      latest_release: latestRelease ?? null,
      recent_pull_requests: recentPrs,
      recent_commits: recentCommits,
      recent_releases: recentReleases,
    };
  }

  async listPullRequests(projectId: string, user: any, opts: { limit?: number; state?: string } = {}) {
    await this.assertCanViewProject(projectId, user);
    const repoIds = await this.projectRepoIds(projectId);
    if (!repoIds.length) return [];
    const q = this.knex('github_pull_requests as pr')
      .join('github_repositories as r', 'pr.github_repository_id', 'r.id')
      .leftJoin('user_github_accounts as a', 'a.github_user_id', 'pr.github_author_id')
      .leftJoin('users as u', 'u.id', 'a.user_id')
      .whereIn('pr.github_repository_id', repoIds)
      .orderBy('pr.github_updated_at', 'desc')
      .select(
        'pr.*',
        'r.full_name as repository',
        'r.html_url as repository_url',
        'u.id as mapped_user_id',
        'u.first_name as mapped_first_name',
        'u.last_name as mapped_last_name',
      )
      .limit(opts.limit ?? 100);
    if (opts.state) q.andWhere('pr.state', opts.state);
    return q;
  }

  async listCommits(projectId: string, user: any, opts: { limit?: number } = {}) {
    await this.assertCanViewProject(projectId, user);
    const repoIds = await this.projectRepoIds(projectId);
    if (!repoIds.length) return [];
    return this.knex('github_commits as c')
      .join('github_repositories as r', 'c.github_repository_id', 'r.id')
      .leftJoin('user_github_accounts as a', 'a.github_user_id', 'c.author_github_user_id')
      .leftJoin('users as u', 'u.id', 'a.user_id')
      .whereIn('c.github_repository_id', repoIds)
      .orderBy('c.committed_at', 'desc')
      .select(
        'c.*',
        'r.full_name as repository',
        'u.id as mapped_user_id',
        'u.first_name as mapped_first_name',
        'u.last_name as mapped_last_name',
      )
      .limit(opts.limit ?? 100);
  }

  async listReleases(projectId: string, user: any, opts: { limit?: number } = {}) {
    await this.assertCanViewProject(projectId, user);
    const repoIds = await this.projectRepoIds(projectId);
    if (!repoIds.length) return [];
    return this.knex('github_releases as rel')
      .join('github_repositories as r', 'rel.github_repository_id', 'r.id')
      .whereIn('rel.github_repository_id', repoIds)
      .orderBy('rel.published_at', 'desc')
      .select('rel.*', 'r.full_name as repository')
      .limit(opts.limit ?? 50);
  }

  async listIssues(projectId: string, user: any, opts: { limit?: number; state?: string } = {}) {
    await this.assertCanViewProject(projectId, user);
    const repoIds = await this.projectRepoIds(projectId);
    if (!repoIds.length) return [];
    const q = this.knex('github_issues as i')
      .join('github_repositories as r', 'i.github_repository_id', 'r.id')
      .whereIn('i.github_repository_id', repoIds)
      .orderBy('i.github_updated_at', 'desc')
      .select('i.*', 'r.full_name as repository')
      .limit(opts.limit ?? 100);
    if (opts.state) q.andWhere('i.state', opts.state);
    return q;
  }

  async listContributors(projectId: string, user: any) {
    await this.assertCanViewProject(projectId, user);
    const repoIds = await this.projectRepoIds(projectId);
    if (!repoIds.length) return [];
    const [prAuthors, commitAuthors, reviewers] = await Promise.all([
      this.knex('github_pull_requests')
        .whereIn('github_repository_id', repoIds)
        .whereNotNull('author_login')
        .groupBy('github_author_id', 'author_login')
        .select('github_author_id as github_user_id', 'author_login as login')
        .count('* as pr_count'),
      this.knex('github_commits')
        .whereIn('github_repository_id', repoIds)
        .whereNotNull('author_login')
        .groupBy('author_github_user_id', 'author_login')
        .select('author_github_user_id as github_user_id', 'author_login as login')
        .count('* as commit_count'),
      this.knex('github_pull_request_reviews as rv')
        .join('github_pull_requests as pr', 'rv.pull_request_id', 'pr.id')
        .whereIn('pr.github_repository_id', repoIds)
        .whereNotNull('rv.reviewer_login')
        .groupBy('rv.github_user_id', 'rv.reviewer_login')
        .select('rv.github_user_id as github_user_id', 'rv.reviewer_login as login')
        .count('* as review_count'),
    ]);

    const byLogin = new Map<string, any>();
    const bump = (login: string, githubUserId: any, field: string, count: any) => {
      if (!login) return;
      const current = byLogin.get(login) ?? { login, github_user_id: githubUserId ? String(githubUserId) : null, pr_count: 0, commit_count: 0, review_count: 0 };
      current[field] += Number(count ?? 0);
      if (githubUserId) current.github_user_id = String(githubUserId);
      byLogin.set(login, current);
    };
    for (const row of prAuthors) bump(row.login, row.github_user_id, 'pr_count', row.pr_count);
    for (const row of commitAuthors) bump(row.login, row.github_user_id, 'commit_count', row.commit_count);
    for (const row of reviewers) bump(row.login, row.github_user_id, 'review_count', row.review_count);

    const accounts = await this.knex('user_github_accounts as a')
      .join('users as u', 'u.id', 'a.user_id')
      .where('u.company_id', user.company_id)
      .select('a.github_user_id', 'a.github_username', 'a.avatar_url as github_avatar_url', 'u.id as user_id', 'u.first_name', 'u.last_name', 'u.avatar_url');
    const byGhId = new Map(accounts.map((a) => [String(a.github_user_id), a]));
    const byUsername = new Map(accounts.map((a) => [String(a.github_username).toLowerCase(), a]));

    return [...byLogin.values()]
      .map((row) => {
        const mapped = (row.github_user_id && byGhId.get(row.github_user_id)) || byUsername.get(String(row.login).toLowerCase());
        return {
          ...row,
          mapped_user: mapped
            ? {
                id: mapped.user_id,
                first_name: mapped.first_name,
                last_name: mapped.last_name,
                avatar_url: mapped.avatar_url ?? mapped.github_avatar_url,
              }
            : null,
        };
      })
      .sort((a, b) => (b.pr_count + b.commit_count + b.review_count) - (a.pr_count + a.commit_count + a.review_count));
  }

  async syncProject(projectId: string, user: any) {
    await this.assertCanManageProject(projectId, user);
    const repos = await this.knex('project_github_repositories as pgr')
      .join('github_repositories as r', 'pgr.github_repository_id', 'r.id')
      .where('pgr.project_id', projectId)
      .select('r.*');
    const errors: string[] = [];
    for (const repo of repos) {
      try {
        await this.sync.syncRepoActivity(repo);
      } catch (err) {
        errors.push(`${repo.full_name}: ${(err as Error).message}`);
      }
    }
    return { ok: true, repos: repos.length, errors };
  }

  async findMappedUser(githubUserId: string | number | null | undefined, login?: string | null) {
    if (githubUserId) {
      const byId = await this.knex('user_github_accounts').where('github_user_id', asGhId(githubUserId)).first();
      if (byId) return byId;
    }
    if (login) {
      return this.knex('user_github_accounts').whereRaw('LOWER(github_username) = ?', [login.toLowerCase()]).first();
    }
    return null;
  }

  async projectsForRepo(repoId: string) {
    return this.knex('project_github_repositories as pgr')
      .join('projects as p', 'pgr.project_id', 'p.id')
      .where('pgr.github_repository_id', repoId)
      .select('p.id', 'p.company_id', 'p.owner_id', 'p.name', 'pgr.notify_chat');
  }

  async notifyReviewRequested(repo: any, pr: any, reviewer: any) {
    const mapped = await this.findMappedUser(reviewer?.id, reviewer?.login);
    if (!mapped) return;
    const projects = await this.projectsForRepo(repo.id);
    const href = projects[0] ? `/projects/${projects[0].id}/development/pull-requests` : pr.html_url;
    await this.notifications?.notifyUser(mapped.user_id, {
      type: NotificationEventType.GitHubReviewRequested,
      title: 'GitHub review requested',
      body: `${pr.user?.login ?? 'Someone'} asked you to review ${repo.full_name}#${pr.number}: ${pr.title}`,
      data: { href, html_url: pr.html_url },
    });
  }

  async notifyPrMerged(repo: any, pr: any) {
    const author = await this.findMappedUser(pr.user?.id, pr.user?.login);
    const projects = await this.projectsForRepo(repo.id);
    const href = projects[0] ? `/projects/${projects[0].id}/development/pull-requests` : pr.html_url;
    const payload = {
      type: NotificationEventType.GitHubPrMerged,
      title: 'Pull request merged',
      body: `${repo.full_name}#${pr.number} “${pr.title}” was merged.`,
      data: { href, html_url: pr.html_url },
    };
    if (author) await this.notifications?.notifyUser(author.user_id, payload);
    await this.maybePostChat(repo, projects, `Merged PR [#${pr.number} ${pr.title}](${pr.html_url}) in ${repo.full_name}.`);
  }

  async notifyRelease(repo: any, release: any) {
    const projects = await this.projectsForRepo(repo.id);
    const href = projects[0] ? `/projects/${projects[0].id}/development/releases` : release.html_url;
    const memberIds = await this.memberIdsForProjects(projects.map((p) => p.id));
    await this.notifications?.notifyUsers(memberIds, {
      type: NotificationEventType.GitHubReleasePublished,
      title: `Release ${release.tag_name}`,
      body: `${release.name || release.tag_name} was published on ${repo.full_name}.`,
      data: { href, html_url: release.html_url },
    });
    await this.maybePostChat(repo, projects, `Released [${release.name || release.tag_name}](${release.html_url}) on ${repo.full_name}.`);
  }

  async upsertRepoFromWebhook(installationRow: any, ghRepo: any) {
    return this.sync.upsertRepository(installationRow.id, mapRepository(ghRepo));
  }

  async removeRepoByGithubId(githubRepositoryId: string | number) {
    await this.knex('github_repositories').where('github_repository_id', asGhId(githubRepositoryId)).delete();
  }

  async markInstallationStatus(githubInstallationId: string | number, status: string) {
    await this.knex('github_installations')
      .where('github_installation_id', asGhId(githubInstallationId))
      .update({ status, updated_at: new Date() });
  }

  async deleteInstallationByGithubId(githubInstallationId: string | number) {
    const row = await this.knex('github_installations').where('github_installation_id', asGhId(githubInstallationId)).first();
    if (!row) return;
    await this.knex('github_installations').where('id', row.id).delete();
    this.client.clearToken(githubInstallationId);
  }

  private async maybePostChat(repo: any, projects: any[], content: string) {
    if (!this.chat || !projects.length) return;
    const installation = await this.knex('github_installations').where('id', repo.installation_id).first();
    for (const project of projects) {
      if (!project.notify_chat && !installation?.notify_project_chat) continue;
      const senderId = project.owner_id;
      if (!senderId) continue;
      try {
        await this.chat.postSystemMessage(project.id, project.company_id, senderId, content);
      } catch (err) {
        this.logger.warn(`GitHub chat post failed for project ${project.id}: ${(err as Error).message}`);
      }
    }
  }

  private async memberIdsForProjects(projectIds: string[]) {
    if (!projectIds.length) return [];
    const members = await this.knex('project_members').whereIn('project_id', projectIds).pluck('user_id');
    const owners = await this.knex('projects').whereIn('id', projectIds).pluck('owner_id');
    return [...new Set([...members, ...owners])];
  }

  private async projectRepoIds(projectId: string) {
    return this.knex('project_github_repositories').where('project_id', projectId).pluck('github_repository_id');
  }

  async assertCanViewProject(projectId: string, user: any) {
    const project = await this.knex('projects')
      .where({ id: projectId, company_id: user.company_id })
      .first();
    if (!project) throw new NotFoundException('Project not found');
    if (await canManageAllProjects(this.knex, user.company_id, user.id, user.role)) return project;
    const member = await this.knex('project_members').where({ project_id: projectId, user_id: user.id }).first();
    if (member) return project;
    const assigned = await this.knex('issues').where({ project_id: projectId, assignee_id: user.id }).first();
    if (assigned) return project;
    throw new ForbiddenException('You do not have access to this project');
  }

  async assertCanManageProject(projectId: string, user: any) {
    const project = await this.assertCanViewProject(projectId, user);
    if (user.role === Role.Hr) {
      throw new ForbiddenException('HR cannot attach GitHub repositories');
    }
    if (user.role === Role.Admin || user.role === Role.Manager) return project;
    if (await canManageAllProjects(this.knex, user.company_id, user.id, user.role)) return project;
    const owner = await this.knex('project_members')
      .where({ project_id: projectId, user_id: user.id, role: 'owner' })
      .first();
    if (owner || project.owner_id === user.id) return project;
    throw new ForbiddenException('Only admins, managers, or the project owner can change GitHub repositories');
  }

  private assertCanMapUser(actor: any, target: any) {
    if (actor.id === target.id) return;
    if (actor.role === Role.Admin) return;
    throw new ForbiddenException('Only admins can map someone else’s GitHub account');
  }

  private async visibleProjectsForUser(user: any) {
    const q = this.knex('projects as p')
      .where('p.company_id', user.company_id)
      .select('p.id', 'p.name', 'p.icon', 'p.status', 'p.color')
      .orderBy('p.name', 'asc');
    if (await canManageAllProjects(this.knex, user.company_id, user.id, user.role)) return q;
    return q.where((builder) => {
      builder
        .whereExists(
          this.knex('project_members as pm')
            .whereRaw('pm.project_id = p.id')
            .where('pm.user_id', user.id),
        )
        .orWhereExists(
          this.knex('issues as i')
            .whereRaw('i.project_id = p.id')
            .where('i.assignee_id', user.id),
        );
    });
  }

  private async installationsForCompany(companyId: string) {
    return this.knex('github_installations')
      .where('company_id', companyId)
      .orderBy('github_account_login', 'asc');
  }

  private async installationIdsForCompany(companyId: string) {
    const rows = await this.installationsForCompany(companyId);
    return rows.map((row) => row.id);
  }

  private async installationForCompany(companyId: string) {
    const rows = await this.installationsForCompany(companyId);
    return rows[0] ?? null;
  }

  private async requireInstallation(companyId: string) {
    const installation = await this.installationForCompany(companyId);
    if (!installation) throw new NotFoundException('GitHub is not connected');
    return installation;
  }

  private async requireCompanyInstallation(companyId: string, installationRowId: string) {
    const installation = await this.knex('github_installations')
      .where({ id: installationRowId, company_id: companyId })
      .first();
    if (!installation) throw new NotFoundException('GitHub organization is not connected');
    return installation;
  }

  private serializeInstallation(installation: any) {
    return {
      id: installation.id,
      github_installation_id: String(installation.github_installation_id),
      github_account_login: installation.github_account_login,
      account_type: installation.account_type,
      repository_selection: installation.repository_selection,
      status: installation.status,
      notify_project_chat: !!installation.notify_project_chat,
      installed_at: installation.installed_at,
      last_synced_at: installation.last_synced_at,
      manage_url: this.client.manageUrl(
        installation.github_installation_id,
        installation.github_account_login,
        installation.account_type,
      ),
    };
  }

  private serializeRepo(repo: any) {
    return {
      id: repo.id,
      github_repository_id: String(repo.github_repository_id),
      owner: repo.owner,
      name: repo.name,
      full_name: repo.full_name,
      default_branch: repo.default_branch,
      private: !!repo.private,
      archived: !!repo.archived,
      html_url: repo.html_url,
      last_synced_at: repo.last_synced_at,
    };
  }

  private async audit(
    companyId: string,
    actorId: string | null,
    action: string,
    resourceType: string,
    resourceId?: string | null,
    meta?: any,
  ) {
    try {
      await this.knex('audit_logs').insert({
        id: uuid(),
        company_id: companyId,
        actor_id: actorId,
        action,
        resource_type: resourceType,
        resource_id: resourceId ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      });
    } catch (err) {
      this.logger.warn(`audit_logs write failed: ${(err as Error).message}`);
    }
  }
}
