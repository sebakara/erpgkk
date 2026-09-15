import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import { isMysqlDuplicate } from './github-mappers';

export function textMentionsIssueId(text: string, issueId: string) {
  if (!text || !issueId) return false;
  const hay = text.toLowerCase();
  const id = issueId.toLowerCase();
  const compact = id.replace(/-/g, '');
  return hay.includes(id) || (compact.length >= 32 && hay.includes(compact));
}

export type LinkedPullRequest = {
  id: string;
  link_id: string;
  number: number;
  title: string;
  state: string;
  merged: boolean;
  html_url?: string | null;
  source_branch?: string | null;
  repository?: string;
};

export async function loadPullRequestsForIssues(knex: Knex, issueIds: string[]): Promise<Map<string, LinkedPullRequest[]>> {
  const byIssue = new Map<string, LinkedPullRequest[]>();
  if (!issueIds.length) return byIssue;

  const rows = await knex('github_pr_links as l')
    .join('github_pull_requests as pr', 'l.pull_request_id', 'pr.id')
    .join('github_repositories as r', 'pr.github_repository_id', 'r.id')
    .whereIn('l.issue_id', issueIds)
    .select(
      'l.id as link_id',
      'l.issue_id',
      'pr.id',
      'pr.number',
      'pr.title',
      'pr.state',
      'pr.merged',
      'pr.html_url',
      'pr.source_branch',
      'r.full_name as repository',
    )
    .orderBy('pr.github_updated_at', 'desc');

  for (const row of rows) {
    const list = byIssue.get(row.issue_id) ?? [];
    list.push({
      id: row.id,
      link_id: row.link_id,
      number: row.number,
      title: row.title,
      state: row.state,
      merged: !!row.merged,
      html_url: row.html_url,
      source_branch: row.source_branch,
      repository: row.repository,
    });
    byIssue.set(row.issue_id, list);
  }
  return byIssue;
}

export async function insertPrLink(knex: Knex, issueId: string, pullRequestId: string) {
  try {
    await knex('github_pr_links').insert({
      id: uuid(),
      issue_id: issueId,
      pull_request_id: pullRequestId,
    });
    return true;
  } catch (err) {
    if (isMysqlDuplicate(err)) return false;
    throw err;
  }
}
