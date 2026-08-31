'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { companyApi, departmentsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Department } from '@/types';

type Section = 'company' | 'departments' | 'members';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [section, setSection] = useState<Section>('company');

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
    hr: 'bg-teal-100 text-teal-700',
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

function Spinner() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
