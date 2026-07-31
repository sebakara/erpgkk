'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { projectsApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: project, isLoading } = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id) });

  const [form, setForm] = useState<any>(null);

  const updateMutation = useMutation({
    mutationFn: (data: any) => projectsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Project updated');
    },
    onError: () => toast.error('Failed to update project'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!project) return null;

  const f = form ?? project;

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
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

        <div className="flex gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            <input
              value={f.icon ?? ''}
              onChange={(e) => setForm({ ...f, icon: e.target.value })}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
            />
          </div>
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
    </div>
  );
}
