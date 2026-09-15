export function asGhId(value: string | number | bigint | null | undefined): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

export function clip(value: string | null | undefined, max: number): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapRepository(repo: any) {
  const owner = repo.owner?.login ?? String(repo.full_name ?? '').split('/')[0] ?? '';
  return {
    github_repository_id: asGhId(repo.id),
    owner,
    name: repo.name,
    full_name: repo.full_name ?? `${owner}/${repo.name}`,
    default_branch: repo.default_branch ?? null,
    private: !!repo.private,
    archived: !!repo.archived,
    html_url: repo.html_url ?? `https://github.com/${owner}/${repo.name}`,
    github_created_at: asDate(repo.created_at),
    github_updated_at: asDate(repo.updated_at),
  };
}

export function mapPullRequest(pr: any) {
  const user = pr.user ?? pr.author ?? {};
  return {
    github_pr_id: asGhId(pr.id),
    number: pr.number,
    title: clip(pr.title, 500) || `PR #${pr.number}`,
    body: pr.body ?? null,
    github_author_id: asGhId(user.id),
    author_login: user.login ?? null,
    state: pr.state ?? 'open',
    draft: !!pr.draft,
    source_branch: pr.head?.ref ?? null,
    target_branch: pr.base?.ref ?? null,
    additions: pr.additions ?? null,
    deletions: pr.deletions ?? null,
    changed_files: pr.changed_files ?? null,
    commits_count: pr.commits ?? null,
    merged: !!(pr.merged || pr.merged_at),
    html_url: pr.html_url ?? null,
    merged_at: asDate(pr.merged_at),
    closed_at: asDate(pr.closed_at),
    github_created_at: asDate(pr.created_at),
    github_updated_at: asDate(pr.updated_at),
  };
}

export function mapPullRequestReview(review: any) {
  const user = review.user ?? {};
  return {
    github_review_id: asGhId(review.id),
    github_user_id: asGhId(user.id),
    reviewer_login: user.login ?? null,
    state: review.state ?? 'COMMENTED',
    submitted_at: asDate(review.submitted_at),
  };
}

export function mapCommit(commit: any, repoHtmlUrl?: string) {
  const sha = commit.sha ?? commit.id;
  const author = commit.author ?? {};
  const login = author.login ?? commit.commit?.author?.name ?? null;
  const message = commit.commit?.message ?? commit.message ?? '';
  return {
    sha,
    author_github_user_id: asGhId(author.id),
    author_login: typeof login === 'string' ? login : null,
    author_name: commit.commit?.author?.name ?? author.name ?? null,
    message: clip(message.split('\n')[0], 500) || sha,
    html_url: commit.html_url ?? (repoHtmlUrl && sha ? `${repoHtmlUrl}/commit/${sha}` : null),
    committed_at: asDate(commit.commit?.author?.date ?? commit.timestamp ?? commit.committed_at),
  };
}

export function mapIssue(issue: any) {
  const user = issue.user ?? {};
  const assignee = issue.assignee ?? {};
  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((label: any) => ({
        name: typeof label === 'string' ? label : label.name,
        color: typeof label === 'string' ? null : label.color ?? null,
      }))
    : [];
  return {
    github_issue_id: asGhId(issue.id),
    number: issue.number,
    title: clip(issue.title, 500) || `Issue #${issue.number}`,
    state: issue.state ?? 'open',
    github_author_id: asGhId(user.id),
    author_login: user.login ?? null,
    github_assignee_id: asGhId(assignee.id),
    labels: JSON.stringify(labels),
    html_url: issue.html_url ?? null,
    is_pull_request: !!issue.pull_request,
    github_created_at: asDate(issue.created_at),
    github_updated_at: asDate(issue.updated_at),
    closed_at: asDate(issue.closed_at),
  };
}

export function mapRelease(release: any) {
  const author = release.author ?? {};
  return {
    github_release_id: asGhId(release.id),
    tag_name: release.tag_name ?? '',
    name: release.name ?? release.tag_name ?? null,
    draft: !!release.draft,
    prerelease: !!release.prerelease,
    author_login: author.login ?? null,
    html_url: release.html_url ?? null,
    published_at: asDate(release.published_at),
    github_created_at: asDate(release.created_at),
  };
}

export function isMysqlDuplicate(err: any): boolean {
  return err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062;
}
