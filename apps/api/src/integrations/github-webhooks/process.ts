import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import { GitHubService } from '../github.service';
import { GitHubSyncService } from '../github-sync.service';
import { asGhId, isMysqlDuplicate } from '../github-mappers';

const logger = new Logger('GitHubWebhooks');

export async function claimDelivery(
  knex: Knex,
  deliveryId: string,
  eventType: string,
  action: string | undefined,
  githubInstallationId: string | null,
  githubRepositoryId: string | null,
): Promise<'claimed' | 'duplicate'> {
  try {
    await knex('github_webhook_events').insert({
      id: uuid(),
      github_delivery_id: deliveryId,
      event_type: eventType,
      action: action ?? null,
      github_installation_id: githubInstallationId,
      github_repository_id: githubRepositoryId,
      processing_status: 'pending',
      received_at: new Date(),
    });
    return 'claimed';
  } catch (err) {
    if (isMysqlDuplicate(err)) return 'duplicate';
    throw err;
  }
}

export async function markDelivery(knex: Knex, deliveryId: string, status: 'processed' | 'failed', error?: string) {
  await knex('github_webhook_events')
    .where('github_delivery_id', deliveryId)
    .update({
      processing_status: status,
      processed_at: new Date(),
      error_message: error ?? null,
    });
}

export async function processGitHubEvent(
  event: string,
  payload: any,
  github: GitHubService,
  sync: GitHubSyncService,
) {
  const action = payload?.action as string | undefined;
  const installationId = asGhId(payload?.installation?.id);
  const installation = installationId ? await sync.getInstallation(installationId) : null;
  const ghRepo = payload?.repository;
  let repo = ghRepo?.id ? await sync.findRepoByGithubId(ghRepo.id) : null;

  switch (event) {
    case 'installation':
      await handleInstallation(action, payload, github);
      return;
    case 'installation_repositories':
      if (!installation) return;
      await handleInstallationRepositories(action, payload, installation, github);
      return;
    case 'repository':
      if (!installation) return;
      await handleRepository(action, payload, installation, github, sync);
      return;
    case 'pull_request':
      if (!repo && installation && ghRepo) {
        const id = await github.upsertRepoFromWebhook(installation, ghRepo);
        repo = id ? await sync.findRepoByGithubId(ghRepo.id) : null;
      }
      if (!repo) return;
      await handlePullRequest(action, payload, repo, github, sync);
      return;
    case 'pull_request_review':
      if (!repo) return;
      await handlePullRequestReview(payload, repo, sync);
      return;
    case 'issues':
      if (!repo && installation && ghRepo) {
        const id = await github.upsertRepoFromWebhook(installation, ghRepo);
        repo = id ? await sync.findRepoByGithubId(ghRepo.id) : null;
      }
      if (!repo) return;
      await sync.upsertIssue(repo.id, payload.issue);
      return;
    case 'release':
      if (!repo) return;
      if (action === 'deleted' && payload.release?.id) {
        await sync.deleteRelease(payload.release.id);
        return;
      }
      await sync.upsertRelease(repo.id, payload.release);
      if (action === 'published' && payload.release && !payload.release.draft) {
        await github.notifyRelease(repo, payload.release);
      }
      return;
    case 'push':
      if (!repo) return;
      await handlePush(payload, repo, sync);
      return;
    default:
      logger.debug(`Ignored GitHub event ${event}`);
  }
}

async function handleInstallation(action: string | undefined, payload: any, github: GitHubService) {
  const id = payload.installation?.id;
  if (!id) return;
  if (action === 'deleted') {
    await github.deleteInstallationByGithubId(id);
    return;
  }
  if (action === 'suspend') {
    await github.markInstallationStatus(id, 'suspended');
    return;
  }
  if (action === 'unsuspend') {
    await github.markInstallationStatus(id, 'active');
  }
}

async function handleInstallationRepositories(
  action: string | undefined,
  payload: any,
  installation: any,
  github: GitHubService,
) {
  if (action === 'added') {
    for (const repo of payload.repositories_added ?? []) {
      await github.upsertRepoFromWebhook(installation, {
        ...repo,
        owner: { login: String(repo.full_name ?? '').split('/')[0] },
        html_url: `https://github.com/${repo.full_name}`,
        private: !!repo.private,
      });
    }
  }
  if (action === 'removed') {
    for (const repo of payload.repositories_removed ?? []) {
      if (repo.id) await github.removeRepoByGithubId(repo.id);
    }
  }
}

async function handleRepository(
  action: string | undefined,
  payload: any,
  installation: any,
  github: GitHubService,
  sync: GitHubSyncService,
) {
  if (action === 'deleted' && payload.repository?.id) {
    await github.removeRepoByGithubId(payload.repository.id);
    return;
  }
  if (payload.repository) {
    await github.upsertRepoFromWebhook(installation, payload.repository);
  }
}

async function handlePullRequest(
  action: string | undefined,
  payload: any,
  repo: any,
  github: GitHubService,
  sync: GitHubSyncService,
) {
  const pr = payload.pull_request;
  if (!pr) return;
  await sync.upsertPullRequest(repo.id, pr);
  if (action === 'review_requested' && payload.requested_reviewer) {
    await github.notifyReviewRequested(repo, pr, payload.requested_reviewer);
  }
  if (action === 'closed' && (pr.merged || pr.merged_at)) {
    await github.notifyPrMerged(repo, pr);
  }
}

async function handlePullRequestReview(payload: any, repo: any, sync: GitHubSyncService) {
  const pr = payload.pull_request;
  const review = payload.review;
  if (!pr || !review) return;
  const prId = await sync.upsertPullRequest(repo.id, pr);
  if (prId) await sync.upsertReview(prId, review);
}

async function handlePush(payload: any, repo: any, sync: GitHubSyncService) {
  const commits = payload.commits ?? [];
  for (const commit of commits) {
    await sync.upsertCommit(repo.id, {
      sha: commit.id,
      id: commit.id,
      message: commit.message,
      timestamp: commit.timestamp,
      html_url: commit.url,
      author: commit.author?.username
        ? { login: commit.author.username, name: commit.author.name }
        : { name: commit.author?.name },
    }, repo.html_url);
  }
}
