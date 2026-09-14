'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { projectsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { canManageProjects } from '@/lib/roles';
import toast from 'react-hot-toast';

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data: project, isLoading } = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id) });
  const { data: people = [] } = useQuery({ queryKey: ['employees'], queryFn: usersApi.list });

  const [form, setForm] = useState<any>(null);
  const [addUserId, setAddUserId] = useState('');

  const myRole = project?.members?.find((m: any) => m.id === user?.id)?.role;
  const canManage = canManageProjects(user?.role, project?.owner_id, user?.id, myRole);

  const updateMutation = useMutation({
    mutationFn: (data: any) => projectsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Project updated');
    },
    onError: () => toast.error('Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.remove(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      router.push('/projects');
    },
    onError: () => toast.error('Failed to delete project'),
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => {
      const person = (people as any[]).find((p) => p.id === userId);
      const role = person?.role === 'project_manager' ? 'manager' : 'member';
      return projectsApi.addMember(id, { userId, role });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      setAddUserId('');
      toast.success('Member added');
    },
    onError: () => toast.error('Failed to add member'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!project) return null;

  const f = form ?? project;
  const members: any[] = project.members ?? [];
  const memberIds = new Set(members.map((m) => m.id));
  const available = (people as any[]).filter((p) => p.is_active !== false && !memberIds.has(p.id));

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">General</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project name</label>
          <input
            value={f.name}
            onChange={(e) => setForm({ ...f, name: e.target.value })}
            disabled={!canManage}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={f.description ?? ''}
            onChange={(e) => setForm({ ...f, description: e.target.value })}
            disabled={!canManage}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
          />
        </div>

        <div className="flex gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            <input
              value={f.icon ?? ''}
              onChange={(e) => setForm({ ...f, icon: e.target.value })}
              disabled={!canManage}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <input
              type="color"
              value={f.color ?? '#4f46e5'}
              onChange={(e) => setForm({ ...f, color: e.target.value })}
              disabled={!canManage}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer disabled:opacity-50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={f.status}
              onChange={(e) => setForm({ ...f, status: e.target.value })}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {canManage && (
          <button
            onClick={() => updateMutation.mutate({ name: f.name, description: f.description, icon: f.icon, color: f.color, status: f.status })}
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>

      {canManage && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Team</h2>
          <p className="text-sm text-gray-500">
            Add people so you can assign them issues. Someone with the Project manager role is added as a lead and will only see this project in their list once they are on the team.
          </p>
          <div className="flex gap-2">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select a person…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
            <button
              onClick={() => addUserId && addMemberMutation.mutate(addUserId)}
              disabled={!addUserId || addMemberMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {members.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-400">No members yet.</p>
            )}
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {(m.first_name?.[0] ?? '') + (m.last_name?.[0] ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>
                <span className="text-[11px] font-medium text-gray-500">
                  {m.role === 'manager' ? 'Project manager' : m.role === 'owner' ? 'Owner' : 'Member'}
                </span>
                {m.role !== 'owner' && m.id !== project.owner_id && (
                  <button
                    onClick={() => removeMemberMutation.mutate(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Remove from project"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canManage && (
        <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900">Delete project</h2>
          <p className="text-sm text-gray-500">
            Remove this project from the workspace. Issues, docs, and files stay in the database but the project will no longer appear in lists.
          </p>
          <button
            onClick={() => {
              if (confirm(`Delete “${project.name}”? It will disappear from the workspace.`)) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      )}
    </div>
  );
}
