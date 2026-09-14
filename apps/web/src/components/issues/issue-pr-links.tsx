'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitMerge, GitPullRequest, Link2, Unlink, X } from 'lucide-react';
import { githubApi, issuesApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Issue, LinkedPullRequest } from '@/types';

interface Props {
  projectId: string;
  issue: Issue;
}

function PrRow({
  pr,
  onUnlink,
}: {
  pr: LinkedPullRequest;
  onUnlink?: () => void;
}) {
  const merged = !!pr.merged;
  return (
    <div className="flex items-start gap-2 py-1.5">
      {merged ? (
        <GitMerge size={14} className="mt-0.5 shrink-0 text-emerald-600" />
      ) : (
        <GitPullRequest size={14} className="mt-0.5 shrink-0 text-indigo-500" />
      )}
      <div className="min-w-0 flex-1">
        <a
          href={pr.html_url || undefined}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-gray-800 hover:text-indigo-600 truncate block"
        >
          {pr.repository ? `${pr.repository}` : ''}#{pr.number} {pr.title}
        </a>
        <p className="text-[11px] text-gray-400">
          {merged ? 'Merged' : pr.state === 'open' ? 'Open' : 'Closed'}
          {pr.source_branch ? ` · ${pr.source_branch}` : ''}
        </p>
      </div>
      {onUnlink && (
        <button
          type="button"
          onClick={onUnlink}
          className="p-1 text-gray-300 hover:text-red-500 rounded"
          title="Unlink"
        >
          <Unlink size={13} />
        </button>
      )}
    </div>
  );
}

export function IssuePrLinks({ projectId, issue }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const linked = issue.pull_requests ?? [];
  const linkedIds = new Set(linked.map((pr) => pr.id));

  const { data: projectPrs = [] } = useQuery({
    queryKey: ['github-prs', projectId, 'open'],
    queryFn: () => githubApi.pullRequests(projectId, 'open'),
    enabled: open,
  });

  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projectPrs as any[])
      .filter((pr) => !linkedIds.has(pr.id))
      .filter((pr) => {
        if (!q) return true;
        return String(pr.number).includes(q) || String(pr.title ?? '').toLowerCase().includes(q)
          || String(pr.repository ?? '').toLowerCase().includes(q);
      });
  }, [projectPrs, linkedIds, query]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['issue', projectId, issue.id] });
    qc.invalidateQueries({ queryKey: ['issues', projectId] });
  };

  const link = useMutation({
    mutationFn: (pull_request_id: string) => issuesApi.linkPullRequest(projectId, issue.id, pull_request_id),
    onSuccess: () => {
      invalidate();
      setQuery('');
      toast.success('Pull request linked');
    },
    onError: () => toast.error('Could not link pull request'),
  });

  const unlink = useMutation({
    mutationFn: (prId: string) => issuesApi.unlinkPullRequest(projectId, issue.id, prId),
    onSuccess: () => {
      invalidate();
      toast.success('Pull request unlinked');
    },
    onError: () => toast.error('Could not unlink pull request'),
  });

  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500">Pull requests</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
        >
          <Link2 size={12} />
          {open ? 'Close' : 'Link pull request'}
        </button>
      </div>

      {linked.length === 0 && !open && (
        <p className="text-sm text-gray-400 italic">No pull requests linked.</p>
      )}
      {linked.map((pr) => (
        <PrRow key={pr.id} pr={pr} onUnlink={() => unlink.mutate(pr.id)} />
      ))}

      {open && (
        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search open PRs"
              className="flex-1 text-sm px-1 py-1 focus:outline-none"
            />
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {choices.map((pr: any) => (
              <button
                key={pr.id}
                type="button"
                disabled={link.isPending}
                onClick={() => link.mutate(pr.id)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-start gap-2"
              >
                <GitPullRequest size={13} className="mt-0.5 shrink-0 text-indigo-500" />
                <span className="min-w-0">
                  <span className="block text-sm text-gray-800 truncate">#{pr.number} {pr.title}</span>
                  <span className="block text-[11px] text-gray-400 truncate">{pr.repository}</span>
                </span>
              </button>
            ))}
            {choices.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">
                No open PRs on linked repositories
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function IssuePrBadges({ issue }: { issue: Issue }) {
  const prs = issue.pull_requests ?? [];
  if (!prs.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {prs.slice(0, 2).map((pr) => (
        <span
          key={pr.id}
          title={`${pr.repository ?? ''}#${pr.number} ${pr.title}`}
          className={cn(
            'inline-flex items-center gap-0.5 text-[10px] font-semibold rounded px-1 py-0.5',
            pr.merged ? 'text-emerald-700 bg-emerald-50' : pr.state === 'open' ? 'text-indigo-700 bg-indigo-50' : 'text-gray-500 bg-gray-100',
          )}
        >
          {pr.merged ? <GitMerge size={10} /> : <GitPullRequest size={10} />}
          #{pr.number}
        </span>
      ))}
      {prs.length > 2 && <span className="text-[10px] text-gray-400">+{prs.length - 2}</span>}
    </span>
  );
}
