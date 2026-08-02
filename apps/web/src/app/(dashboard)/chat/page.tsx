'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { chatApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { Send, Plus, X, Hash, User, Search, Users } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function fullTimeLabel(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(date: string) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function groupByDate(messages: any[]) {
  const groups: { label: string; messages: any[] }[] = [];
  for (const msg of messages) {
    const label = dateLabel(msg.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.messages.push(msg);
    else groups.push({ label, messages: [msg] });
  }
  return groups;
}

function Avatar({ name, url, size = 8 }: { name: string; url?: string; size?: number }) {
  if (url) return <img src={url} alt={name} className={`w-${size} h-${size} rounded-full object-cover shrink-0`} />;
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={`w-${size} h-${size} rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  );
}

// ── New conversation modal ────────────────────────────────────────────────────

function NewConvModal({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<'person' | 'dept'>('person');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({ queryKey: ['chat-users'], queryFn: chatApi.getUsers });
  const { data: depts = [] } = useQuery({ queryKey: ['chat-depts'], queryFn: chatApi.getDepartments });

  const directMut = useMutation({
    mutationFn: (userId: string) => chatApi.startDirect(userId),
    onSuccess: (conv) => { qc.invalidateQueries({ queryKey: ['chat-convs'] }); onOpen(conv.id); onClose(); },
  });
  const deptMut = useMutation({
    mutationFn: (deptId: string) => chatApi.startDepartment(deptId),
    onSuccess: (conv) => { qc.invalidateQueries({ queryKey: ['chat-convs'] }); onOpen(conv.id); onClose(); },
  });

  const filteredUsers = (users as any[]).filter((u) =>
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredDepts = (depts as any[]).filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Message</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <div className="flex border-b border-gray-100">
          {(['person', 'dept'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setSearch(''); }}
              className={cn('flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2',
                tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700')}>
              {t === 'person' ? <><User size={14} /> Person</> : <><Users size={14} /> Department</>}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'person' ? 'Search employees…' : 'Search departments…'}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {tab === 'person'
              ? filteredUsers.map((u: any) => (
                  <button key={u.id} onClick={() => directMut.mutate(u.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left">
                    <Avatar name={`${u.first_name} ${u.last_name}`} url={u.avatar_url} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                      {u.job_title && <p className="text-xs text-gray-400">{u.job_title}</p>}
                    </div>
                  </button>
                ))
              : filteredDepts.map((d: any) => (
                  <button key={d.id} onClick={() => deptMut.mutate(d.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Hash size={14} className="text-indigo-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">{d.name}</p>
                  </button>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Message thread ────────────────────────────────────────────────────────────

function MessageThread({ convId, currentUserId }: { convId: string; currentUserId: string }) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-msgs', convId],
    queryFn: () => chatApi.getMessages(convId),
    refetchInterval: 3000,
  });

  const sendMut = useMutation({
    mutationFn: (content: string) => chatApi.sendMessage(convId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-msgs', convId] });
      qc.invalidateQueries({ queryKey: ['chat-convs'] });
      setText('');
    },
  });

  useEffect(() => {
    chatApi.markRead(convId).then(() => qc.invalidateQueries({ queryKey: ['chat-convs'] }));
  }, [convId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const groups = groupByDate(messages as any[]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
      e.preventDefault();
      sendMut.mutate(text.trim());
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
              <Send size={22} className="text-indigo-400" />
            </div>
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-sm text-gray-400 mt-1">Be the first to say something</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium px-2">{group.label}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <div className="space-y-3">
              {group.messages.map((msg: any, idx: number) => {
                const isMine = msg.sender_id === currentUserId;
                const prevMsg = group.messages[idx - 1];
                const sameAuthor = prevMsg && prevMsg.sender_id === msg.sender_id;

                return (
                  <div key={msg.id} className={cn('flex gap-3', isMine && 'flex-row-reverse')}>
                    {!sameAuthor ? (
                      <Avatar name={`${msg.first_name} ${msg.last_name}`} url={msg.avatar_url} size={8} />
                    ) : (
                      <div className="w-8 shrink-0" />
                    )}
                    <div className={cn('max-w-[70%]', isMine && 'items-end flex flex-col')}>
                      {!sameAuthor && (
                        <div className={cn('flex items-baseline gap-2 mb-1', isMine && 'flex-row-reverse')}>
                          <span className="text-xs font-semibold text-gray-700">
                            {isMine ? 'You' : `${msg.first_name} ${msg.last_name}`}
                          </span>
                          <span className="text-xs text-gray-400">{fullTimeLabel(msg.created_at)}</span>
                        </div>
                      )}
                      <div className={cn(
                        'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                        isMine
                          ? 'bg-indigo-600 text-white rounded-tr-sm'
                          : 'bg-gray-100 text-gray-900 rounded-tl-sm',
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3 bg-white">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Write a message… (Enter to send)"
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-gray-400 max-h-32"
            style={{ fieldSizing: 'content' } as any}
          />
          <button
            onClick={() => text.trim() && sendMut.mutate(text.trim())}
            disabled={!text.trim() || sendMut.isPending}
            className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center transition-colors shrink-0"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Conversation item ─────────────────────────────────────────────────────────

function ConvItem({ conv, active, onClick, currentUserId }: { conv: any; active: boolean; onClick: () => void; currentUserId: string }) {
  const isDept = conv.type === 'department';
  const name = isDept ? conv.department_name : `${conv.other_user?.first_name ?? ''} ${conv.other_user?.last_name ?? ''}`.trim();
  const lastMsg = conv.last_message?.content ?? '';
  const lastTime = conv.last_message?.created_at;

  return (
    <button onClick={onClick}
      className={cn('w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors',
        active ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50')}>
      {isDept
        ? <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><Hash size={15} className="text-indigo-600" /></div>
        : <Avatar name={name} url={conv.other_user?.avatar_url} size={9} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn('text-sm font-medium truncate', active ? 'text-indigo-700' : 'text-gray-900')}>{name}</span>
          {lastTime && <span className="text-xs text-gray-400 shrink-0 ml-1">{timeAgo(lastTime)}</span>}
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">{lastMsg || 'No messages yet'}</p>
      </div>
      {conv.unread_count > 0 && (
        <span className="ml-1 bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
          {conv.unread_count > 9 ? '9+' : conv.unread_count}
        </span>
      )}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function ChatContent() {
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const [activeConvId, setActiveConvId] = useState<string | null>(searchParams.get('conv'));
  const [showNew, setShowNew] = useState(false);

  const { data: convs } = useQuery({
    queryKey: ['chat-convs'],
    queryFn: chatApi.getConversations,
    refetchInterval: 5000,
  });

  const direct: any[] = convs?.direct ?? [];
  const dept: any[] = convs?.department ?? [];

  const activeConv = [...direct, ...dept].find((c) => c.id === activeConvId);
  const isDept = activeConv?.type === 'department';
  const activeTitle = isDept
    ? activeConv?.department_name
    : `${activeConv?.other_user?.first_name ?? ''} ${activeConv?.other_user?.last_name ?? ''}`.trim();

  return (
    <div className="h-[calc(100vh-10rem)] flex gap-0 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Sidebar */}
      <div className="w-72 flex flex-col border-r border-gray-100 shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="font-bold text-gray-900 text-lg">Messages</h1>
          <button onClick={() => setShowNew(true)}
            className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center transition-colors">
            <Plus size={16} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {direct.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1.5">Direct Messages</p>
              <div className="space-y-0.5">
                {direct.map((c) => (
                  <ConvItem key={c.id} conv={c} active={c.id === activeConvId} onClick={() => setActiveConvId(c.id)} currentUserId={user?.id ?? ''} />
                ))}
              </div>
            </div>
          )}

          {dept.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1.5">Departments</p>
              <div className="space-y-0.5">
                {dept.map((c) => (
                  <ConvItem key={c.id} conv={c} active={c.id === activeConvId} onClick={() => setActiveConvId(c.id)} currentUserId={user?.id ?? ''} />
                ))}
              </div>
            </div>
          )}

          {direct.length === 0 && dept.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">No conversations yet</p>
              <button onClick={() => setShowNew(true)} className="mt-2 text-indigo-600 text-sm font-medium hover:underline">
                Start one
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConvId && user ? (
          <>
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3 bg-white">
              {isDept
                ? <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center"><Hash size={15} className="text-indigo-600" /></div>
                : <Avatar name={activeTitle} url={activeConv?.other_user?.avatar_url} size={8} />}
              <div>
                <p className="font-semibold text-gray-900 text-sm">{activeTitle}</p>
                {isDept && <p className="text-xs text-gray-400">Department channel</p>}
                {!isDept && activeConv?.other_user?.job_title && (
                  <p className="text-xs text-gray-400">{activeConv.other_user.job_title}</p>
                )}
              </div>
            </div>
            <MessageThread convId={activeConvId} currentUserId={user.id} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <Send size={26} className="text-indigo-400" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">Select a conversation</p>
            <p className="text-sm text-gray-400">Or start a new message</p>
            <button onClick={() => setShowNew(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors">
              + New Message
            </button>
          </div>
        )}
      </div>

      {showNew && <NewConvModal onClose={() => setShowNew(false)} onOpen={(id) => setActiveConvId(id)} />}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
