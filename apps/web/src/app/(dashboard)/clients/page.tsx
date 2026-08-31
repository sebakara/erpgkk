'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, Users2, Mail, Phone, Globe, Trash2, Pencil } from 'lucide-react';
import { clientsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { CommercialOnly } from '@/components/layout/access-denied';

const STATUS_STYLES: Record<string, string> = {
  prospect:  'bg-yellow-100 text-yellow-700',
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-600',
  churned:   'bg-red-100 text-red-600',
};

const EMPTY_FORM = { name: '', email: '', phone: '', website: '', industry: '', address: '', status: 'prospect', notes: '' };

export default function ClientsPage() {
  return (
    <CommercialOnly>
      <ClientsPageBody />
    </CommercialOnly>
  );
}

function ClientsPageBody() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list(search || undefined),
  });

  const createMutation = useMutation({
    mutationFn: () => clientsApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setModal(null); toast.success('Client added'); },
    onError: () => toast.error('Failed to add client'),
  });

  const updateMutation = useMutation({
    mutationFn: () => clientsApi.update(editing.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setModal(null); toast.success('Client updated'); },
    onError: () => toast.error('Failed to update client'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client removed'); },
    onError: () => toast.error('Failed to remove client'),
  });

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setModal('create'); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, email: c.email || '', phone: c.phone || '', website: c.website || '', industry: c.industry || '', address: c.address || '', status: c.status, notes: c.notes || '' }); setModal('edit'); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} contacts</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <Users2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No clients yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Add your first client to get started.</p>
          <button onClick={openCreate} className="text-sm text-primary-600 font-medium hover:underline">+ Add Client</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c: any) => (
            <div key={c.id} onClick={() => router.push(`/clients/${c.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-sm shrink-0">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{c.name}</h3>
              {c.industry && <p className="text-xs text-gray-400 mt-0.5">{c.industry}</p>}
              <div className="mt-3 space-y-1">
                {c.email && <p className="flex items-center gap-1.5 text-xs text-gray-500"><Mail size={11} />{c.email}</p>}
                {c.phone && <p className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={11} />{c.phone}</p>}
                {c.website && <p className="flex items-center gap-1.5 text-xs text-gray-500"><Globe size={11} />{c.website}</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${c.name}?`)) deleteMutation.mutate(c.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold">{modal === 'create' ? 'Add Client' : 'Edit Client'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Name *', key: 'name', placeholder: 'Acme Corp' },
                  { label: 'Industry', key: 'industry', placeholder: 'Healthcare' },
                  { label: 'Email', key: 'email', placeholder: 'contact@acme.com' },
                  { label: 'Phone', key: 'phone', placeholder: '+1 555 000 0000' },
                  { label: 'Website', key: 'website', placeholder: 'https://acme.com' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} className={key === 'name' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {['prospect', 'active', 'inactive', 'churned'].map((s) => (
                      <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Main St, City, Country"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3} placeholder="Any relevant notes…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => modal === 'create' ? createMutation.mutate() : updateMutation.mutate()}
                disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
