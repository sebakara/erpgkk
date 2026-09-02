'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { UserPlus, CheckCircle2, Clock, Layers } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { getInitials, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

type Contributor = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  job_title?: string;
  avatar_url?: string;
  role?: string;
  contributions: {
    total: number;
    done: number;
    in_progress: number;
    story_points_completed: number;
  };
};

export default function ProjectContributorsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const { data: contributors = [], isLoading } = useQuery<Contributor[]>({
    queryKey: ['project-contributors', projectId],
    queryFn: () => projectsApi.contributors(projectId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Contributors</h2>
          <p className="text-sm text-gray-500">
            Developers with access to this project, and the issues assigned to them.
          </p>
        </div>
        {canManage && (
          <Link
            href={`/projects/${projectId}/settings`}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
          >
            <UserPlus size={14} /> Grant access
          </Link>
        )}
      </div>

      {contributors.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <p className="font-medium text-gray-600">No one has access yet</p>
          <p className="mt-1 text-sm text-gray-400">
            {canManage
              ? 'Add a developer in Settings to give them access, then assign issues to track their contributions.'
              : 'Ask a manager to add you to this project.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {contributors.map((person) => {
            const c = person.contributions;
            const donePct = c.total ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <div key={person.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center shrink-0">
                    {getInitials(`${person.first_name} ${person.last_name}`)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {person.first_name} {person.last_name}
                  </p>
                  <p className="text-xs text-gray-400 truncate capitalize">
                    {person.role ?? 'member'}
                    {person.job_title ? ` · ${person.job_title}` : ''}
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden max-w-xs">
                    <div
                      className={cn('h-full rounded-full', donePct === 0 ? 'bg-gray-200' : 'bg-green-500')}
                      style={{ width: `${donePct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1" title="Assigned issues">
                    <Layers size={13} /> {c.total}
                  </span>
                  <span className="flex items-center gap-1 text-amber-600" title="In progress">
                    <Clock size={13} /> {c.in_progress}
                  </span>
                  <span className="flex items-center gap-1 text-green-600" title="Done">
                    <CheckCircle2 size={13} /> {c.done}
                  </span>
                  {c.story_points_completed > 0 && (
                    <span className="text-indigo-600 font-medium">{c.story_points_completed} pts</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
