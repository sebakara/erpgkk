'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, hrApi, issuesApi, leavePackagesApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, cn } from '@/lib/utils';
import {
  FolderOpen, Users, Calendar, CheckCircle2, Clock, Circle, Lock, ArrowRight, Megaphone, Settings, Package,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Issue, LeaveBalance, LeavePackage, LeaveRequest, Project, User } from '@/types';
import { ProjectPeople } from '@/components/projects/project-people';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  if (user?.role === 'employee') return <EmployeeDashboard user={user} />;
  if (user?.role === 'admin') return <CeoDashboard user={user} />;
  if (user?.role === 'hr') return <HrDashboard user={user} />;
  return <ManagerDashboard user={user} />;
}

function greeting(firstName?: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return firstName ? `${part}, ${firstName}` : part;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: string | number;
  icon: typeof FolderOpen;
  color: string;
  href?: string;
}) {
  const body = (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 h-full hover:border-gray-200 transition-colors">
      <div className={`${color} p-3 rounded-lg text-white shrink-0`}><Icon size={20} /></div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
      </div>
    </div>
  );
  if (!href) return body;
  return <Link href={href} className="block">{body}</Link>;
}

function PanelHeader({ title, href, linkLabel = 'View all' }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          {linkLabel} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  backlog: '#9ca3af',
  todo: '#3b82f6',
  in_progress: '#f59e0b',
  in_review: '#8b5cf6',
  done: '#10b981',
};

const LEAVE_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
};

type WorkspaceStats = {
  total: number;
  done: number;
  inProgress: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byProject: { id: string; name: string; total: number; done: number; open: number }[];
};

function toSlices(source: Record<string, number>, colors: Record<string, string>) {
  return Object.entries(source)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      key: name,
      value,
      color: colors[name] ?? '#9ca3af',
    }));
}

