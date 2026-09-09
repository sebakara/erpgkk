'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { githubApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DevSpinner, Empty, GitRow, formatDate } from '../ui';
import { useState } from 'react';

function parseLabels(raw: any): string[] {
  if (!raw) return [];
  const value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  if (!Array.isArray(value)) return [];
  return value.map((l: any) => (typeof l === 'string' ? l : l.name)).filter(Boolean);
}

export default function DevelopmentIssuesPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['github-issues', id, state],
    queryFn: () => githubApi.issues(id, state || undefined),
  });

  if (isLoading) return <DevSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">GitHub Issues</h2>
          <p className="text-sm text-gray-500">Read-only. CompanyOS issues stay on the Issues tab.</p>
        </div>
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
        <Empty title="No GitHub issues" body="GitHub issues from attached repositories appear here after a sync." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {data.map((issue: any) => (
            <GitRow
              key={issue.id}
              href={issue.html_url}
              title={`${issue.repository}#${issue.number} ${issue.title}`}
              meta={`${issue.author_login ?? 'unknown'} · ${parseLabels(issue.labels).join(', ') || 'no labels'} · ${formatDate(issue.github_updated_at)}`}
              badge={
                <span className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full capitalize',
                  issue.state === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
                )}>
                  {issue.state}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
