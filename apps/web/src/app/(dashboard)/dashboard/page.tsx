'use client';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, hrApi, issuesApi, leavePackagesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, cn } from '@/lib/utils';
import { FolderOpen, Users, Calendar, TrendingUp, CheckCircle2, Clock, Circle } from 'lucide-react';
import Link from 'next/link';
import type { Issue, LeaveBalance, Project } from '@/types';
import { ProjectPeople } from '@/components/projects/project-people';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isEmployee = user?.role === 'employee';

  return isEmployee ? <EmployeeDashboard user={user} /> : <ManagerDashboard user={user} />;
}

/* ── Manager / Admin dashboard (unchanged) ─────────────────────────────── */
function ManagerDashboard({ user }: { user: any }) {
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: projectsApi.list });
  const { data: announcements = [] } = useQuery({ queryKey: ['announcements'], queryFn: hrApi.announcements.list });
  const { data: leaveSummary = [] } = useQuery({ queryKey: ['leave-summary'], queryFn: hrApi.leave.summary });

  const stats = [
    { label: 'My Projects', value: projects.length, icon: FolderOpen, color: 'bg-indigo-500' },
    { label: 'Active Sprints', value: projects.length, icon: TrendingUp, color: 'bg-green-500' },
    { label: 'Leave Pending', value: leaveSummary.find((s: any) => s.status === 'pending')?.count || 0, icon: Calendar, color: 'bg-amber-500' },
    { label: 'Team Members', value: '-', icon: Users, color: 'bg-blue-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Good morning, {user?.first_name} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Here's what's happening across your workspace</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`${color} p-3 rounded-lg text-white`}><Icon size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Projects</h2>
          {projects.length === 0 ? (
            <p className="text-gray-400 text-sm">No projects yet</p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 5).map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-xl">{p.icon || '📁'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{p.status}</p>
                  </div>
                  <ProjectPeople people={p.members} max={4} />
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'active' ? 'bg-green-400' : 'bg-gray-300'}`} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Announcements</h2>
          {announcements.length === 0 ? (
            <p className="text-gray-400 text-sm">No announcements</p>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 5).map((a: any) => (
                <div key={a.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                    {a.is_pinned && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Pinned</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{a.author_name} · {formatDate(a.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Employee dashboard ─────────────────────────────────────────────────── */
const STATUS_ICON: Record<string, any> = {
  backlog: Circle, todo: Circle, in_progress: Clock, in_review: Clock, done: CheckCircle2,
};
const STATUS_COLOR: Record<string, string> = {
  backlog: 'text-gray-400', todo: 'text-blue-400', in_progress: 'text-amber-500',
  in_review: 'text-purple-500', done: 'text-green-500',
};

function EmployeeDashboard({ user }: { user: any }) {
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const { data: announcements = [] } = useQuery({ queryKey: ['announcements'], queryFn: hrApi.announcements.list });
  const { data: balance = [] } = useQuery<LeaveBalance[]>({ queryKey: ['leave-balance', 'mine'], queryFn: leavePackagesApi.myBalance });
  const { data: myLeave = [] } = useQuery({ queryKey: ['leaves', 'mine'], queryFn: hrApi.leave.mine });

  // Fetch issues from all my projects and flatten
  const myProjectIds: string[] = projects.map((p: any) => p.id);
  const issueQueries = useQuery<Issue[]>({
    queryKey: ['my-issues-all', myProjectIds.join(',')],
    queryFn: async () => {
      if (!myProjectIds.length) return [];
      const results = await Promise.all(myProjectIds.map((pid) => issuesApi.list(pid)));
      return results.flat();
    },
    enabled: myProjectIds.length > 0,
  });
  const myIssues: Issue[] = (issueQueries.data ?? []).filter((i) => i.status !== 'done');
  const inProgress = myIssues.filter((i) => i.status === 'in_progress' || i.status === 'in_review');
  const upcoming = myIssues.filter((i) => i.status === 'todo' || i.status === 'backlog');

  const pendingLeave = (myLeave as any[]).filter((l) => l.status === 'pending').length;

  const stats = [
    { label: 'In Progress', value: inProgress.length, icon: Clock, color: 'bg-amber-500' },
    { label: 'To Do', value: upcoming.length, icon: Circle, color: 'bg-blue-500' },
    { label: 'My Projects', value: projects.length, icon: FolderOpen, color: 'bg-indigo-500' },
    { label: 'Leave Pending', value: pendingLeave, icon: Calendar, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Good morning, {user?.first_name} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Here's your work for today</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`${color} p-3 rounded-lg text-white`}><Icon size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My tasks */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">My Open Tasks</h2>
          {myIssues.length === 0 ? (
            <p className="text-gray-400 text-sm">No open tasks assigned to you</p>
          ) : (
            <div className="space-y-1">
              {myIssues.slice(0, 10).map((issue) => {
                const Icon = STATUS_ICON[issue.status] ?? Circle;
                const project = projects.find((p: any) => p.id === issue.project_id);
                return (
                  <Link
                    key={issue.id}
                    href={`/projects/${issue.project_id}/issues`}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <Icon size={14} className={cn('shrink-0', STATUS_COLOR[issue.status])} />
                    <span className="flex-1 text-sm text-gray-800 truncate">{issue.title}</span>
                    {project && (
                      <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{project.name}</span>
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
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Leave balance */}
          {balance.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Leave Balance</h2>
              <div className="space-y-2">
                {balance.map((b) => (
                  <div key={b.leave_type} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 capitalize">{b.leave_type}</span>
                    <span className="font-semibold text-gray-900">{b.days_remaining} <span className="text-gray-400 font-normal">/ {b.days_allowed} days</span></span>
                  </div>
                ))}
              </div>
              <Link href="/hr" className="mt-3 block text-xs text-indigo-600 hover:text-indigo-700 font-medium">Request leave →</Link>
            </div>
          )}

          {/* Announcements */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Announcements</h2>
            {announcements.length === 0 ? (
              <p className="text-gray-400 text-sm">No announcements</p>
            ) : (
              <div className="space-y-2">
                {announcements.slice(0, 3).map((a: any) => (
                  <div key={a.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="font-medium text-gray-900 text-xs">{a.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(a.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
