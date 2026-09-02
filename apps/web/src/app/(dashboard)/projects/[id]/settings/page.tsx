'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { projectsApi, usersApi } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import { Trash2, UserPlus, X } from 'lucide-react';
import { ProjectIconPicker } from '@/components/projects/project-icon-picker';

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const { data: project, isLoading } = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id) });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: usersApi.list,
    enabled: canManage,
  });

  const [form, setForm] = useState<any>(null);
  const [addUserId, setAddUserId] = useState('');

  const refreshProject = () => {
    qc.invalidateQueries({ queryKey: ['project', id] });
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['project-members', id] });
    qc.invalidateQueries({ queryKey: ['project-contributors', id] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: any) => projectsApi.update(id, data),
    onSuccess: () => {
      refreshProject();
      toast.success('Project updated');
    },
    onError: () => toast.error('Failed to update project'),
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.addMember(id, { userId, role: 'member' }),
    onSuccess: () => {
      setAddUserId('');
      refreshProject();
      toast.success('Developer added to project');
    },
    onError: () => toast.error('Failed to add developer'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id, userId),
    onSuccess: () => {
      refreshProject();
      toast.success('Developer removed from project');
    },
    onError: () => toast.error('Failed to remove developer'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      router.push('/projects');
    },
    onError: () => toast.error('Failed to delete project'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!project) return null;

  const f = form ?? project;
  const members = project.members ?? [];
  const memberIds = new Set(members.map((m: any) => m.id));
  const available = (employees as any[]).filter((e) => e.is_active !== false && !memberIds.has(e.id));

  return (
    <div className={canManage ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 items-start' : 'max-w-lg'}>
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4 min-w-0">
        <h2 className="font-semibold text-gray-900">General</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project name</label>
          <input
            value={f.name}
            onChange={(e) => setForm({ ...f, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={f.description ?? ''}
            onChange={(e) => setForm({ ...f, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <ProjectIconPicker value={f.icon ?? ''} onChange={(icon) => setForm({ ...f, icon })} />

        <div className="flex gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <input
              type="color"
              value={f.color ?? '#4f46e5'}
              onChange={(e) => setForm({ ...f, color: e.target.value })}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={f.status}
              onChange={(e) => setForm({ ...f, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => updateMutation.mutate({ name: f.name, description: f.description, icon: f.icon, color: f.color, status: f.status })}
          disabled={updateMutation.isPending}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {canManage && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4 min-w-0">
          <h2 className="font-semibold text-gray-900">Access</h2>
          <p className="text-sm text-gray-500">
            Grant developers access to this project, like adding collaborators to a repository. They can then take issues, and their work shows on Contributors.
          </p>

          <div className="flex gap-2">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Select a developer…</option>
              {available.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}{e.job_title ? ` · ${e.job_title}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addUserId || addMemberMutation.isPending}
              onClick={() => addMemberMutation.mutate(addUserId)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <UserPlus size={14} /> Add
            </button>
          </div>

          <div className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
            {members.length === 0 && (
              <p className="text-sm text-gray-400 py-3">No developers have access yet.</p>
            )}
            {members.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                    {getInitials(`${m.first_name} ${m.last_name}`)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-gray-400 truncate capitalize">
                    {m.role ?? 'member'}{m.job_title ? ` · ${m.job_title}` : ''}
                  </p>
                </div>
                {m.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => removeMemberMutation.mutate(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"
                    aria-label={`Remove ${m.first_name}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canManage && (
        <div className="bg-white rounded-xl border border-red-100 p-6 shadow-sm space-y-3 min-w-0 lg:col-span-2">
          <h2 className="font-semibold text-gray-900">Delete project</h2>
          <p className="text-sm text-gray-500">
            Soft-delete this project. It disappears from lists and boards, but issues, docs, and files stay in the database.
          </p>
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm(`Delete "${project.name}"? It will be hidden, not permanently erased.`)) {
                deleteMutation.mutate();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 size={14} />
            {deleteMutation.isPending ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      )}
    </div>
  );
}
