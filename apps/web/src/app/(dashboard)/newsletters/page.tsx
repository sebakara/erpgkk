'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Mail, Send, FileText, Clock, Trash2, Users2 } from 'lucide-react';
import { newslettersApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { CommercialOnly } from '@/components/layout/access-denied';

export default function NewslettersPage() {
  return (
    <CommercialOnly>
      <NewslettersPageBody />
    </CommercialOnly>
  );
}

function NewslettersPageBody() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newSubject, setNewSubject] = useState('');

  const { data: newsletters = [], isLoading } = useQuery({
    queryKey: ['newsletters'],
    queryFn: newslettersApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () => newslettersApi.create({ subject: newSubject.trim(), content: '' }),
    onSuccess: (nl: any) => {
      qc.invalidateQueries({ queryKey: ['newsletters'] });
      toast.success('Newsletter created');
      setShowCreate(false);
      setNewSubject('');
      router.push(`/newsletters/${nl.id}`);
    },
    onError: () => toast.error('Failed to create newsletter'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => newslettersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['newsletters'] }); toast.success('Deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  const drafts = (newsletters as any[]).filter((n) => n.status === 'draft');
  const sent   = (newsletters as any[]).filter((n) => n.status === 'sent');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletters</h1>
          <p className="text-sm text-gray-500 mt-0.5">{drafts.length} draft{drafts.length !== 1 ? 's' : ''} · {sent.length} sent</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          <Plus size={16} /> New Newsletter
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : newsletters.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <Mail size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No newsletters yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Create your first newsletter to start communicating.</p>
          <button onClick={() => setShowCreate(true)} className="text-sm text-primary-600 font-medium hover:underline">+ New Newsletter</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Drafts */}
          {(drafts.length > 0 || showCreate) && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Drafts</h2>
              <div className="space-y-2">
                {showCreate && (
                  <div className="bg-white rounded-xl border-2 border-primary-200 p-4 flex items-center gap-3">
                    <FileText size={18} className="text-primary-500 shrink-0" />
                    <input autoFocus value={newSubject} onChange={(e) => setNewSubject(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newSubject.trim()) createMutation.mutate(); if (e.key === 'Escape') { setShowCreate(false); setNewSubject(''); } }}
                      placeholder="Newsletter subject…"
                      className="flex-1 text-sm font-medium focus:outline-none placeholder:text-gray-400" />
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => { setShowCreate(false); setNewSubject(''); }} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                      <button onClick={() => newSubject.trim() && createMutation.mutate()} disabled={!newSubject.trim() || createMutation.isPending}
                        className="text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-3 py-1.5 rounded-lg">
                        {createMutation.isPending ? 'Creating…' : 'Create'}
                      </button>
                    </div>
                  </div>
                )}
                {drafts.map((n: any) => (
                  <NewsletterRow key={n.id} n={n} onClick={() => router.push(`/newsletters/${n.id}`)} onDelete={() => { if (confirm('Delete this draft?')) deleteMutation.mutate(n.id); }} />
                ))}
              </div>
            </section>
          )}

          {/* Sent */}
          {sent.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sent</h2>
              <div className="space-y-2">
                {sent.map((n: any) => (
                  <NewsletterRow key={n.id} n={n} onClick={() => router.push(`/newsletters/${n.id}`)} onDelete={() => { if (confirm('Delete this newsletter?')) deleteMutation.mutate(n.id); }} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function NewsletterRow({ n, onClick, onDelete }: { n: any; onClick: () => void; onDelete: () => void }) {
  return (
    <div onClick={onClick} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4 hover:border-primary-200 hover:shadow-sm transition-all cursor-pointer group">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${n.status === 'sent' ? 'bg-green-50' : 'bg-indigo-50'}`}>
        {n.status === 'sent' ? <Send size={16} className="text-green-600" /> : <FileText size={16} className="text-indigo-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{n.subject}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {n.author_name && <span className="text-xs text-gray-400">{n.author_name}</span>}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock size={11} />
            {n.status === 'sent' ? `Sent ${formatDate(n.sent_at)}` : `Updated ${formatDate(n.updated_at)}`}
          </span>
          {n.status === 'sent' && (
            <span className="flex items-center gap-1 text-xs text-gray-400"><Users2 size={11} />{n.recipient_count} recipients</span>
          )}
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${n.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{n.status}</span>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
        <Trash2 size={15} />
      </button>
    </div>
  );
}
