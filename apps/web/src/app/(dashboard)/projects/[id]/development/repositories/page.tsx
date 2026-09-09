'use client';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Trash2, RefreshCw } from 'lucide-react';
import { githubApi, projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { DevSpinner, Empty } from '../ui';

export default function DevelopmentReposPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
  });
  const canManage = user?.role === 'admin' || user?.role === 'manager' || project?.owner_id === user?.id;

  const { data: repos = [], isLoading } = useQuery({
    queryKey: ['github-project-repos', id],
    queryFn: () => githubApi.projectRepos(id),
  });
  const { data: available = [] } = useQuery({
    queryKey: ['github-available-repos', id],
    queryFn: () => githubApi.availableRepos(id),
    enabled: canManage && adding,
  });

  const attachMutation = useMutation({
    mutationFn: (repository_id: string) => githubApi.attachRepo(id, repository_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-project-repos', id] });
      qc.invalidateQueries({ queryKey: ['github-available-repos', id] });
      qc.invalidateQueries({ queryKey: ['github-overview', id] });
      setAdding(false);
      toast.success('Repository attached');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to attach'),
  });

  const detachMutation = useMutation({
    mutationFn: (repoId: string) => githubApi.detachRepo(id, repoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-project-repos', id] });
      qc.invalidateQueries({ queryKey: ['github-overview', id] });
      toast.success('Repository detached');
    },
    onError: () => toast.error('Failed to detach'),
  });

  const chatMutation = useMutation({
    mutationFn: ({ repoId, notify_chat }: { repoId: string; notify_chat: boolean }) =>
      githubApi.updateProjectRepo(id, repoId, { notify_chat }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['github-project-repos', id] }),
  });

  const syncMutation = useMutation({
    mutationFn: () => githubApi.syncProject(id),
    onSuccess: (data: any) => toast.success(data?.errors?.length ? `Synced with ${data.errors.length} warning(s)` : 'Synced'),
    onError: () => toast.error('Sync failed'),
  });

  if (isLoading) return <DevSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Repositories</h2>
          <p className="text-sm text-gray-500">GitHub repos attached to this project.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || repos.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} /> Sync
            </button>
            <button
              onClick={() => setAdding((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
            >
              <Plus size={14} /> Attach
            </button>
          </div>
        )}
      </div>

      {adding && canManage && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Available from the company GitHub installation</p>
          {(available as any[]).length === 0 ? (
            <p className="text-sm text-gray-400">No more repositories to attach. Connect GitHub in Settings first, or they are already mapped.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {(available as any[]).map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => attachMutation.mutate(repo.id)}
                  className="w-full text-left px-2 py-2 text-sm hover:bg-gray-50 rounded-lg"
                >
                  <span className="font-medium text-gray-900">{repo.full_name}</span>
                  {repo.private && <span className="ml-2 text-[11px] text-gray-400">private</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {repos.length === 0 ? (
        <Empty title="No repositories yet" body={canManage ? 'Attach a repository from the company GitHub installation.' : 'Ask a manager to attach a GitHub repository.'} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {repos.map((repo: any) => (
            <div key={repo.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="flex-1 min-w-0">
                <a href={repo.html_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-gray-900 hover:underline inline-flex items-center gap-1">
                  {repo.full_name} <ExternalLink size={12} className="text-gray-400" />
                </a>
                <p className="text-xs text-gray-400">
                  {repo.private ? 'Private' : 'Public'}
                  {repo.archived ? ' · archived' : ''}
                  {repo.default_branch ? ` · ${repo.default_branch}` : ''}
                </p>
              </div>
              {canManage && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={!!repo.notify_chat}
                    onChange={(e) => chatMutation.mutate({ repoId: repo.id, notify_chat: e.target.checked })}
                  />
                  Chat
                </label>
              )}
              {canManage && (
                <button
                  onClick={() => { if (confirm(`Detach ${repo.full_name}?`)) detachMutation.mutate(repo.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
