'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import Link from 'next/link';
import { projectsApi } from '@/lib/api';
import { TrendingUp, CheckCircle, Clock, Layers, Github, GitPullRequest, GitCommit, GitMerge, Link2 } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';

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

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function HealthRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'At Risk' : 'Critical';
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="12" />
        <circle
          cx="64" cy="64" r={radius}
          fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="64" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{score}%</text>
        <text x="64" y="76" textAnchor="middle" fontSize="11" fill="#6b7280">{label}</text>
      </svg>
    </div>
  );
}

export default function AnalyticsPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', projectId],
    queryFn: () => projectsApi.analytics(projectId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">No analytics data.</p>;

  const statusData = Object.entries(data.byStatus as Record<string, number>).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
    color: STATUS_COLORS[name] ?? '#9ca3af',
  }));

  const priorityData = Object.entries(data.byPriority as Record<string, number>).map(([name, value]) => ({
    name,
    value,
    color: PRIORITY_COLORS[name] ?? '#9ca3af',
  }));

  const typeData = Object.entries(data.byType as Record<string, number>).map(([name, value]) => ({
    name,
    value,
    color: TYPE_COLORS[name] ?? '#9ca3af',
  }));

  const velocity = (data.velocity as any[]) ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Analytics</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={<Layers size={18} />}
          label="Total Issues"
          value={data.total}
          color="blue"
        />
        <KpiCard
          icon={<CheckCircle size={18} />}
          label="Completed"
          value={data.done}
          color="green"
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="In Progress"
          value={data.inProgress}
          color="amber"
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Sprints"
          value={data.sprintCount}
          color="purple"
        />
      </div>

      <GitHubSection projectId={projectId} github={data.github} />

      {/* Health + Status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health ring */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center gap-3">
          <p className="text-sm font-semibold text-gray-700">Project Health</p>
          <HealthRing score={data.health} />
          <p className="text-xs text-gray-400 text-center">Based on % of issues completed</p>
        </div>

        {/* Status pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-gray-700 mb-4">Issues by Status</p>
          {statusData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <PieChart width={180} height={180}>
                <Pie data={statusData} cx={85} cy={85} innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="flex flex-col gap-2">
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

      {/* Sprint velocity bar chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Sprint Velocity (Story Points)</p>
        {velocity.length === 0 ? (
          <EmptyChart message="No sprints yet." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={velocity} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="sprint" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(val: number, name: string) => [val, name === 'completed' ? 'Completed pts' : 'Total pts']}
              />
              <Bar dataKey="total" fill="#e0e7ff" name="total" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" fill="#6366f1" name="completed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {velocity.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {velocity.map((row: any) => (
              <div key={row.sprint} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-800 truncate">{row.sprint}</span>
                <span className="ml-auto shrink-0">{row.issues_done ?? 0}/{row.issues_total ?? 0} · {row.pct ?? 0}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Priority + Type breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Issues by Priority</p>
          {priorityData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priorityData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
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
          <p className="text-sm font-semibold text-gray-700 mb-4">Issues by Type</p>
          {typeData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
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
    </div>
  );
}

function GitHubSection({ projectId, github }: { projectId: string; github?: any }) {
  if (!github?.repo_count) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <Github size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">GitHub activity</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Attach a repository in Development to see commits, pull requests, and linked PRs here.
          </p>
          <Link href={`/projects/${projectId}/development/repositories`} className="inline-block mt-2 text-sm font-medium text-indigo-600 hover:underline">
            Open repositories
          </Link>
        </div>
      </div>
    );
  }

  const commitData = ((github.commits_by_day as Array<{ date: string; count: number }>) ?? []).map((d) => ({
    ...d,
    label: dayLabel(d.date),
  }));
  const mergedData = ((github.prs_merged_by_day as Array<{ date: string; count: number }>) ?? []).map((d) => ({
    ...d,
    label: dayLabel(d.date),
  }));
  const hasCommits = commitData.some((d) => d.count > 0);
  const hasMerged = mergedData.some((d) => d.count > 0);
  const prStateData = ((github.prs_by_state as Array<{ name: string; value: number }>) ?? [])
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, color: PR_COLORS[d.name] ?? '#9ca3af' }));
  const contributors = (github.contributors as any[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Github size={16} /> GitHub
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {github.repo_count} attached repo{github.repo_count === 1 ? '' : 's'}
            {github.issues_with_prs ? ` · ${github.issues_with_prs} issue${github.issues_with_prs === 1 ? '' : 's'} with a linked PR` : ''}
          </p>
        </div>
        <Link href={`/projects/${projectId}/development`} className="text-xs font-medium text-indigo-600 hover:underline">
          View development
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<GitPullRequest size={18} />} label="Open PRs" value={github.open_prs} color="slate" />
        <KpiCard icon={<GitMerge size={18} />} label="Merged (30d)" value={github.merged_prs_30d} color="green" />
        <KpiCard icon={<GitCommit size={18} />} label="Commits (14d)" value={github.commits_14d} color="slate" />
        <KpiCard icon={<Link2 size={18} />} label="Linked PRs" value={github.linked_prs} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Commits (14 days)</p>
          {!hasCommits ? (
            <EmptyChart message="No commits on attached repos in the last 14 days." />
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

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Pull requests</p>
          {prStateData.length === 0 ? (
            <EmptyChart message="No pull requests synced yet." />
          ) : (
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
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">PRs merged (14 days)</p>
          {!hasMerged ? (
            <EmptyChart message="No merges in the last 14 days." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mergedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="count" name="Merged" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Top contributors</p>
          {contributors.length === 0 ? (
            <EmptyChart message="No commit authors on attached repos yet." />
          ) : (
            <div className="space-y-2">
              {contributors.map((person) => (
                <div key={person.login} className="flex items-center gap-3">
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {getInitials(person.name || person.login)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{person.name}</p>
                    <p className="text-[11px] text-gray-400">@{person.login}</p>
                  </div>
                  <p className="text-xs text-gray-500 shrink-0">{person.commit_count} commits · {person.pr_count} PRs</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const styles: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', styles[color])}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function EmptyChart({ message = 'No data yet.' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-28 text-sm text-gray-400">{message}</div>
  );
}
