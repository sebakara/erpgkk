'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, Globe, MapPin, Tag, FileText, FolderOpen, Plus, X } from 'lucide-react';
import { clientsApi, projectsApi } from '@/lib/api';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<string, string> = {
  prospect: 'bg-yellow-100 text-yellow-700',
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  churned:  'bg-red-100 text-red-600',
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showLinkModal, setShowLinkModal] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsApi.get(id),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    enabled: showLinkModal,
  });

  const linkMutation = useMutation({
    mutationFn: (projectId: string) => clientsApi.linkProject(id, projectId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); toast.success('Project linked'); },
  });

  const unlinkMutation = useMutation({
    mutationFn: (projectId: string) => clientsApi.unlinkProject(id, projectId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); toast.success('Project unlinked'); },
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!client) return <p className="text-gray-500">Client not found.</p>;

  const linkedIds = new Set(client.projects?.map((p: any) => p.id));
  const unlinkableProjects = allProjects.filter((p: any) => !linkedIds.has(p.id));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => router.push('/clients')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={15} /> Clients
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xl shrink-0">
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full capitalize font-medium ${STATUS_STYLES[client.status] || 'bg-gray-100 text-gray-600'}`}>{client.status}</span>
            </div>
            {client.industry && <p className="text-sm text-gray-500 mt-0.5">{client.industry}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600">
              <Mail size={14} className="text-gray-400" />{client.email}
            </a>
          )}
          {client.phone && (
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600">
              <Phone size={14} className="text-gray-400" />{client.phone}
            </a>
          )}
          {client.website && (
            <a href={client.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600">
              <Globe size={14} className="text-gray-400" />{client.website}
            </a>
          )}
          {client.address && (
            <p className="flex items-center gap-2 text-sm text-gray-600 col-span-2">
              <MapPin size={14} className="text-gray-400" />{client.address}
            </p>
          )}
        </div>

        {client.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5"><FileText size={12} /> Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Linked Projects */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FolderOpen size={16} className="text-indigo-500" /> Linked Projects</h2>
          <button onClick={() => setShowLinkModal(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700">
            <Plus size={13} /> Link project
          </button>
        </div>

        {client.projects?.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No projects linked yet.</p>
        ) : (
          <div className="space-y-2">
            {client.projects?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 group">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || '#4f46e5' }} />
                <span className="text-sm font-medium text-gray-800 flex-1">{p.icon || '📁'} {p.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.status}</span>
                <button onClick={() => unlinkMutation.mutate(p.id)}
                  className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link project modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold">Link a Project</h3>
              <button onClick={() => setShowLinkModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 max-h-80 overflow-y-auto space-y-2">
              {unlinkableProjects.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">All projects are already linked.</p>
              ) : unlinkableProjects.map((p: any) => (
                <button key={p.id}
                  onClick={() => { linkMutation.mutate(p.id); setShowLinkModal(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 text-left transition-colors">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || '#4f46e5' }} />
                  <span className="text-sm font-medium text-gray-800">{p.icon || '📁'} {p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
