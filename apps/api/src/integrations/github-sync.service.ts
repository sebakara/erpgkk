import { Injectable, Inject, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import { KNEX_CONNECTION } from '../database/database.module';
import { GitHubAppClient } from './github-app.client';
import {
  asGhId,
  isMysqlDuplicate,
  mapCommit,
  mapIssue,
  mapPullRequest,
  mapPullRequestReview,
  mapRelease,
  mapRepository,
} from './github-mappers';

const SYNC_WINDOW_DAYS = 90;
const MAX_PRS_PER_REPO = 200;
const MAX_ISSUES_PER_REPO = 200;
const MAX_COMMITS_PER_REPO = 200;
const MAX_RELEASES_PER_REPO = 50;
const MAX_REVIEW_PRS_PER_REPO = 50;

@Injectable()
export class GitHubSyncService {
  private readonly logger = new Logger(GitHubSyncService.name);

  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly client: GitHubAppClient,
  ) {}

  sinceDate(): Date {
    return new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  }

  async getInstallation(githubInstallationId: string | number) {
    return this.knex('github_installations')
      .where('github_installation_id', githubInstallationId)
      .first();
  }

  async fetchInstallation(githubInstallationId: string | number) {
    const octokit = await this.client.appOctokit();
    const { data } = await octokit.rest.apps.getInstallation({
      installation_id: Number(githubInstallationId),
    });
    return data;
  }

  async fetchUserByUsername(username: string) {
    const octokit = await this.client.appOctokit();
    const { data } = await octokit.rest.users.getByUsername({ username });
    return data;
  }

  async syncInstallationRepositories(installationRow: any) {
    const octokit = await this.client.installationOctokit(installationRow.github_installation_id);
    const seen = new Set<string>();

    for await (const page of octokit.paginate.iterator(octokit.rest.apps.listReposAccessibleToInstallation, {
      per_page: 100,
    })) {
      const repos = Array.isArray(page.data)
        ? page.data
        : ((page.data as any)?.repositories ?? []);
      for (const repo of repos) {
        const mapped = mapRepository(repo);
        if (!mapped.github_repository_id) continue;
        seen.add(mapped.github_repository_id);
        await this.upsertRepository(installationRow.id, mapped);
      }
    }

    if (seen.size) {
      const stale = await this.knex('github_repositories')
        .where('installation_id', installationRow.id)
        .whereNotIn('github_repository_id', [...seen]);
      for (const repo of stale) {
        await this.knex('github_repositories').where('id', repo.id).delete();
      }
    }

    await this.knex('github_installations').where('id', installationRow.id).update({
      last_synced_at: new Date(),
      updated_at: new Date(),
    });
  }

  async syncRepoActivity(repo: any) {
    const installation = await this.knex('github_installations').where('id', repo.installation_id).first();
    if (!installation) return;
    const octokit = await this.client.installationOctokit(installation.github_installation_id);
    const since = this.sinceDate();

    try {
      await this.syncPullRequests(octokit, repo, since);
    } catch (err) {
      this.logger.warn(`PR sync failed for ${repo.full_name}: ${(err as Error).message}`);
    }
    try {
      await this.syncIssues(octokit, repo, since);
    } catch (err) {
      this.logger.warn(`Issue sync failed for ${repo.full_name}: ${(err as Error).message}`);
    }
    try {
      await this.syncCommits(octokit, repo, since);
    } catch (err) {
      this.logger.warn(`Commit sync failed for ${repo.full_name}: ${(err as Error).message}`);
    }
    try {
      await this.syncReleases(octokit, repo);
    } catch (err) {
      this.logger.warn(`Release sync failed for ${repo.full_name}: ${(err as Error).message}`);
    }

    await this.knex('github_repositories').where('id', repo.id).update({
      last_synced_at: new Date(),
      updated_at: new Date(),
    });
  }

  async upsertRepository(installationId: string, mapped: ReturnType<typeof mapRepository>) {
    if (!mapped.github_repository_id) return null;
    const existing = await this.knex('github_repositories')
      .where('github_repository_id', mapped.github_repository_id)
      .first();
    const row = {
      installation_id: installationId,
      github_repository_id: mapped.github_repository_id,
      owner: mapped.owner,
      name: mapped.name,
      full_name: mapped.full_name,
      default_branch: mapped.default_branch,
      private: mapped.private,
      archived: mapped.archived,
      html_url: mapped.html_url,
      github_created_at: mapped.github_created_at,
      github_updated_at: mapped.github_updated_at,
      updated_at: new Date(),
    };
    if (existing) {
      await this.knex('github_repositories').where('id', existing.id).update(row);
      return existing.id as string;
    }
    const id = uuid();
    await this.knex('github_repositories').insert({ id, ...row, created_at: new Date() });
    return id;
  }

  async upsertPullRequest(repoId: string, pr: any) {
    const mapped = mapPullRequest(pr);
    if (!mapped.github_pr_id) return null;
    const existing = await this.knex('github_pull_requests')
      .where({ github_repository_id: repoId, github_pr_id: mapped.github_pr_id })
      .first();
    const row = {
      github_repository_id: repoId,
      ...mapped,
      last_synced_at: new Date(),
      updated_at: new Date(),
    };
    if (existing) {
      await this.knex('github_pull_requests').where('id', existing.id).update(row);
      return existing.id as string;
    }
    const id = uuid();
    try {
      await this.knex('github_pull_requests').insert({ id, ...row, created_at: new Date() });
      return id;
    } catch (err) {
      if (!isMysqlDuplicate(err)) throw err;
      const again = await this.knex('github_pull_requests')
        .where({ github_repository_id: repoId, github_pr_id: mapped.github_pr_id })
        .first();
      if (again) {
        await this.knex('github_pull_requests').where('id', again.id).update(row);
        return again.id as string;
      }
      throw err;
    }
  }

  async upsertReview(pullRequestId: string, review: any) {
    const mapped = mapPullRequestReview(review);
    if (!mapped.github_review_id) return null;
    const existing = await this.knex('github_pull_request_reviews')
      .where('github_review_id', mapped.github_review_id)
      .first();
    const row = { pull_request_id: pullRequestId, ...mapped };
    if (existing) {
      await this.knex('github_pull_request_reviews').where('id', existing.id).update(row);
      return existing.id as string;
    }
    const id = uuid();
    try {
      await this.knex('github_pull_request_reviews').insert({ id, ...row });
      return id;
    } catch (err) {
      if (!isMysqlDuplicate(err)) throw err;
      return (await this.knex('github_pull_request_reviews').where('github_review_id', mapped.github_review_id).first())?.id ?? null;
    }
  }

  async upsertIssue(repoId: string, issue: any) {
    const mapped = mapIssue(issue);
    if (!mapped.github_issue_id || mapped.is_pull_request) return null;
    const existing = await this.knex('github_issues')
      .where({ github_repository_id: repoId, github_issue_id: mapped.github_issue_id })
      .first();
    const { is_pull_request, ...rest } = mapped;
    const row = {
      github_repository_id: repoId,
      ...rest,
      last_synced_at: new Date(),
      updated_at: new Date(),
    };
    if (existing) {
      await this.knex('github_issues').where('id', existing.id).update(row);
      return existing.id as string;
    }
    const id = uuid();
    try {
      await this.knex('github_issues').insert({ id, ...row, created_at: new Date() });
      return id;
    } catch (err) {
      if (!isMysqlDuplicate(err)) throw err;
      const again = await this.knex('github_issues')
        .where({ github_repository_id: repoId, github_issue_id: mapped.github_issue_id })
        .first();
      return again?.id ?? null;
    }
  }

  async upsertCommit(repoId: string, commit: any, repoHtmlUrl?: string) {
    const mapped = mapCommit(commit, repoHtmlUrl);
    if (!mapped.sha) return null;
    const existing = await this.knex('github_commits')
      .where({ github_repository_id: repoId, sha: mapped.sha })
      .first();
    if (existing) {
      await this.knex('github_commits').where('id', existing.id).update(mapped);
      return existing.id as string;
    }
    const id = uuid();
    try {
      await this.knex('github_commits').insert({ id, github_repository_id: repoId, ...mapped });
      return id;
    } catch (err) {
      if (!isMysqlDuplicate(err)) throw err;
      return (await this.knex('github_commits').where({ github_repository_id: repoId, sha: mapped.sha }).first())?.id ?? null;
    }
  }

  async upsertRelease(repoId: string, release: any) {
    const mapped = mapRelease(release);
    if (!mapped.github_release_id) return null;
    const existing = await this.knex('github_releases')
      .where('github_release_id', mapped.github_release_id)
      .first();
    const row = { github_repository_id: repoId, ...mapped };
    if (existing) {
      await this.knex('github_releases').where('id', existing.id).update(row);
      return existing.id as string;
    }
    const id = uuid();
    try {
      await this.knex('github_releases').insert({ id, ...row });
      return id;
    } catch (err) {
      if (!isMysqlDuplicate(err)) throw err;
      return (await this.knex('github_releases').where('github_release_id', mapped.github_release_id).first())?.id ?? null;
    }
  }

  async deleteRelease(githubReleaseId: string | number) {
    await this.knex('github_releases').where('github_release_id', asGhId(githubReleaseId)).delete();
  }

  async findRepoByGithubId(githubRepositoryId: string | number) {
    return this.knex('github_repositories')
      .where('github_repository_id', asGhId(githubRepositoryId))
      .first();
  }

  async findPrByGithubId(repoId: string, githubPrId: string | number) {
    return this.knex('github_pull_requests')
      .where({ github_repository_id: repoId, github_pr_id: asGhId(githubPrId) })
      .first();
  }

  private async syncPullRequests(octokit: any, repo: any, since: Date) {
    let count = 0;
    const recentPrs: Array<{ id: string; number: number }> = [];

    for await (const page of octokit.paginate.iterator(octokit.rest.pulls.list, {
      owner: repo.owner,
      repo: repo.name,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    })) {
      let stop = false;
      for (const pr of page.data) {
        if (pr.updated_at && new Date(pr.updated_at) < since) {
          stop = true;
          break;
        }
        const id = await this.upsertPullRequest(repo.id, pr);
        if (id && recentPrs.length < MAX_REVIEW_PRS_PER_REPO) {
          recentPrs.push({ id, number: pr.number });
        }
        count += 1;
        if (count >= MAX_PRS_PER_REPO) {
          stop = true;
          break;
        }
      }
      if (stop) break;
    }

    for (const pr of recentPrs) {
      try {
        const { data: reviews } = await octokit.rest.pulls.listReviews({
          owner: repo.owner,
          repo: repo.name,
          pull_number: pr.number,
          per_page: 100,
        });
        for (const review of reviews) {
          await this.upsertReview(pr.id, review);
        }
      } catch (err) {
        this.logger.warn(`Review sync failed for ${repo.full_name}#${pr.number}: ${(err as Error).message}`);
      }
    }
  }

  private async syncIssues(octokit: any, repo: any, since: Date) {
    let count = 0;
    for await (const page of octokit.paginate.iterator(octokit.rest.issues.listForRepo, {
      owner: repo.owner,
      repo: repo.name,
      state: 'all',
      since: since.toISOString(),
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    })) {
      for (const issue of page.data) {
        if (issue.pull_request) continue;
        await this.upsertIssue(repo.id, issue);
        count += 1;
        if (count >= MAX_ISSUES_PER_REPO) return;
      }
    }
  }

  private async syncCommits(octokit: any, repo: any, since: Date) {
    let count = 0;
    for await (const page of octokit.paginate.iterator(octokit.rest.repos.listCommits, {
      owner: repo.owner,
      repo: repo.name,
      since: since.toISOString(),
      per_page: 100,
    })) {
      for (const commit of page.data) {
        await this.upsertCommit(repo.id, commit, repo.html_url);
        count += 1;
        if (count >= MAX_COMMITS_PER_REPO) return;
      }
    }
  }

  private async syncReleases(octokit: any, repo: any) {
    let count = 0;
    for await (const page of octokit.paginate.iterator(octokit.rest.repos.listReleases, {
      owner: repo.owner,
      repo: repo.name,
      per_page: 50,
    })) {
      for (const release of page.data) {
        await this.upsertRelease(repo.id, release);
        count += 1;
        if (count >= MAX_RELEASES_PER_REPO) return;
      }
    }
  }
}
