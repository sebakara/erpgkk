'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, departmentsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { ProjectPeople } from '@/components/projects/project-people';
import { ProjectIconPicker } from '@/components/projects/project-icon-picker';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: projectsApi.list });
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon: '📁', color: '#4f46e5', department_id: '' });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list, enabled: showNew });

  useEffect(() => {
    const rnd = (departments as any[]).find((d) => /r\s*&\s*d|engineering/i.test(d.name));
    if (rnd) setForm((current) => current.department_id ? current : { ...current, department_id: rnd.id });
  }, [departments]);

  const createMutation = useMutation({
    mutationFn: (data: any) => projectsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowNew(false); toast.success('Project created'); },
    onError: () => toast.error('Failed to create project'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">{projects.length} projects in your workspace</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          <Plus size={16} /> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
          <FolderOpen size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No projects yet. Create your first one.</p>
          <button onClick={() => setShowNew(true)} className="mt-4 text-primary-600 font-medium text-sm hover:underline">+ New Project</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{p.icon || '📁'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{p.name}</h3>
              {p.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || '#4f46e5' }} />
                  <span className="text-xs text-gray-400 truncate">View board →</span>
                </div>
                <ProjectPeople people={p.members} href={`/projects/${p.id}/contributors`} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">New Project</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Project name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
              <ProjectIconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Color</label>
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer" />
              </div>
              {departments.length > 0 && (
                <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  <option value="">No department</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Cancel</button>
              <button onClick={() => createMutation.mutate({ ...form, department_id: form.department_id || undefined })} disabled={!form.name || createMutation.isPending} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
