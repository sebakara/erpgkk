'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { githubApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DevSpinner, Empty, GitRow, formatDate, mappedName } from '../ui';
import { useState } from 'react';

export default function DevelopmentPullRequestsPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<string>('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['github-prs', id, state],
    queryFn: () => githubApi.pullRequests(id, state || undefined),
  });

  if (isLoading) return <DevSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Pull Requests</h2>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
        >
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      {data.length === 0 ? (
        <Empty title="No pull requests" body="Attach a repository and sync to see GitHub pull requests." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {data.map((pr: any) => (
            <GitRow
              key={pr.id}
              href={pr.html_url}
              title={`${pr.repository}#${pr.number} ${pr.title}`}
              meta={`${mappedName(pr)} · ${pr.source_branch ?? '?'} → ${pr.target_branch ?? '?'} · ${formatDate(pr.github_updated_at)}`}
              badge={
                <span className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full capitalize',
                  pr.merged ? 'bg-purple-100 text-purple-700' : pr.state === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
                )}>
                  {pr.merged ? 'merged' : pr.draft ? 'draft' : pr.state}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
