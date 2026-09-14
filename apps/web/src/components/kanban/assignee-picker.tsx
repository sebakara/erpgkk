'use client';
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Search, UserMinus } from 'lucide-react';
import { issuesApi } from '@/lib/api';
import { assigneesOf, cn, getInitials, issueAssigneeIds } from '@/lib/utils';
import { PersonHoverAvatar, UnassignedAvatar } from '@/components/people/person-hover-avatar';
import toast from 'react-hot-toast';
import type { Issue, TaskPerson } from '@/types';

const AVATAR_COLORS = [
  { bg: '#d8c4f0', fg: '#5a3d7a' },
  { bg: '#c5e4f7', fg: '#1e5a7a' },
  { bg: '#fde2c8', fg: '#8a4b12' },
  { bg: '#d4edda', fg: '#1e5c34' },
  { bg: '#f8d0d8', fg: '#8a1e3a' },
];

function colorFor(id: string) {
  let n = 0;
  for (const c of id) n += c.charCodeAt(0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

type AssignablePerson = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
};

interface Props {
  issue: Issue;
  projectId: string;
  members: AssignablePerson[];
  canAssign?: boolean;
  disabled?: boolean;
  onIssuePatch?: (issueId: string, patch: Partial<Issue>) => void;
}

function patchAssignees(issue: Issue, members: AssignablePerson[], ids: string[]): Issue {
  const people: TaskPerson[] = ids
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is AssignablePerson => !!m)
    .map((m) => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`.trim(),
      email: m.email,
      avatar_url: m.avatar_url,
      involvement: 'Assignee',
    }));
  const lead = people[0];
  return {
    ...issue,
    assignees: people,
    assignee_id: lead?.id,
    assignee_name: lead?.name,
    assignee_avatar: lead?.avatar_url,
    assignee_email: lead?.email,
    assignee_job_title: undefined,
    assignee_role: undefined,
    assignee_department: undefined,
  };
}

function Face({ person, size }: { person: TaskPerson; size: number }) {
  const color = colorFor(person.id);
  return (
    <span
      className="rounded-full shrink-0 overflow-hidden ring-2 ring-white flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: person.avatar_url ? undefined : color.bg,
      }}
      title={person.name}
    >
      {person.avatar_url ? (
        <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[9px] font-bold" style={{ color: color.fg }}>
          {getInitials(person.name)}
        </span>
      )}
    </span>
  );
}

export function AssigneePicker({ issue, projectId, members, canAssign, disabled, onIssuePatch }: Props) {
  const qc = useQueryClient();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, place: 'below' as 'above' | 'below' });

  const assigned = assigneesOf(issue);
  const assignedIds = issueAssigneeIds(issue);
  const idsRef = useRef<string[] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (!q) return true;
      const name = `${m.first_name} ${m.last_name}`.toLowerCase();
      return name.includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [members, query]);

  const writeCache = (ids: string[]) => {
    const patched = patchAssignees(issue, members, ids);
    qc.setQueriesData({ queryKey: ['issues', projectId] }, (old: Issue[] | undefined) => {
      if (!Array.isArray(old)) return old;
      return old.map((item) => (item.id === issue.id ? patched : item));
    });
    qc.setQueryData(['issue', projectId, issue.id], (old: Issue | undefined) =>
      old ? { ...old, ...patched } : old,
    );
    onIssuePatch?.(issue.id, patched);
  };

  const assign = useMutation({
    mutationFn: () => {
      const ids = idsRef.current ?? assignedIds;
      return issuesApi.update(projectId, issue.id, { assignee_ids: ids, assignee_id: ids[0] ?? null });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['issues', projectId] });
      return { previous: qc.getQueriesData({ queryKey: ['issues', projectId] }) };
    },
    onError: (_err, _void, ctx) => {
      idsRef.current = null;
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
      onIssuePatch?.(issue.id, issue);
      toast.error('Could not assign task');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      qc.invalidateQueries({ queryKey: ['issue', projectId, issue.id] });
      qc.invalidateQueries({ queryKey: ['workspace-overview'] });
    },
  });

  const queueAssignees = (ids: string[]) => {
    idsRef.current = ids;
    writeCache(ids);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      assign.mutate();
    }, 220);
  };

  const toggle = (userId: string) => {
    const current = idsRef.current ?? assignedIds;
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    queueAssignees(next);
  };

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }, []);

  const placeMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const place = r.bottom + 320 > window.innerHeight && r.top > 280 ? 'above' : 'below';
    setPos({
      top: place === 'above' ? r.top : r.bottom,
      left: Math.min(r.right, window.innerWidth - 16),
      place,
    });
  };

  const openMenu = (e: SyntheticEvent) => {
    e.stopPropagation();
    if (!canAssign || disabled) return;
    placeMenu();
    setOpen(true);
  };

  const block = (e: SyntheticEvent) => e.stopPropagation();

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 20);
    const inside = (node: EventTarget | null) => {
      const el = node as Node | null;
      return !!(el && (triggerRef.current?.contains(el) || menuRef.current?.contains(el)));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: Event) => {
      if (!inside(e.target)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (inside(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const visible = assigned.slice(0, 3);
  const extra = assigned.length - visible.length;
  const names = assigned.map((p) => p.name).join(', ');

  if (!canAssign || disabled) {
    if (!assigned.length) return <UnassignedAvatar size={24} disabled={disabled} />;
    return (
      <span className="flex items-center -space-x-1.5">
        {visible.map((person) => (
          <PersonHoverAvatar key={person.id} person={person} size={24} disabled={disabled} />
        ))}
        {extra > 0 && (
          <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[9px] font-semibold flex items-center justify-center ring-2 ring-white">
            +{extra}
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={names ? `Assigned to ${names}. Click to add or remove people` : 'Assign people'}
        onPointerDown={block}
        onClick={openMenu}
        className="flex items-center -space-x-1.5 rounded-full shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        {visible.map((person) => (
          <Face key={person.id} person={person} size={24} />
        ))}
        {extra > 0 && (
          <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[9px] font-semibold flex items-center justify-center ring-2 ring-white">
            +{extra}
          </span>
        )}
        <span
          className={cn(
            'rounded-full shrink-0 ring-2 ring-white border border-dashed flex items-center justify-center',
            assigned.length
              ? 'border-gray-300 bg-white text-gray-400 hover:border-indigo-400 hover:text-indigo-500'
              : 'border-gray-300 bg-white text-gray-400 hover:border-indigo-400 hover:bg-indigo-50',
          )}
          style={{ width: 24, height: 24 }}
        >
          <Plus size={11} />
        </span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          onPointerDown={block}
          onClick={block}
          onWheel={(e) => e.stopPropagation()}
          className="fixed z-[90] w-72 flex flex-col"
          style={{
            top: pos.top,
            left: pos.left,
            transform: pos.place === 'above' ? 'translate(-100%, calc(-100% - 8px))' : 'translate(-100%, 8px)',
            maxHeight: pos.place === 'above'
              ? Math.max(180, pos.top - 16)
              : Math.max(180, window.innerHeight - pos.top - 24),
          }}
        >
          <div className="bg-white rounded-xl shadow-[0_12px_40px_rgba(15,23,42,0.18)] border border-gray-100 overflow-hidden flex flex-col min-h-0 max-h-full">
            <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Assignees{assigned.length ? ` · ${assigned.length}` : ''}
              </p>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or email"
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div
              className="overflow-y-auto overscroll-contain py-1 min-h-0 flex-1"
              onWheel={(e) => e.stopPropagation()}
            >
              {assigned.length > 0 && (
                <button
                  type="button"
                  onClick={() => queueAssignees([])}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <span className="w-7 h-7 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                    <UserMinus size={13} />
                  </span>
                  Remove all
                </button>
              )}
              {filtered.map((m) => {
                const selected = assignedIds.includes(m.id);
                const color = colorFor(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50',
                      selected && 'bg-indigo-50',
                    )}
                  >
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <span
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{ background: color.bg, color: color.fg }}
                      >
                        {getInitials(`${m.first_name} ${m.last_name}`)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-900 truncate">{m.first_name} {m.last_name}</span>
                      <span className="block text-[11px] text-gray-400 truncate">{m.email}</span>
                    </span>
                    {selected && <Check size={14} className="shrink-0 text-indigo-600" />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-gray-400 text-center">No matching people</p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
