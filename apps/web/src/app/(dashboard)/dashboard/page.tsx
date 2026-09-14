'use client';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, hrApi, leavePackagesApi, githubApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, cn } from '@/lib/utils';
import {
  FolderOpen, Calendar, GitPullRequest, GitCommit, Github, Clock, Circle, CheckCircle2,
  GitBranch, Layers,
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import type { LeaveBalance } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  backlog: '#9ca3af',
  todo: '#3b82f6',
  in_progress: '#f59e0b',
  in_review: '#8b5cf6',
  done: '#10b981',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: '#9ca3af',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};
const TYPE_COLORS: Record<string, string> = {
  bug: '#ef4444',
  task: '#3b82f6',
  story: '#10b981',
  epic: '#8b5cf6',
};
const PR_COLORS: Record<string, string> = {
  Open: '#3b82f6',
  Merged: '#10b981',
  Closed: '#9ca3af',
};
const STATUS_ICON: Record<string, any> = {
  backlog: Circle, todo: Circle, in_progress: Clock, in_review: Clock, done: CheckCircle2,
};
const STATUS_COLOR: Record<string, string> = {
  backlog: 'text-gray-400', todo: 'text-blue-400', in_progress: 'text-amber-500',
  in_review: 'text-purple-500', done: 'text-green-500',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isEmployee = user?.role === 'employee';

  const { data: overview, isLoading } = useQuery({
    queryKey: ['workspace-overview'],
    queryFn: projectsApi.overview,
  });
  const { data: github } = useQuery({
    queryKey: ['github-dashboard'],
    queryFn: githubApi.githubDashboard,
  });
  const { data: announcements = [] } = useQuery({ queryKey: ['announcements'], queryFn: hrApi.announcements.list });
  const { data: leaveSummary = [] } = useQuery({
    queryKey: ['leave-summary'],
    queryFn: hrApi.leave.summary,
    enabled: !isEmployee,
  });
  const { data: balance = [] } = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balance', 'mine'],
    queryFn: leavePackagesApi.myBalance,
    enabled: isEmployee,
  });
  const { data: myLeave = [] } = useQuery({
    queryKey: ['leaves', 'mine'],
    queryFn: hrApi.leave.mine,
    enabled: isEmployee,
  });

  if (isLoading || !overview) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const leavePending = isEmployee
    ? (myLeave as any[]).filter((l) => l.status === 'pending').length
    : leaveSummary.find((s: any) => s.status === 'pending')?.count || 0;

  const health = overview.issues.total === 0
    ? 100
    : Math.round((overview.issues.done / overview.issues.total) * 100);

  const statusData = Object.entries(overview.issues.byStatus as Record<string, number>).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
    color: STATUS_COLORS[name] ?? '#9ca3af',
  }));
  const priorityData = Object.entries(overview.issues.byPriority as Record<string, number>).map(([name, value]) => ({
    name,
    value,
    color: PRIORITY_COLORS[name] ?? '#9ca3af',
  }));
  const typeData = Object.entries(overview.issues.byType as Record<string, number>).map(([name, value]) => ({
    name,
    value,
    color: TYPE_COLORS[name] ?? '#9ca3af',
  }));
  const createdData = (overview.issues.created_last_14d as Array<{ date: string; count: number }>).map((d) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
  const projectBars = (overview.byProject as any[])
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((p) => ({ name: p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name, open: p.open, done: p.done }));
  const commitData = ((github?.commits_by_day as Array<{ date: string; count: number }>) ?? []).map((d) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
  const hasCommits = commitData.some((d) => d.count > 0);
  const prStateData = ((github?.prs_by_state as Array<{ name: string; value: number }>) ?? [])
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, color: PR_COLORS[d.name] ?? '#9ca3af' }));

  const stats = isEmployee
    ? [
        { label: 'In Progress', value: overview.mine.inProgress, icon: Clock, color: 'bg-amber-500' },
        { label: 'To Do', value: overview.mine.todo, icon: Circle, color: 'bg-blue-500' },
        { label: 'Open GitHub PRs', value: github?.open_prs ?? 0, icon: GitPullRequest, color: 'bg-slate-800' },
        { label: 'Leave pending', value: leavePending, icon: Calendar, color: 'bg-rose-500' },
      ]
    : [
        { label: 'Projects', value: overview.projects.total, icon: FolderOpen, color: 'bg-indigo-500' },
        { label: 'Open issues', value: overview.issues.open, icon: Layers, color: 'bg-blue-500' },
        { label: 'Open GitHub PRs', value: github?.open_prs ?? 0, icon: GitPullRequest, color: 'bg-slate-800' },
        { label: 'Merged (30d)', value: github?.merged_prs_30d ?? 0, icon: GitCommit, color: 'bg-green-600' },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Good morning, {user?.first_name} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">
          {overview.projects.total} active workspace project{overview.projects.total === 1 ? '' : 's'}
          {github?.connected
            ? ` · ${github.organizations.map((o: any) => o.login).join(', ')}`
            : ''}
        </p>
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

      {user?.role === 'admin' && github?.connected && github.unmapped_project_count > 0 && (
        <Link
          href="/projects"
          className="block text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 hover:bg-amber-100/60"
        >
          {github.unmapped_project_count} project{github.unmapped_project_count === 1 ? '' : 's'} have no GitHub
          repository yet. Open a project → Development → Repositories → Attach.
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center gap-2">
          <p className="text-sm font-semibold text-gray-700">Workspace health</p>
          <HealthRing score={health} />
          <p className="text-xs text-gray-400 text-center">
            {overview.issues.done} of {overview.issues.total} issues done
            {!isEmployee && leavePending > 0 ? ` · ${leavePending} leave pending` : ''}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-gray-700 mb-4">Issues by status</p>
          {statusData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <PieChart width={180} height={180}>
                <Pie data={statusData} cx={85} cy={85} innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="flex flex-col gap-2 min-w-[140px]">
                {statusData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="capitalize text-gray-600">{d.name}</span>
                    <span className="font-semibold text-gray-900 ml-auto pl-4">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Issues opened (14 days)</p>
          {createdData.every((d) => d.count === 0) ? (
            <EmptyChart message="No new issues in the last 14 days." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={createdData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Area type="monotone" dataKey="count" name="Issues" stroke="#6366f1" fill="#e0e7ff" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Github size={14} /> Commits (14 days)
          </p>
          {!github?.connected ? (
            <EmptyChart message="Connect GitHub in Settings → Integrations." />
          ) : !hasCommits ? (
            <EmptyChart message="No commits on mapped repos yet. Sync GitHub from Settings." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={commitData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="count" name="Commits" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {projectBars.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">Issues by project</p>
            <Link href="/projects" className="text-xs text-indigo-600 font-medium hover:underline">View all</Link>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(180, projectBars.length * 36)}>
            <BarChart data={projectBars} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={120} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="done" stackId="a" fill="#10b981" name="Done" radius={[0, 0, 0, 0]} />
              <Bar dataKey="open" stackId="a" fill="#c7d2fe" name="Open" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Issues by priority</p>
          {priorityData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priorityData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={55} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">
            {prStateData.length ? 'Pull requests' : 'Issues by type'}
          </p>
          {prStateData.length > 0 ? (
            <div className="flex items-center gap-4 flex-wrap">
              <PieChart width={160} height={160}>
                <Pie data={prStateData} cx={75} cy={75} innerRadius={42} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {prStateData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="flex flex-col gap-2">
                {prStateData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-gray-600">{d.name}</span>
                    <span className="font-semibold text-gray-900 ml-auto pl-4">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : typeData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={55} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {typeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isEmployee ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">My open tasks</h2>
            {(overview.mine_issues as any[]).length === 0 ? (
              <p className="text-gray-400 text-sm">No open tasks assigned to you</p>
            ) : (
              <div className="space-y-1">
                {(overview.mine_issues as any[]).map((issue) => {
                  const Icon = STATUS_ICON[issue.status] ?? Circle;
                  const project = (overview.byProject as any[]).find((p) => p.id === issue.project_id);
                  return (
                    <Link
                      key={issue.id}
                      href={`/projects/${issue.project_id}/issues`}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Icon size={14} className={cn('shrink-0', STATUS_COLOR[issue.status])} />
                      <span className="flex-1 text-sm text-gray-800 truncate">{issue.title}</span>
                      {project && <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{project.name}</span>}
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
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Projects</h2>
              <Link href="/projects" className="text-xs text-indigo-600 font-medium hover:underline">View all</Link>
            </div>
            {(overview.byProject as any[]).length === 0 ? (
              <p className="text-gray-400 text-sm">No projects yet</p>
            ) : (
              <div className="space-y-2">
                {(overview.byProject as any[]).slice(0, 8).map((p) => (
                  <Link
                    key={p.id}
                    href={p.github_repos ? `/projects/${p.id}/development` : `/projects/${p.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-xl">{p.icon || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.done}/{p.total || 0} done · {p.health}% health</p>
                    </div>
                    {p.github_repos > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                        <GitBranch size={11} /> {p.github_repos}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">No GitHub</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <GitHubActivityCard github={github} />
          {isEmployee && balance.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Leave balance</h2>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Announcements</h2>
            {announcements.length === 0 ? (
              <p className="text-gray-400 text-sm">No announcements</p>
            ) : (
              <div className="space-y-2">
                {announcements.slice(0, 3).map((a: any) => (
                  <div key={a.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="font-medium text-gray-900 text-xs">{a.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{a.author_name ? `${a.author_name} · ` : ''}{formatDate(a.created_at)}</p>
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

function HealthRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'At risk' : 'Critical';
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="12" />
      <circle
        cx="64" cy="64" r={radius}
        fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{score}%</text>
      <text x="64" y="76" textAnchor="middle" fontSize="11" fill="#6b7280">{label}</text>
    </svg>
  );
}

function EmptyChart({ message = 'No data yet.' }: { message?: string }) {
  return <div className="flex items-center justify-center h-28 text-sm text-gray-400">{message}</div>;
}

function GitHubActivityCard({ github }: { github: any }) {
  if (!github) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">GitHub</h2>
        <p className="text-gray-400 text-sm">Loading development activity…</p>
      </div>
    );
  }
  if (!github.connected) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Github size={16} /> GitHub</h2>
        <p className="text-sm text-gray-500">GitHub is not connected yet. Admins can connect organizations in Settings → Integrations.</p>
      </div>
    );
  }
  if (!github.mapped_repo_count) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Github size={16} /> GitHub</h2>
        <p className="text-sm text-gray-500">
          {github.organizations.length} organization{github.organizations.length === 1 ? '' : 's'} connected.
          Attach repositories on a project’s Development tab to see PRs and commits here.
        </p>
      </div>
    );
  }

  const prs = github.recent_pull_requests ?? [];
  const commits = github.recent_commits ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Github size={16} /> Development</h2>
        <p className="text-xs text-gray-400">{github.mapped_repo_count} mapped repos</p>
      </div>
      <div className="space-y-3">
        {prs.slice(0, 4).map((pr: any) => (
          <a key={pr.id} href={pr.html_url} target="_blank" rel="noreferrer" className="block rounded-lg hover:bg-gray-50 px-1 py-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {pr.repository}#{pr.number} {pr.title}
            </p>
            <p className="text-xs text-gray-400">
              {pr.author_login ?? 'unknown'} · {pr.merged ? 'merged' : pr.state} · {formatDate(pr.github_updated_at)}
            </p>
          </a>
        ))}
        {prs.length === 0 && commits.slice(0, 4).map((c: any) => (
          <a key={c.id} href={c.html_url} target="_blank" rel="noreferrer" className="block rounded-lg hover:bg-gray-50 px-1 py-1">
            <p className="text-sm font-medium text-gray-900 truncate">{c.message}</p>
            <p className="text-xs text-gray-400">
              {c.author_login || c.author_name || 'unknown'} · {c.repository} · {formatDate(c.committed_at)}
            </p>
          </a>
        ))}
        {prs.length === 0 && commits.length === 0 && (
          <p className="text-sm text-gray-400">No recent pull requests or commits. Sync GitHub from Settings.</p>
        )}
      </div>
    </div>
  );
}
