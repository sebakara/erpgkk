'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Circle, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn, isOverdue } from '@/lib/utils';

const STATUS_ICON: Record<string, any> = {
  backlog: Circle, todo: Circle, in_progress: Clock, in_review: Clock, done: CheckCircle2,
};
const STATUS_COLOR: Record<string, string> = {
  backlog: 'text-gray-400', todo: 'text-blue-400', in_progress: 'text-amber-500',
  in_review: 'text-purple-500', done: 'text-green-500',
};

type MineIssue = {
  id: string;
  project_id: string;
  project_name?: string;
  project_icon?: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
  sprint_id?: string;
  sprint_name?: string;
  sprint_status?: string;
};

export default function MyWorkPage() {
  const user = useAuthStore((s) => s.user);
  const { data: overview, isLoading } = useQuery({
    queryKey: ['workspace-overview'],
    queryFn: projectsApi.overview,
  });

  const issues: MineIssue[] = overview?.mine_issues ?? [];

  const groups = useMemo(() => {
    const overdue: MineIssue[] = [];
    const thisSprint: MineIssue[] = [];
    const upNext: MineIssue[] = [];
    for (const issue of issues) {
      if (isOverdue(issue.due_date, issue.status)) overdue.push(issue);
      else if (issue.sprint_status === 'active') thisSprint.push(issue);
      else upNext.push(issue);
    }
    return [
      { key: 'overdue', label: 'Overdue', items: overdue },
      { key: 'sprint', label: 'This sprint', items: thisSprint },
      { key: 'next', label: 'Up next', items: upNext },
    ];
  }, [issues]);

  if (isLoading || !overview) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My work</h1>
        <p className="text-sm text-gray-500 mt-1">
          {overview.mine.open} open · {overview.mine.inProgress} in progress
          {overview.mine.overdue ? ` · ${overview.mine.overdue} overdue` : ''}
        </p>
      </div>

      {issues.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          Nothing assigned to you{user?.first_name ? `, ${user.first_name}` : ''}.
        </div>
      ) : (
        groups.filter((g) => g.items.length > 0).map((group) => (
          <section key={group.key}>
            <h2 className={cn(
              'text-xs font-semibold uppercase tracking-wide mb-2',
              group.key === 'overdue' ? 'text-red-600' : 'text-gray-400',
            )}>
              {group.label}
              <span className="ml-1.5 text-gray-400 font-medium">{group.items.length}</span>
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50 overflow-hidden">
              {group.items.map((issue) => {
                const Icon = STATUS_ICON[issue.status] ?? Circle;
                return (
                  <Link
                    key={issue.id}
                    href={`/projects/${issue.project_id}/board`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <Icon size={14} className={cn('shrink-0', STATUS_COLOR[issue.status])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{issue.title}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {issue.project_icon ? `${issue.project_icon} ` : ''}
                        {issue.project_name}
                        {issue.sprint_name ? ` · ${issue.sprint_name}` : ''}
                      </p>
                    </div>
                    {issue.due_date && (
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-medium shrink-0',
                        isOverdue(issue.due_date, issue.status) ? 'text-red-600' : 'text-gray-400',
                      )}>
                        {group.key === 'overdue' && <AlertTriangle size={11} />}
                        <Calendar size={11} />
                        {new Date(`${issue.due_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize shrink-0',
                      issue.priority === 'urgent' ? 'bg-red-100 text-red-700'
                        : issue.priority === 'high' ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-500',
                    )}>
                      {issue.priority}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
