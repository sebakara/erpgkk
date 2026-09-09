'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { GitPullRequest, GitCommit, Tag, CircleDot, FolderGit2, ExternalLink } from 'lucide-react';
import { githubApi } from '@/lib/api';
import { DevSpinner, Empty, formatDate } from './ui';

export default function DevelopmentOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['github-overview', id],
    queryFn: () => githubApi.projectOverview(id),
  });

  if (isLoading) return <DevSpinner />;
  if (!data) return null;

  if (!data.repo_count) {
    return (
      <Empty
        title="No GitHub repositories attached"
        body="Attach repositories from the Repositories tab to see pull requests, commits, and releases here."
        href={`/projects/${id}/development/repositories`}
        cta="Open repositories"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<FolderGit2 size={16} />} label="Repositories" value={data.repo_count} />
        <Kpi icon={<GitPullRequest size={16} />} label="Open PRs" value={data.open_prs} />
        <Kpi icon={<GitCommit size={16} />} label="Merged (30d)" value={data.merged_prs_30d} />
        <Kpi icon={<CircleDot size={16} />} label="Open GitHub issues" value={data.open_issues} />
      </div>

      {data.latest_release && (
        <a
          href={data.latest_release.html_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-gray-300"
        >
          <Tag size={16} className="text-indigo-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {data.latest_release.name || data.latest_release.tag_name}
            </p>
            <p className="text-xs text-gray-400">
              Latest release on {data.latest_release.repository} · {formatDate(data.latest_release.published_at)}
            </p>
          </div>
          <ExternalLink size={14} className="text-gray-400" />
        </a>
      )}

      <ActivityList title="Recent pull requests" rows={data.recent_pull_requests} empty="No pull requests yet."
        render={(pr: any) => (
          <GitLink key={pr.id} href={pr.html_url} title={`${pr.repository}#${pr.number} ${pr.title}`}
            meta={`${pr.author_login ?? 'unknown'} · ${pr.state}${pr.merged ? ' · merged' : ''} · ${formatDate(pr.github_updated_at)}`} />
        )}
      />
      <ActivityList title="Recent commits" rows={data.recent_commits} empty="No commits in the recent window."
        render={(c: any) => (
          <GitLink key={c.id} href={c.html_url} title={c.message}
            meta={`${c.author_login || c.author_name || 'unknown'} · ${c.repository} · ${formatDate(c.committed_at)}`} />
        )}
      />
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium uppercase tracking-wide">
        {icon} {label}
      </div>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function ActivityList({ title, rows, empty, render }: { title: string; rows: any[]; empty: string; render: (row: any) => React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {rows?.length ? <div className="divide-y divide-gray-100">{rows.map(render)}</div> : (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">{empty}</p>
      )}
    </div>
  );
}

function GitLink({ href, title, meta }: { href?: string | null; title: string; meta: string }) {
  const inner = (
    <>
      <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
      <p className="text-xs text-gray-400 truncate">{meta}</p>
    </>
  );
  const cls = 'block px-5 py-3 hover:bg-gray-50';
  return href ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a> : <div className={cls}>{inner}</div>;
}