function DonutChart({
  title,
  data,
  empty = 'No data yet',
}: {
  title: string;
  data: { name: string; value: number; color: string }[];
  empty?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="font-semibold text-gray-900 mb-3">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 h-40 flex items-center justify-center">{empty}</p>
      ) : (
        <div className="flex items-center gap-4 min-h-[180px]">
          <PieChart width={160} height={160}>
            <Pie data={data} cx={80} cy={80} innerRadius={46} outerRadius={72} dataKey="value" paddingAngle={3}>
              {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          </PieChart>
          <div className="flex flex-col gap-1.5 min-w-0">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="capitalize text-gray-600 truncate">{d.name}</span>
                <span className="font-semibold text-gray-900 ml-auto pl-2 tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectLoadChart({ rows }: { rows: WorkspaceStats['byProject'] }) {
  const data = rows.map((row) => ({
    ...row,
    label: row.name.length > 18 ? `${row.name.slice(0, 16)}…` : row.name,
  }));
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="font-semibold text-gray-900 mb-3">Workload by project</h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 h-40 flex items-center justify-center">No issues yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={108} tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(value, name) => [Number(value ?? 0), name === 'open' ? 'Open' : 'Done'] as [number, string]}
              labelFormatter={(_label, payload) => {
                const row = payload?.[0]?.payload as { name?: string } | undefined;
                return row?.name ?? '';
              }}
            />
            <Bar dataKey="open" stackId="a" fill="#6366f1" name="open" radius={[0, 0, 0, 0]} />
            <Bar dataKey="done" stackId="a" fill="#c7d2fe" name="done" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function CeoDashboard({ user }: { user: any }) {
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });
  const { data: announcements = [] } = useQuery({ queryKey: ['announcements'], queryFn: hrApi.announcements.list });
  const { data: leaveSummary = [] } = useQuery({ queryKey: ['leave-summary'], queryFn: hrApi.leave.summary });
  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['leaves', 'all'],
    queryFn: () => hrApi.leave.list(),
  });
  const { data: people = [] } = useQuery<User[]>({ queryKey: ['employees'], queryFn: usersApi.list });
  const { data: stats } = useQuery<WorkspaceStats>({
    queryKey: ['workspace-stats'],
    queryFn: projectsApi.workspaceStats,
  });

  const activeProjects = projects.filter((p) => p.status === 'active');
  const teamCount = people.filter((p) => Boolean(p.is_active)).length;
  const pendingLeave = Number(leaveSummary.find((s: any) => s.status === 'pending')?.count ?? 0);
  const reportIds = new Set(people.filter((p) => p.reports_to === user?.id).map((p) => p.id));
  const reportsPending = leaveRequests.filter(
    (l) => l.status === 'pending' && (reportIds.has(l.user_id) || l.employee_reports_to === user?.id),
  );
  const pendingByDept = leaveRequests
    .filter((l) => l.status === 'pending')
    .reduce<Record<string, number>>((acc, req) => {
      const person = people.find((p) => p.id === req.user_id);
      const name = person?.department_name || 'Unassigned';
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {});
  const deptSlices = Object.entries(pendingByDept)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value,
      color: ['#6366f1', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'][i % 6],
    }));
  const unhealthy = (stats?.byProject ?? [])
    .filter((row) => row.open > 0)
    .sort((a, b) => b.open - a.open)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting(user?.first_name)} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Company pulse — see everything, step in when a head needs you</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="People" value={teamCount} icon={Users} color="bg-blue-500" href="/hr?tab=employees" />
        <StatCard label="Active projects" value={activeProjects.length} icon={FolderOpen} color="bg-indigo-500" href="/projects" />
        <StatCard label="Leave pending" value={pendingLeave} icon={Calendar} color="bg-amber-500" href="/hr?tab=overview" />
        <StatCard label="From your reports" value={reportsPending.length} icon={Users} color="bg-rose-500" href="/hr?tab=overview" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutChart title="Pending leave by department" data={deptSlices} empty="No pending leave" />
        <ProjectLoadChart rows={unhealthy} />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <PanelHeader title="Announcements" href="/hr" />
          {announcements.length === 0 ? (
            <p className="text-sm text-gray-400 h-40 flex items-center justify-center">No announcements</p>
          ) : (
            <div className="space-y-2">
              {announcements.slice(0, 5).map((a: any) => (
                <div key={a.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                    {a.is_pinned && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">Pinned</span>
                    )}
                  </div>
                  {a.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.body}</p>}
                  <p className="text-[11px] text-gray-400 mt-1">{a.author_name} · {formatDate(a.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <PanelHeader title="Project health" href="/projects" />
          {projectsLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : unhealthy.length === 0 ? (
            <p className="text-gray-400 text-sm">No open work across projects</p>
          ) : (
            <div className="space-y-1 max-h-[28rem] overflow-y-auto">
              {unhealthy.map((row) => {
                const project = projects.find((p) => p.id === row.id);
                const pct = row.total ? Math.round((row.done / row.total) * 100) : 0;
                return (
                  <Link
                    key={row.id}
                    href={`/projects/${row.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-xl w-8 text-center shrink-0">{project?.icon || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{row.name}</p>
                      <p className="text-xs text-gray-400">{row.open} open · {pct}% done</p>
                    </div>
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Link
            href="/settings"
            className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 hover:bg-slate-100/80 transition-colors"
          >
            <div className="p-2 bg-slate-800 text-white rounded-lg shrink-0"><Settings size={16} /></div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-950 text-sm">Company settings</p>
              <p className="text-xs text-slate-600">Departments, heads, and roles</p>
            </div>
            <ArrowRight size={14} className="text-slate-400 shrink-0" />
          </Link>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <PanelHeader title="Leave from your reports" href="/hr?tab=overview" />
            <p className="text-xs text-gray-400 mb-3">Heads and HR handle the rest. You can still override any request.</p>
            {reportsPending.length === 0 ? (
              <p className="text-gray-400 text-sm">No pending leave from people who report to you</p>
            ) : (
              <div className="space-y-2">
                {reportsPending.slice(0, 6).map((req) => (
                  <Link
                    key={req.id}
                    href="/hr?tab=overview"
                    className="block p-2.5 rounded-lg bg-amber-50/70 border border-amber-100 hover:bg-amber-50"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{req.employee_name ?? 'Team member'}</p>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">
                      {req.type} · {formatDate(req.start_date)} – {formatDate(req.end_date)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HrDashboard({ user }: { user: any }) {
  const qc = useQueryClient();
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', is_pinned: false });
  const { data: announcements = [] } = useQuery({ queryKey: ['announcements'], queryFn: hrApi.announcements.list });
  const { data: leaveSummary = [] } = useQuery({ queryKey: ['leave-summary'], queryFn: hrApi.leave.summary });
  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['leaves', 'all'],
    queryFn: () => hrApi.leave.list(),
  });
  const { data: people = [] } = useQuery<User[]>({ queryKey: ['employees'], queryFn: usersApi.list });
  const { data: packages = [] } = useQuery<LeavePackage[]>({
    queryKey: ['leave-packages'],
    queryFn: leavePackagesApi.list,
  });
  const createAnnouncement = useMutation({
    mutationFn: () => hrApi.announcements.create(announcementForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setAnnouncementForm({ title: '', body: '', is_pinned: false });
      toast.success('Announcement posted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to post announcement'),
  });

  const activePeople = people.filter((p) => Boolean(p.is_active));
  const pendingLeave = Number(leaveSummary.find((s: any) => s.status === 'pending')?.count ?? 0);
  const pendingRequests = leaveRequests.filter((l) => l.status === 'pending');
  const allocatedIds = new Set(packages.flatMap((pkg) => pkg.allocated_user_ids ?? []));
  const withoutPackage = activePeople.filter((p) => !allocatedIds.has(p.id));
  const recentHires = [...activePeople]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);
  const leaveSlices = toSlices(
    leaveRequests.reduce<Record<string, number>>((acc, req) => {
      acc[req.status] = (acc[req.status] ?? 0) + 1;
      return acc;
    }, {}),
    LEAVE_COLORS,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting(user?.first_name)} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">People, leave, and packages — not the project board</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Post an announcement</h2>
        <div className="space-y-2">
          <input
            value={announcementForm.title}
            onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
            placeholder="Title"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <textarea
            value={announcementForm.body}
            onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
            placeholder="Message for the company"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={announcementForm.is_pinned}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, is_pinned: e.target.checked })}
              />
              Pin to top
            </label>
            <button
              type="button"
              onClick={() => createAnnouncement.mutate()}
              disabled={!announcementForm.title.trim() || !announcementForm.body.trim() || createAnnouncement.isPending}
              className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700"
            >
              {createAnnouncement.isPending ? 'Posting…' : 'Post announcement'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="People" value={activePeople.length} icon={Users} color="bg-blue-500" href="/hr?tab=employees" />
        <StatCard label="Leave queue" value={pendingLeave} icon={Calendar} color="bg-amber-500" href="/hr?tab=overview" />
        <StatCard label="No package" value={withoutPackage.length} icon={Package} color="bg-rose-500" href="/hr?tab=leave-packages" />
        <StatCard label="Packages" value={packages.length} icon={CheckCircle2} color="bg-emerald-500" href="/hr?tab=leave-packages" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <PanelHeader title="Pending leave" href="/hr?tab=overview" />
          {pendingRequests.length === 0 ? (
            <p className="text-gray-400 text-sm">Queue is clear</p>
          ) : (
            <div className="space-y-2">
              {pendingRequests.slice(0, 8).map((req) => (
                <Link
                  key={req.id}
                  href="/hr?tab=overview"
                  className="block p-2.5 rounded-lg bg-amber-50/70 border border-amber-100 hover:bg-amber-50"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{req.employee_name ?? 'Team member'}</p>
                  <p className="text-xs text-gray-500 capitalize mt-0.5">
                    {req.type} · {formatDate(req.start_date)} – {formatDate(req.end_date)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
        <DonutChart title="Leave requests" data={leaveSlices} empty="No leave requests" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <PanelHeader title="Recent people" href="/hr?tab=employees" />
          {recentHires.length === 0 ? (
            <p className="text-gray-400 text-sm">No people yet</p>
          ) : (
            <div className="space-y-1">
              {recentHires.map((p) => (
                <Link
                  key={p.id}
                  href="/hr?tab=employees"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-gray-400 truncate">{p.job_title || p.role} · {p.department_name || 'No department'}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0">{formatDate(p.created_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <PanelHeader title="Need a package" href="/hr?tab=leave-packages" />
            {withoutPackage.length === 0 ? (
              <p className="text-gray-400 text-sm">Everyone has a package</p>
            ) : (
              <div className="space-y-2">
                {withoutPackage.slice(0, 8).map((p) => (
                  <Link
                    key={p.id}
                    href="/hr?tab=leave-packages"
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-rose-50/70 border border-rose-100 hover:bg-rose-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-gray-500 truncate">{p.job_title || p.role}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-rose-600 shrink-0">Allocate</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <PanelHeader title="Recent announcements" href="/hr" />
            {announcements.length === 0 ? (
              <p className="text-gray-400 text-sm">None posted yet — use the form at the top</p>
            ) : (
              <div className="space-y-2">
                {announcements.slice(0, 4).map((a: any) => (
                  <div key={a.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                      {a.is_pinned && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">Pinned</span>
                      )}
                    </div>
                    {a.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.body}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{a.author_name} · {formatDate(a.created_at)}</p>
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

function ManagerDashboard({ user }: { user: any }) {
  const canStandup = user?.role === 'manager';
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });
  const { data: announcements = [] } = useQuery({ queryKey: ['announcements'], queryFn: hrApi.announcements.list });
  const { data: leaveSummary = [] } = useQuery({ queryKey: ['leave-summary'], queryFn: hrApi.leave.summary });
  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['leaves'],
    queryFn: () => hrApi.leave.list(),
  });
  const { data: people = [] } = useQuery<User[]>({ queryKey: ['employees'], queryFn: usersApi.list });
  const { data: stats } = useQuery<WorkspaceStats>({
    queryKey: ['workspace-stats'],
    queryFn: projectsApi.workspaceStats,
  });

  const activeProjects = projects.filter((p) => p.status === 'active');
  const teamCount = people.filter((p) => Boolean(p.is_active)).length;
  const pendingLeave = Number(leaveSummary.find((s: any) => s.status === 'pending')?.count ?? 0);
  const pendingRequests = leaveRequests.filter((l) => l.status === 'pending').slice(0, 5);
  const statusSlices = toSlices(stats?.byStatus ?? {}, STATUS_COLORS);
  const leaveSlices = toSlices(
    leaveRequests.reduce<Record<string, number>>((acc, req) => {
      acc[req.status] = (acc[req.status] ?? 0) + 1;
      return acc;
    }, {}),
    LEAVE_COLORS,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting(user?.first_name)} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Projects, people, and what needs a decision today</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active projects" value={activeProjects.length} icon={FolderOpen} color="bg-indigo-500" href="/projects" />
        <StatCard label="Team members" value={teamCount} icon={Users} color="bg-blue-500" href="/hr" />
        <StatCard label="Leave pending" value={pendingLeave} icon={Calendar} color="bg-amber-500" href="/hr" />
        <StatCard label="Announcements" value={announcements.length} icon={Megaphone} color="bg-violet-500" href="/hr" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutChart title="Issues by status" data={statusSlices} empty="No issues across your projects" />
        <ProjectLoadChart rows={stats?.byProject ?? []} />
        <DonutChart title="Leave requests" data={leaveSlices} empty="No leave requests" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <PanelHeader title="Projects" href="/projects" />
          {projectsLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-gray-400 text-sm">No projects yet</p>
          ) : (
            <div className="space-y-1 max-h-[28rem] overflow-y-auto">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xl w-8 text-center shrink-0">{p.icon || '📁'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {p.status}
                      {p.members?.length ? ` · ${p.members.length} with access` : ''}
                    </p>
                  </div>
                  <ProjectPeople people={p.members} max={4} href={`/projects/${p.id}/contributors`} />
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'active' ? 'bg-green-400' : 'bg-gray-300'}`} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {canStandup && (
            <Link
              href="/hr?tab=standup-notes"
              className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 hover:bg-indigo-100/70 transition-colors"
            >
              <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0"><Lock size={16} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-indigo-950 text-sm">Standup notes</p>
                <p className="text-xs text-indigo-700/80">Private notes for today&apos;s developers</p>
              </div>
              <ArrowRight size={14} className="text-indigo-500 shrink-0" />
            </Link>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <PanelHeader title="Leave to review" href="/hr" />
            {pendingRequests.length === 0 ? (
              <p className="text-gray-400 text-sm">No pending requests</p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <Link
                    key={req.id}
                    href="/hr"
                    className="block p-2.5 rounded-lg bg-amber-50/70 border border-amber-100 hover:bg-amber-50"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{req.employee_name ?? 'Team member'}</p>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">
                      {req.type} · {formatDate(req.start_date)} – {formatDate(req.end_date)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <PanelHeader title="Announcements" href="/hr" />
            {announcements.length === 0 ? (
              <p className="text-gray-400 text-sm">No announcements</p>
            ) : (
              <div className="space-y-2">
                {announcements.slice(0, 4).map((a: any) => (
                  <div key={a.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                      {a.is_pinned && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">Pinned</span>
                      )}
                    </div>
                    {a.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.body}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{a.author_name} · {formatDate(a.created_at)}</p>
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

const STATUS_ICON: Record<string, typeof Circle> = {
  backlog: Circle, todo: Circle, in_progress: Clock, in_review: Clock, done: CheckCircle2,
};
const STATUS_COLOR: Record<string, string> = {
  backlog: 'text-gray-400', todo: 'text-blue-400', in_progress: 'text-amber-500',
  in_review: 'text-purple-500', done: 'text-green-500',
};

function EmployeeDashboard({ user }: { user: any }) {
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: projectsApi.list });
  const { data: announcements = [] } = useQuery({ queryKey: ['announcements'], queryFn: hrApi.announcements.list });
  const { data: balance = [] } = useQuery<LeaveBalance[]>({ queryKey: ['leave-balance', 'mine'], queryFn: leavePackagesApi.myBalance });
  const { data: myLeave = [] } = useQuery({ queryKey: ['leaves', 'mine'], queryFn: hrApi.leave.mine });

  const myProjectIds: string[] = projects.map((p) => p.id);
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
  const pendingLeave = (myLeave as LeaveRequest[]).filter((l) => l.status === 'pending').length;
  const { data: stats } = useQuery<WorkspaceStats>({
    queryKey: ['workspace-stats'],
    queryFn: projectsApi.workspaceStats,
  });
  const statusSlices = toSlices(stats?.byStatus ?? {}, STATUS_COLORS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting(user?.first_name)} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Your projects and open work</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="In progress" value={inProgress.length} icon={Clock} color="bg-amber-500" />
        <StatCard label="To do" value={upcoming.length} icon={Circle} color="bg-blue-500" />
        <StatCard label="My projects" value={projects.length} icon={FolderOpen} color="bg-indigo-500" href="/projects" />
        <StatCard label="Leave pending" value={pendingLeave} icon={Calendar} color="bg-rose-500" href="/hr" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DonutChart title="My issues by status" data={statusSlices} empty="No issues assigned to you" />
        <ProjectLoadChart rows={stats?.byProject ?? []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <PanelHeader title="My projects" href="/projects" />
            {projects.length === 0 ? (
              <p className="text-gray-400 text-sm">You do not have access to a project yet</p>
            ) : (
              <div className="space-y-1">
                {projects.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-xl w-8 text-center shrink-0">{p.icon || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{p.status}</p>
                    </div>
                    <ProjectPeople people={p.members} max={4} href={`/projects/${p.id}/contributors`} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <PanelHeader title="My open tasks" />
            {myIssues.length === 0 ? (
              <p className="text-gray-400 text-sm">No open tasks assigned to you</p>
            ) : (
              <div className="space-y-1">
                {myIssues.slice(0, 10).map((issue) => {
                  const Icon = STATUS_ICON[issue.status] ?? Circle;
                  const project = projects.find((p) => p.id === issue.project_id);
                  return (
                    <Link
                      key={issue.id}
                      href={`/projects/${issue.project_id}/issues`}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
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
        </div>

        <div className="space-y-4">
          {balance.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Leave balance</h2>
              <div className="space-y-2">
                {balance.map((b) => (
                  <div key={b.leave_type} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 capitalize">{b.leave_type}</span>
                    <span className="font-semibold text-gray-900">
                      {b.days_remaining} <span className="text-gray-400 font-normal">/ {b.days_allowed} days</span>
                    </span>
                  </div>
                ))}
              </div>
              <Link href="/hr" className="mt-3 block text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                Request leave →
              </Link>
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
                    {a.body && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>}
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
