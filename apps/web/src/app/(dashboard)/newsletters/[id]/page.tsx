'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, CheckCircle, Save, Plus, X, Users2, User } from 'lucide-react';
import { newslettersApi, clientsApi } from '@/lib/api';
import { RichTextEditor } from '@/components/docs/rich-text-editor';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { CommercialOnly } from '@/components/layout/access-denied';

export default function NewsletterEditorPage() {
  return (
    <CommercialOnly>
      <NewsletterEditorBody />
    </CommercialOnly>
  );
}

function NewsletterEditorBody() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSend, setShowSend] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: nl, isLoading } = useQuery({
    queryKey: ['newsletter', id],
    queryFn: () => newslettersApi.get(id),
  });

  useEffect(() => {
    if (nl) { setSubject(nl.subject); setContent(nl.content || ''); }
  }, [nl]);

  const saveMutation = useMutation({
    mutationFn: () => newslettersApi.update(id, { subject: subject.trim(), content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['newsletters'] });
      qc.invalidateQueries({ queryKey: ['newsletter', id] });
      setIsDirty(false);
      setLastSaved(new Date());
    },
    onError: () => toast.error('Failed to save'),
  });

  const scheduleAutoSave = useCallback(() => {
    setIsDirty(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveMutation.mutate(), 2000);
  }, [saveMutation]);

  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  const isSent = nl?.status === 'sent';

  if (isLoading) return <div className="flex items-center justify-center h-60"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!nl) return <p className="text-gray-500">Newsletter not found.</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={() => router.push('/newsletters')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0">
          <ArrowLeft size={15} /> Newsletters
        </button>
        <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
          {!isSent && (
            <>
              {saveMutation.isPending && <span>Saving…</span>}
              {!saveMutation.isPending && lastSaved && (
                <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-500" />Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {isDirty && !saveMutation.isPending && <span className="text-amber-500">Unsaved</span>}
              <button onClick={() => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); saveMutation.mutate(); }}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 px-3 py-1.5 rounded-lg">
                <Save size={12} /> Save
              </button>
              <button onClick={() => setShowSend(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg">
                <Send size={12} /> Send
              </button>
            </>
          )}
          {isSent && (
            <span className="flex items-center gap-1.5 text-green-600 font-medium">
              <CheckCircle size={14} /> Sent {formatDate(nl.sent_at)} · {nl.recipient_count} recipients
            </span>
          )}
        </div>
      </div>

      {/* Subject */}
      {isSent ? (
        <h1 className="text-3xl font-bold text-gray-900">{subject}</h1>
      ) : (
        <input value={subject} onChange={(e) => { setSubject(e.target.value); scheduleAutoSave(); }}
          placeholder="Newsletter subject…"
          className="w-full text-3xl font-bold text-gray-900 focus:outline-none placeholder:text-gray-300 bg-transparent" />
      )}

      {/* Editor */}
      <RichTextEditor content={content} onChange={(html) => { setContent(html); if (!isSent) scheduleAutoSave(); }} editable={!isSent} />

      {/* Send modal */}
      {showSend && (
        <SendModal newsletterId={id} onClose={() => setShowSend(false)}
          onSent={() => { qc.invalidateQueries({ queryKey: ['newsletter', id] }); qc.invalidateQueries({ queryKey: ['newsletters'] }); setShowSend(false); }} />
      )}
    </div>
  );
}

// ── Send Modal ────────────────────────────────────────────────────────────────
function SendModal({ newsletterId, onClose, onSent }: { newsletterId: string; onClose: () => void; onSent: () => void }) {
  const [tab, setTab] = useState<'clients' | 'manual'>('clients');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualInput, setManualInput] = useState('');
  const [manualList, setManualList] = useState<Array<{ email: string; name: string }>>([]);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      const fromClients = (clients as any[])
        .filter((c) => selected.has(c.id))
        .map((c) => ({ email: c.email, name: c.name }))
        .filter((r) => r.email);
      const recipients = [...fromClients, ...manualList];
      return newslettersApi.send(newsletterId, recipients);
    },
    onSuccess: (res: any) => {
      toast.success(`Sent to ${res.sent} of ${res.total} recipients`);
      onSent();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to send'),
  });

  const toggleAll = () => {
    const withEmail = (clients as any[]).filter((c) => c.email).map((c) => c.id);
    if (selected.size === withEmail.length) setSelected(new Set());
    else setSelected(new Set(withEmail));
  };

  const addManual = () => {
    const email = manualInput.trim();
    if (!email || !email.includes('@')) { toast.error('Enter a valid email'); return; }
    if (manualList.some((r) => r.email === email)) { toast.error('Already added'); return; }
    setManualList((l) => [...l, { email, name: '' }]);
    setManualInput('');
  };

  const clientsWithEmail = (clients as any[]).filter((c) => c.email);
  const totalRecipients = selected.size + manualList.length;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2"><Send size={16} className="text-green-600" /> Send Newsletter</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['clients', 'manual'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'clients' ? <span className="flex items-center justify-center gap-1.5"><Users2 size={14} /> Clients</span> : <span className="flex items-center justify-center gap-1.5"><User size={14} /> Manual</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'clients' && (
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : clientsWithEmail.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No clients with email addresses.</p>
              ) : (
                <>
                  <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selected.size === clientsWithEmail.length} onChange={toggleAll}
                      className="rounded accent-primary-600" />
                    <span className="text-sm font-medium text-gray-700">Select all ({clientsWithEmail.length})</span>
                  </label>
                  <div className="border-t border-gray-100 pt-2 space-y-1">
                    {clientsWithEmail.map((c: any) => (
                      <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={(e) => {
                          const next = new Set(selected);
                          e.target.checked ? next.add(c.id) : next.delete(c.id);
                          setSelected(next);
                        }} className="rounded accent-primary-600" />
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{c.name}</p>
                          <p className="text-xs text-gray-400 truncate">{c.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={manualInput} onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManual()}
                  placeholder="email@example.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <button onClick={addManual} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                  <Plus size={16} />
                </button>
              </div>
              {manualList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No manual recipients added yet.</p>
              ) : (
                <div className="space-y-1">
                  {manualList.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                      <span className="flex-1 text-sm text-gray-700">{r.email}</span>
                      <button onClick={() => setManualList((l) => l.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center gap-3">
          <p className="flex-1 text-sm text-gray-500">{totalRecipients} recipient{totalRecipients !== 1 ? 's' : ''} selected</p>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={() => sendMutation.mutate()} disabled={totalRecipients === 0 || sendMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            <Send size={14} />
            {sendMutation.isPending ? 'Sending…' : `Send to ${totalRecipients}`}
          </button>
        </div>
      </div>
    </div>
  );
}
