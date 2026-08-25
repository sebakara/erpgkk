'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { chatApi, projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { usePresenceStore } from '@/store/presence.store';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { Send, Plus, X, Hash, User, Search, Users, FolderOpen } from 'lucide-react';

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

function MessageBody({ content, mine }: { content: string; mine: boolean }) {
  const parts = content.split(/(@[A-Za-z][\w.-]*)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className={cn('font-semibold', mine ? 'text-indigo-100 underline' : 'text-indigo-700')}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

function NewConvModal({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<'person' | 'dept' | 'project'>('person');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({ queryKey: ['chat-users'], queryFn: chatApi.getUsers });
  const { data: depts = [] } = useQuery({ queryKey: ['chat-depts'], queryFn: chatApi.getDepartments });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });

  const directMut = useMutation({
    mutationFn: (userId: string) => chatApi.startDirect(userId),
    onSuccess: (conv) => { qc.invalidateQueries({ queryKey: ['chat-convs'] }); onOpen(conv.id); onClose(); },
  });
  const deptMut = useMutation({
    mutationFn: (deptId: string) => chatApi.startDepartment(deptId),
    onSuccess: (conv) => { qc.invalidateQueries({ queryKey: ['chat-convs'] }); onOpen(conv.id); onClose(); },
  });
  const projectMut = useMutation({
    mutationFn: (projectId: string) => chatApi.startProject(projectId),
    onSuccess: (conv) => { qc.invalidateQueries({ queryKey: ['chat-convs'] }); onOpen(conv.id); onClose(); },
  });

  const q = search.toLowerCase();
  const filteredUsers = (users as any[]).filter((u) => `${u.first_name} ${u.last_name}`.toLowerCase().includes(q));
  const filteredDepts = (depts as any[]).filter((d) => d.name.toLowerCase().includes(q));
  const filteredProjects = (projects as any[]).filter((p) => p.name.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Message</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <div className="flex border-b border-gray-100">
          {([
            { key: 'person', label: 'Person', icon: User },
            { key: 'dept', label: 'Department', icon: Users },
            { key: 'project', label: 'Project', icon: FolderOpen },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); setSearch(''); }}
              className={cn('flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                tab === key ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700')}>
              <Icon size={14} /> {label}
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
              placeholder={tab === 'person' ? 'Search employees…' : tab === 'dept' ? 'Search departments…' : 'Search projects…'}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {tab === 'person' && filteredUsers.map((u: any) => (
              <button key={u.id} onClick={() => directMut.mutate(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left">
                <Avatar name={`${u.first_name} ${u.last_name}`} url={u.avatar_url} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                  {u.job_title && <p className="text-xs text-gray-400">{u.job_title}</p>}
                </div>
              </button>
            ))}
            {tab === 'dept' && filteredDepts.map((d: any) => (
              <button key={d.id} onClick={() => deptMut.mutate(d.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <Hash size={14} className="text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">{d.name}</p>
              </button>
            ))}
            {tab === 'project' && filteredProjects.map((p: any) => (
              <button key={p.id} onClick={() => projectMut.mutate(p.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-sm">
                  {p.icon || <FolderOpen size={14} className="text-indigo-600" />}
                </div>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageThread({ convId, currentUserId, isProject }: { convId: string; currentUserId: string; isProject: boolean }) {
  const [text, setText] = useState('');
  const [typingName, setTypingName] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTyped = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-msgs', convId],
    queryFn: () => chatApi.getMessages(convId),
  });
  const { data: users = [] } = useQuery({ queryKey: ['chat-users'], queryFn: chatApi.getUsers });

  const sendMut = useMutation({
    mutationFn: (content: string) => chatApi.sendMessage(convId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-msgs', convId] });
      qc.invalidateQueries({ queryKey: ['chat-convs'] });
      qc.invalidateQueries({ queryKey: ['leaves'] });
      qc.invalidateQueries({ queryKey: ['issues'] });
      setText('');
    },
  });

  useEffect(() => {
    const socket = getSocket();
    socket.emit('chat:join', { convId });
    const onTyping = (p: { convId: string; userId: string }) => {
      if (p.convId !== convId || p.userId === currentUserId) return;
      const u = (users as any[]).find((x) => x.id === p.userId);
      const name = u ? `${u.first_name} ${u.last_name}` : 'Someone';
      setTypingName(name);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingName(null), 2000);
    };
    socket.on('chat:typing', onTyping);
    return () => {
      socket.emit('chat:leave', { convId });
      socket.off('chat:typing', onTyping);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [convId, currentUserId, users]);

  useEffect(() => {
    chatApi.markRead(convId).then(() => qc.invalidateQueries({ queryKey: ['chat-convs'] }));
  }, [convId, (messages as any[]).length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTyped.current < 400) return;
    lastTyped.current = now;
    getSocket().emit('chat:typing', { convId });
  }, [convId]);

  const groups = groupByDate(messages as any[]);
  const isSlash = text.startsWith('/');

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
      e.preventDefault();
      sendMut.mutate(text.trim());
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
              <Send size={22} className="text-indigo-400" />
            </div>
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Try @name{isProject ? ', /issue Fix the login bug' : ', /leave annual 2026-09-01 2026-09-05'}
            </p>
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
                if (msg.kind === 'system') {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <div className="max-w-[85%] text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-center">
                        {msg.content}
                      </div>
                    </div>
                  );
                }
                const isMine = msg.sender_id === currentUserId;
                const prevMsg = group.messages[idx - 1];
                const sameAuthor = prevMsg && prevMsg.kind !== 'system' && prevMsg.sender_id === msg.sender_id;

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
                        <MessageBody content={msg.content} mine={isMine} />
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

      <div className="border-t border-gray-100 px-4 py-3 bg-white">
        {typingName && (
          <p className="text-xs text-gray-400 mb-1.5 px-1">{typingName} is typing…</p>
        )}
        {isSlash && (
          <div className="text-[11px] text-gray-500 mb-1.5 px-1 space-y-0.5">
            <p><span className="font-mono text-indigo-600">/leave</span> type start end [reason] — e.g. /leave annual 2026-09-01 2026-09-05</p>
            <p><span className="font-mono text-indigo-600">/issue</span> title — project rooms only</p>
          </div>
        )}
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); emitTyping(); }}
            onKeyDown={handleKey}
            placeholder={isProject ? 'Message, @name, /issue, /leave…' : 'Message, @name, /leave…'}
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

function ConvItem({ conv, active, onClick }: { conv: any; active: boolean; onClick: () => void }) {
  const isDept = conv.type === 'department';
  const isProject = conv.type === 'project';
  const name = isDept
    ? conv.department_name
    : isProject
      ? conv.project_name
      : `${conv.other_user?.first_name ?? ''} ${conv.other_user?.last_name ?? ''}`.trim();
  const lastMsg = conv.last_message?.content ?? '';
  const lastTime = conv.last_message?.created_at;
  const online = usePresenceStore((s) => (conv.other_user?.id ? s.isOnline(conv.other_user.id) : false));

  return (
    <button onClick={onClick}
      className={cn('w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors',
        active ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50')}>
      {isDept ? (
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><Hash size={15} className="text-indigo-600" /></div>
      ) : isProject ? (
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-base">{conv.project_icon || <FolderOpen size={15} className="text-indigo-600" />}</div>
      ) : (
        <div className="relative shrink-0">
          <Avatar name={name} url={conv.other_user?.avatar_url} size={9} />
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
            online ? 'bg-green-500' : 'bg-gray-300',
          )} />
        </div>
      )}
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

function ChatContent() {
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const [activeConvId, setActiveConvId] = useState<string | null>(searchParams.get('conv'));
  const [showNew, setShowNew] = useState(false);
  const online = usePresenceStore((s) => s.isOnline);

  const { data: convs } = useQuery({
    queryKey: ['chat-convs'],
    queryFn: chatApi.getConversations,
    refetchInterval: 30000,
  });

  const direct: any[] = convs?.direct ?? [];
  const dept: any[] = convs?.department ?? [];
  const project: any[] = convs?.project ?? [];

  const activeConv = [...direct, ...dept, ...project].find((c) => c.id === activeConvId);
  const isDept = activeConv?.type === 'department';
  const isProject = activeConv?.type === 'project';
  const activeTitle = isDept
    ? activeConv?.department_name
    : isProject
      ? activeConv?.project_name
      : `${activeConv?.other_user?.first_name ?? ''} ${activeConv?.other_user?.last_name ?? ''}`.trim();
  const peerOnline = activeConv?.other_user?.id ? online(activeConv.other_user.id) : false;

  return (
    <div className="h-[calc(100vh-10rem)] flex gap-0 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
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
                  <ConvItem key={c.id} conv={c} active={c.id === activeConvId} onClick={() => setActiveConvId(c.id)} />
                ))}
              </div>
            </div>
          )}

          {project.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1.5">Projects</p>
              <div className="space-y-0.5">
                {project.map((c) => (
                  <ConvItem key={c.id} conv={c} active={c.id === activeConvId} onClick={() => setActiveConvId(c.id)} />
                ))}
              </div>
            </div>
          )}

          {dept.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1.5">Departments</p>
              <div className="space-y-0.5">
                {dept.map((c) => (
                  <ConvItem key={c.id} conv={c} active={c.id === activeConvId} onClick={() => setActiveConvId(c.id)} />
                ))}
              </div>
            </div>
          )}

          {direct.length === 0 && dept.length === 0 && project.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">No conversations yet</p>
              <button onClick={() => setShowNew(true)} className="mt-2 text-indigo-600 text-sm font-medium hover:underline">
                Start one
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {activeConvId && user ? (
          <>
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3 bg-white">
              {isDept ? (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center"><Hash size={15} className="text-indigo-600" /></div>
              ) : isProject ? (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-base">{activeConv?.project_icon || <FolderOpen size={15} className="text-indigo-600" />}</div>
              ) : (
                <div className="relative">
                  <Avatar name={activeTitle} url={activeConv?.other_user?.avatar_url} size={8} />
                  <span className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                    peerOnline ? 'bg-green-500' : 'bg-gray-300',
                  )} />
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 text-sm">{activeTitle}</p>
                {isDept && <p className="text-xs text-gray-400">Department channel</p>}
                {isProject && <p className="text-xs text-gray-400">Project room · /issue to create a task</p>}
                {!isDept && !isProject && (
                  <p className="text-xs text-gray-400">
                    {peerOnline ? 'Online' : (activeConv?.other_user?.job_title || 'Offline')}
                  </p>
                )}
              </div>
            </div>
            <MessageThread convId={activeConvId} currentUserId={user.id} isProject={!!isProject} />
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
