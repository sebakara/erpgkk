'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Pencil, Trash2, Check, X, Github, RefreshCw, Unplug, ExternalLink } from 'lucide-react';
import { companyApi, departmentsApi, usersApi, githubApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Department } from '@/types';

type Section = 'company' | 'departments' | 'members' | 'integrations';

export default function SettingsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const searchParams = useSearchParams();
  const [section, setSection] = useState<Section>(() =>
    searchParams.get('section') === 'integrations' || searchParams.get('installation_id')
      ? 'integrations'
      : 'company',
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3">
        <Building2 size={36} className="text-gray-300" />
        <p className="text-gray-500 font-medium">Settings are only available to admins.</p>
      </div>
    );
  }

  const tabs: { key: Section; label: string }[] = [
    { key: 'company', label: 'Company' },
    { key: 'departments', label: 'Departments' },
    { key: 'members', label: 'Members' },
    { key: 'integrations', label: 'Integrations' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              section === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'company' && <CompanySection />}
      {section === 'departments' && <DepartmentsSection />}
      {section === 'members' && <MembersSection />}
      {section === 'integrations' && <IntegrationsSection />}
    </div>
  );
}

/* ─── COMPANY ─────────────────────────────────────────────────────────────── */
function CompanySection() {
  const { data: company, isLoading } = useQuery({ queryKey: ['company'], queryFn: companyApi.get });
  const [name, setName] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => companyApi.update({ name: name.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company'] }); toast.success('Company updated'); },
    onError: () => toast.error('Failed to update'),
  });

  if (isLoading) return <Spinner />;

  const currentName = name || company?.name || '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <h2 className="font-semibold text-gray-900">Company Information</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Company name</label>
          <input
            defaultValue={company?.name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Slug</label>
          <input
            value={company?.slug ?? ''}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">Slug is set at registration and cannot be changed.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Plan</label>
          <span className="inline-block px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium capitalize">
            {company?.plan ?? 'free'}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => mutation.mutate()}
          disabled={!name.trim() || name.trim() === company?.name || mutation.isPending}
          className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

/* ─── DEPARTMENTS ──────────────────────────────────────────────────────────── */
function DepartmentsSection() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: usersApi.list });

  const createMutation = useMutation({
    mutationFn: () => departmentsApi.create({ name: newName.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setNewName(''); setShowAdd(false); toast.success('Department created'); },
    onError: () => toast.error('Failed to create'),
  });

  const updateNameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => departmentsApi.update(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setEditId(null); toast.success('Department updated'); },
    onError: () => toast.error('Failed to update'),
  });

  const setHeadMutation = useMutation({
    mutationFn: ({ id, manager_id }: { id: string; manager_id: string | null }) =>
      departmentsApi.update(id, { manager_id: manager_id ?? undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Department head updated'); },
    onError: () => toast.error('Failed to update head'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Department deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  // Employees grouped by department for the head picker
  const empsByDept = (employees as any[]).reduce<Record<string, any[]>>((acc, e) => {
    const key = e.department_id ?? '__none__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const countByDept = (employees as any[]).reduce<Record<string, number>>((acc, e) => {
    if (e.department_id) acc[e.department_id] = (acc[e.department_id] ?? 0) + 1;
    return acc;
  }, {});

  if (isLoading) return <Spinner />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Departments</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {showAdd && (
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 bg-primary-50">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) createMutation.mutate();
              if (e.key === 'Escape') { setShowAdd(false); setNewName(''); }
            }}
            placeholder="Department name…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending} className="p-2 bg-primary-600 text-white rounded-lg disabled:opacity-50 hover:bg-primary-700">
            <Check size={15} />
          </button>
          <button onClick={() => { setShowAdd(false); setNewName(''); }} className="p-2 text-gray-400 hover:text-gray-600">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {departments.length === 0 && !showAdd && (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No departments yet.</p>
        )}
        {departments.map((d) => {
          // Employees available to be department head: those in this dept + any managers/admins
          const deptMembers: any[] = empsByDept[d.id] ?? [];
          return (
            <div key={d.id} className="px-5 py-4 hover:bg-gray-50 group">
              <div className="flex items-center gap-3">
                <Building2 size={16} className="text-gray-400 shrink-0" />

                {editId === d.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editName.trim()) updateNameMutation.mutate({ id: d.id, name: editName });
                      if (e.key === 'Escape') setEditId(null);
                    }}
                    className="flex-1 px-2 py-1 border border-primary-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : (
                  <span className="flex-1 text-sm font-medium text-gray-900">{d.name}</span>
                )}

                <span className="text-xs text-gray-400 shrink-0">
                  {countByDept[d.id] ?? 0} member{(countByDept[d.id] ?? 0) !== 1 ? 's' : ''}
                </span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {editId === d.id ? (
                    <>
                      <button onClick={() => updateNameMutation.mutate({ id: d.id, name: editName })} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-md"><Check size={13} /></button>
                      <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md"><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditId(d.id); setEditName(d.name); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md"><Pencil size={13} /></button>
                      <button onClick={() => { if (confirm(`Delete "${d.name}"?`)) deleteMutation.mutate(d.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              </div>

              {/* Department head picker */}
              <div className="mt-2.5 ml-7 flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium shrink-0">Department head:</span>
                <select
                  value={d.manager_id ?? ''}
                  onChange={(e) => setHeadMutation.mutate({ id: d.id, manager_id: e.target.value || null })}
                  className="flex-1 max-w-xs text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">— No head assigned —</option>
                  {deptMembers.length > 0 && (
                    <optgroup label={`${d.name} members`}>
                      {deptMembers.map((e) => (
                        <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.role})</option>
                      ))}
                    </optgroup>
                  )}
                  {/* Also allow selecting any manager/admin from other depts */}
                  {(() => {
                    const others = (employees as any[]).filter(
                      (e) => e.department_id !== d.id && (e.role === 'manager' || e.role === 'admin')
                    );
                    return others.length > 0 ? (
                      <optgroup label="Other managers / admins">
                        {others.map((e) => (
                          <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.role})</option>
                        ))}
                      </optgroup>
                    ) : null;
                  })()}
                </select>
                {d.manager_id && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full font-medium shrink-0">
                    {d.manager_name}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── MEMBERS ──────────────────────────────────────────────────────────────── */
function MembersSection() {
  const qc = useQueryClient();
  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: usersApi.list });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ['departments'], queryFn: departmentsApi.list });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Updated'); },
    onError: () => toast.error('Failed to update'),
  });

  if (isLoading) return <Spinner />;

  const ROLE_COLOR: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    employee: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Members ({(employees as any[]).length})</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {(employees as any[]).map((emp) => (
          <div key={emp.id} className="flex items-center gap-4 px-5 py-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
              {(emp.first_name?.[0] ?? '') + (emp.last_name?.[0] ?? '')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{emp.first_name} {emp.last_name}</p>
              <p className="text-xs text-gray-400 truncate">{emp.email}</p>
            </div>
            {/* Department select */}
            <select
              value={emp.department_id ?? ''}
              onChange={(e) => updateMutation.mutate({ id: emp.id, data: { department_id: e.target.value || null } })}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-[140px]"
            >
              <option value="">No dept.</option>
              {(departments as Department[]).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {/* Role select */}
            <select
              value={emp.role}
              onChange={(e) => updateMutation.mutate({ id: emp.id, data: { role: e.target.value } })}
              className={cn('text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500', ROLE_COLOR[emp.role])}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hr">HR</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ))}
        {(employees as any[]).length === 0 && (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No members found.</p>
        )}
      </div>
    </div>
  );
}

/* ─── INTEGRATIONS ─────────────────────────────────────────────────────────── */
function IntegrationsSection() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const installationId = searchParams.get('installation_id');

  const { data: status, isLoading } = useQuery({
    queryKey: ['github-status'],
    queryFn: githubApi.status,
  });
  const { data: people = [] } = useQuery({
    queryKey: ['github-people'],
    queryFn: githubApi.people,
    enabled: !!status?.connected,
  });

  const installMutation = useMutation({
    mutationFn: (id: string) => githubApi.install(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-status'] });
      qc.invalidateQueries({ queryKey: ['github-people'] });
      toast.success('GitHub connected');
      router.replace('/settings?section=integrations');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to complete GitHub install'),
  });

  useEffect(() => {
    if (installationId && status?.configured && !installMutation.isPending && !installMutation.isSuccess) {
      installMutation.mutate(installationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, status?.configured]);

  const syncMutation = useMutation({
    mutationFn: githubApi.sync,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['github-status'] });
      if (data?.errors?.length) {
        toast.success(`Synced with ${data.errors.length} repo warning(s)`);
      } else if ((data?.repo_count ?? data?.listed_repo_count ?? 0) === 0) {
        toast.success('Synced — GitHub granted 0 repositories. Open Manage on GitHub and include all repos.');
      } else {
        toast.success('GitHub synced');
      }
    },
    onError: () => toast.error('Sync failed'),
  });

  const disconnectMutation = useMutation({
    mutationFn: (installationId?: string) => githubApi.disconnect(installationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-status'] });
      qc.invalidateQueries({ queryKey: ['github-people'] });
      toast.success('GitHub organization disconnected');
    },
    onError: () => toast.error('Failed to disconnect'),
  });

  const chatMutation = useMutation({
    mutationFn: ({ installation_id, notify_project_chat }: { installation_id: string; notify_project_chat: boolean }) =>
      githubApi.update({ installation_id, notify_project_chat }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['github-status'] }),
    onError: () => toast.error('Failed to update'),
  });

  const mapMutation = useMutation({
    mutationFn: ({ userId, username }: { userId: string; username: string }) =>
      githubApi.mapUser(userId, username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-people'] });
      toast.success('GitHub account linked');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to link GitHub'),
  });

  const unmapMutation = useMutation({
    mutationFn: (userId: string) => githubApi.unmapUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-people'] });
      toast.success('GitHub account unlinked');
    },
    onError: () => toast.error('Failed to unlink'),
  });

  if (isLoading) return <Spinner />;

  const connected = !!status?.connected;
  const orgs = (status?.installations?.length ? status.installations : status?.installation ? [status.installation] : []) as any[];
  const lastSync = orgs
    .map((org) => org.last_synced_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0">
            <Github size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900">GitHub</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Read-only activity from every GitHub organization this company connects. Used as evidence on projects — not as a score.
            </p>
          </div>
          <span className={cn(
            'text-xs px-2.5 py-1 rounded-full font-medium shrink-0',
            connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
          )}>
            {connected ? `${orgs.length} org${orgs.length === 1 ? '' : 's'} connected` : 'Not connected'}
          </span>
        </div>

        {!status?.configured && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            GitHub App env vars are missing on the API
            {status?.missing_env?.length ? (
              <>
                : <code className="font-mono">{status.missing_env.join(', ')}</code>
              </>
            ) : null}
            . Put them in <code className="font-mono">apps/api/.env</code> on the server (not the repo-root{' '}
            <code className="font-mono">.env</code>), then restart the API.
          </p>
        )}

        {installMutation.isPending && (
          <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            Completing GitHub installation…
          </p>
        )}

        {connected && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Organizations" value={String(orgs.length)} />
            <Stat label="Repositories" value={String(status.repo_count)} />
            <Stat label="Mapped to projects" value={String(status.mapped_repo_count)} />
            <Stat label="Last sync" value={lastSync ? new Date(lastSync).toLocaleString() : 'Never'} />
          </div>
        )}

        {connected && orgs.map((org) => (
          <div key={org.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{org.github_account_login}</p>
                <p className="text-xs text-gray-400">
                  {org.account_type} · {org.repo_count ?? 0} repositories
                  {org.repository_selection === 'all' ? ' · all repos' : ' · selected repos'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {org.manage_url && (
                  <a
                    href={org.manage_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <ExternalLink size={12} /> Manage
                  </a>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Disconnect ${org.github_account_login}? Mappings for that org’s repos will be removed.`)) {
                      disconnectMutation.mutate(org.id);
                    }
                  }}
                  disabled={disconnectMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  <Unplug size={12} /> Disconnect
                </button>
              </div>
            </div>
            {org.repo_count === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                This organization granted 0 repositories. Open Manage, choose All repositories (or select the private ones), then Sync.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!org.notify_project_chat}
                onChange={(e) => chatMutation.mutate({ installation_id: org.id, notify_project_chat: e.target.checked })}
                className="rounded border-gray-300"
              />
              Post merged PRs and releases to project chat
            </label>
          </div>
        ))}

        <div className="flex flex-wrap gap-2 justify-end">
          {connected && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
              {syncMutation.isPending ? 'Syncing…' : 'Sync all'}
            </button>
          )}
          <a
            href={status?.install_url || undefined}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black',
              !status?.install_url && 'pointer-events-none opacity-50',
            )}
          >
            <Github size={14} /> {connected ? 'Connect another organization' : 'Connect GitHub'}
          </a>
        </div>
        {connected && (
          <p className="text-xs text-gray-400">
            The GitHub App must allow installation on any account (App settings → General → Where can this GitHub App
            be installed?). Install it on the second org as an owner, then grant repository access and Sync all.
          </p>
        )}
      </div>

      {connected && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">People mapping</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Link a GitHub username to a CompanyOS user. No email auto-match.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {(people as any[]).map((person) => (
              <PersonGitHubRow
                key={person.id}
                person={person}
                onMap={(username) => mapMutation.mutate({ userId: person.id, username })}
                onUnmap={() => unmapMutation.mutate(person.id)}
                busy={mapMutation.isPending || unmapMutation.isPending}
              />
            ))}
            {(people as any[]).length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No members found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{value}</p>
    </div>
  );
}

function PersonGitHubRow({
  person,
  onMap,
  onUnmap,
  busy,
}: {
  person: any;
  onMap: (username: string) => void;
  onUnmap: () => void;
  busy: boolean;
}) {
  const [username, setUsername] = useState(person.github?.github_username ?? '');
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
        {(person.first_name?.[0] ?? '') + (person.last_name?.[0] ?? '')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{person.first_name} {person.last_name}</p>
        <p className="text-xs text-gray-400 truncate">{person.email}</p>
      </div>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="github username"
        className="w-40 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {person.github ? (
        <button
          onClick={onUnmap}
          disabled={busy}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          Unlink
        </button>
      ) : (
        <button
          onClick={() => username.trim() && onMap(username.trim())}
          disabled={busy || !username.trim()}
          className="text-xs text-primary-600 font-medium hover:underline disabled:opacity-50"
        >
          Link
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
