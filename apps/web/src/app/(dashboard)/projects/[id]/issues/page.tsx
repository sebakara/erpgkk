'use client';
import { useState, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Bug, CheckSquare, BookOpen, Zap, Search, Filter, X, ChevronDown,
  Tag, Calendar, User, GitBranch, MessageSquare, AlertCircle, CheckCircle2,
  Layers, ArrowUpDown, Trash2, Circle, Clock,
} from 'lucide-react';
import { issuesApi, sprintsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn, getInitials, formatDate, assigneesOf, issueHasAssignee } from '@/lib/utils';
import { AssigneePicker } from '@/components/kanban/assignee-picker';
import { canManageProjects, canPlanWork } from '@/lib/roles';
import toast from 'react-hot-toast';
import type { Issue, Sprint } from '@/types';

/* ── constants ── */
const TYPE_META = {
  bug:   { icon: Bug,         color: 'text-red-500',    bg: 'bg-red-50',    label: 'Bug'   },
  task:  { icon: CheckSquare, color: 'text-blue-500',   bg: 'bg-blue-50',   label: 'Task'  },
  story: { icon: BookOpen,    color: 'text-green-500',  bg: 'bg-green-50',  label: 'Story' },
  epic:  { icon: Zap,         color: 'text-purple-500', bg: 'bg-purple-50', label: 'Epic'  },
};

const PRIORITY_META = {
  low:    { color: '#6b7280', dot: 'bg-gray-400',   label: 'Low'    },
  medium: { color: '#3b82f6', dot: 'bg-blue-500',   label: 'Medium' },
  high:   { color: '#f59e0b', dot: 'bg-amber-500',  label: 'High'   },
  urgent: { color: '#ef4444', dot: 'bg-red-500',    label: 'Urgent' },
};

const STATUS_META = {
  backlog:    { icon: Circle,       color: 'text-gray-400',   label: 'Backlog'     },
  todo:       { icon: Circle,       color: 'text-blue-400',   label: 'To Do'       },
  in_progress:{ icon: Clock,        color: 'text-amber-500',  label: 'In Progress' },
  in_review:  { icon: GitBranch,    color: 'text-purple-500', label: 'In Review'   },
  done:       { icon: CheckCircle2, color: 'text-green-500',  label: 'Done'        },
};

const LABELS = [
  { name: 'bug',           color: '#d73a4a', bg: '#ffeef0' },
  { name: 'enhancement',   color: '#a2eeef', bg: '#e1f7f8' },
  { name: 'documentation', color: '#0075ca', bg: '#e8f4fd' },
  { name: 'question',      color: '#d876e3', bg: '#fde8ff' },
  { name: 'good first issue', color: '#7057ff', bg: '#f3f0ff' },
  { name: 'help wanted',   color: '#008672', bg: '#e0f2ee' },
  { name: 'invalid',       color: '#e4e669', bg: '#fffde7' },
  { name: 'wontfix',       color: '#ffffff', bg: '#f6f8fa' },
];

const EMPTY_FORM: Record<string, string> = {
  title: '', description: '', type: 'task', priority: 'medium', status: 'backlog',
  label: '', assignee_id: '', sprint_id: '', story_points: '', due_date: '',
};

/* ──────────────────────────────────────────────────────────────────────────
   PAGE
────────────────────────────────────────────────────────────────────────── */
export default function IssuesPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canPlan = canPlanWork(currentUser?.role);

  /* data */
  const { data: issues = [], isLoading } = useQuery<Issue[]>({
    queryKey: ['issues', projectId, 'all'],
    queryFn: () => issuesApi.list(projectId),
  });
  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId),
  });
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => usersApi.list(),
  });

  /* filters */
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [prioFilter, setPrioFilter]   = useState('all');
  const [statusFilter, setStatus]     = useState<'open' | 'closed' | 'all'>('open');
  const [assigneeFilter, setAssignee] = useState('all');
  const [labelFilter, setLabel]       = useState('all');
  const [sprintFilter, setSprint]     = useState('all');

  /* modals */
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk]     = useState(false);
  const [selected, setSelected]     = useState<string | null>(null); // issue id for detail panel

  /* create mutation */
  const createMutation = useMutation({
    mutationFn: (data: any) => issuesApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      setShowCreate(false);
      toast.success('Issue created');
    },
    onError: () => toast.error('Failed to create issue'),
  });

  /* filtered list */
  const filtered = useMemo(() => {
    return (issues as Issue[]).filter((i) => {
      const open = !['done'].includes(i.status);
      if (statusFilter === 'open' && !open) return false;
      if (statusFilter === 'closed' && open) return false;
      if (typeFilter !== 'all' && i.type !== typeFilter) return false;
      if (prioFilter !== 'all' && i.priority !== prioFilter) return false;
      if (assigneeFilter !== 'all' && !issueHasAssignee(i, assigneeFilter)) return false;
      if (labelFilter !== 'all' && i.label !== labelFilter) return false;
      if (sprintFilter !== 'all' && i.sprint_id !== sprintFilter) return false;
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [issues, statusFilter, typeFilter, prioFilter, assigneeFilter, labelFilter, sprintFilter, search]);

  const openCount   = (issues as Issue[]).filter((i) => i.status !== 'done').length;
  const closedCount = (issues as Issue[]).filter((i) => i.status === 'done').length;

  const selectedIssue = (issues as Issue[]).find((i) => i.id === selected) ?? null;

  return (
    <div className="flex gap-4 min-h-0">
      {/* ── Main column ── */}
      <div className={cn('flex-1 min-w-0 space-y-3', selected && 'hidden lg:block')}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <FilterSelect value={typeFilter} onChange={setTypeFilter} label="Type" options={[
            { value: 'all', label: 'All types' },
            ...Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label })),
          ]} />
          <FilterSelect value={prioFilter} onChange={setPrioFilter} label="Priority" options={[
            { value: 'all', label: 'All priorities' },
            ...Object.entries(PRIORITY_META).map(([k, v]) => ({ value: k, label: v.label })),
          ]} />
          <FilterSelect value={assigneeFilter} onChange={setAssignee} label="Assignee" options={[
            { value: 'all', label: 'Anyone' },
            ...((members as any[]).map((m) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))),
          ]} />
          <FilterSelect value={sprintFilter} onChange={setSprint} label="Sprint" options={[
            { value: 'all', label: 'All sprints' },
            { value: 'none', label: 'Backlog' },
            ...(sprints.map((s) => ({ value: s.id, label: s.name }))),
          ]} />

          {currentUser?.role === 'employee' && (
            <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1.5 rounded-lg font-medium">
              My assigned issues
            </span>
          )}

          <div className="flex items-center gap-1 ml-auto">
            {canPlan && (
              <button
                onClick={() => setShowBulk(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Layers size={14} /> Bulk import
              </button>
            )}
            {canPlan && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={14} /> New issue
            </button>
            )}
          </div>
        </div>

        {/* Issue list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Status tabs */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 text-sm">
            {(['open', 'closed', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn('flex items-center gap-1.5 font-medium capitalize transition-colors',
                  statusFilter === s ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600')}
              >
                {s === 'open' ? <Circle size={13} /> : s === 'closed' ? <CheckCircle2 size={13} /> : <Layers size={13} />}
                {s === 'open' ? `${openCount} Open` : s === 'closed' ? `${closedCount} Closed` : 'All'}
              </button>
            ))}
            {(typeFilter !== 'all' || prioFilter !== 'all' || assigneeFilter !== 'all' || labelFilter !== 'all' || sprintFilter !== 'all' || search) && (
              <button
                onClick={() => { setTypeFilter('all'); setPrioFilter('all'); setAssignee('all'); setLabel('all'); setSprint('all'); setSearch(''); }}
                className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
              >
                <X size={11} /> Clear filters
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <AlertCircle size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No issues found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or create a new issue.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  sprints={sprints}
                  projectId={projectId}
                  isSelected={selected === issue.id}
                  onClick={() => setSelected(selected === issue.id ? null : issue.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel ── */}
      {selectedIssue && (
        <IssueDetailPanel
          issue={selectedIssue}
          projectId={projectId}
          sprints={sprints}
          members={members as any[]}
          currentUser={currentUser}
          onClose={() => setSelected(null)}
          onUpdate={() => qc.invalidateQueries({ queryKey: ['issues', projectId] })}
        />
      )}

      {/* ── Modals ── */}
      {showCreate && (
        <IssueFormModal
          projectId={projectId}
          sprints={sprints}
          members={members as any[]}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />
      )}
      {showBulk && (
        <BulkCreateModal
          projectId={projectId}
          sprints={sprints}
          members={members as any[]}
          onClose={() => setShowBulk(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['issues', projectId] });
            setShowBulk(false);
          }}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ISSUE ROW
────────────────────────────────────────────────────────────────────────── */
function IssueRow({ issue, sprints, projectId, isSelected, onClick }: {
  issue: Issue; sprints: Sprint[]; projectId: string; isSelected: boolean; onClick: () => void;
}) {
  const qc = useQueryClient();
  const canDelete = canPlanWork(useAuthStore((s) => s.user?.role));
  const { icon: TypeIcon, color: typeColor } = TYPE_META[issue.type] ?? TYPE_META.task;
  const { dot: prioDot, label: prioLabel } = PRIORITY_META[issue.priority] ?? PRIORITY_META.medium;
  const { icon: StatusIcon, color: statusColor, label: statusLabel } = STATUS_META[issue.status] ?? STATUS_META.backlog;
  const labelMeta = LABELS.find((l) => l.name === issue.label);

  const sprint = sprints.find((s) => s.id === issue.sprint_id);

  const deleteMutation = useMutation({
    mutationFn: () => issuesApi.remove(projectId, issue.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issues', projectId] }); toast.success('Issue deleted'); },
  });

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors group',
        isSelected && 'bg-primary-50 border-l-2 border-primary-500',
      )}
    >
      {/* Status icon */}
      <div className={cn('shrink-0 mt-0.5', statusColor)}>
        <StatusIcon size={16} />
      </div>

      {/* Type icon */}
      <div className={cn('shrink-0 mt-0.5', typeColor)}>
        <TypeIcon size={14} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className={cn('text-sm font-medium text-gray-900 leading-snug', issue.status === 'done' && 'line-through text-gray-400')}>
            {issue.title}
          </p>
          {labelMeta && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0"
              style={{ color: labelMeta.color, background: labelMeta.bg, borderColor: labelMeta.color + '40' }}
            >
              {labelMeta.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className={cn('w-1.5 h-1.5 rounded-full', prioDot)} />
            {prioLabel}
          </span>
          {sprint && (
            <span className="flex items-center gap-1">
              <GitBranch size={10} /> {sprint.name}
            </span>
          )}
          {issue.story_points != null && (
            <span className="bg-gray-100 px-1.5 py-0.5 rounded font-medium text-gray-500">{issue.story_points}pt</span>
          )}
          {issue.due_date && (
            <span className="flex items-center gap-1">
              <Calendar size={10} /> {formatDate(issue.due_date)}
            </span>
          )}
          {issue.reporter_name && <span>opened by {issue.reporter_name}</span>}
        </div>
      </div>

      {/* Right meta */}
      <div className="flex items-center gap-2 shrink-0">
        {assigneesOf(issue).length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {assigneesOf(issue).slice(0, 3).map((person) => (
              <div
                key={person.id}
                className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold flex items-center justify-center ring-2 ring-white"
                title={person.name}
              >
                {getInitials(person.name)}
              </div>
            ))}
          </div>
        )}
        {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this issue?')) deleteMutation.mutate(); }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 rounded transition-all"
        >
          <Trash2 size={13} />
        </button>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ISSUE DETAIL PANEL
────────────────────────────────────────────────────────────────────────── */
function IssueDetailPanel({ issue, projectId, sprints, members, currentUser, onClose, onUpdate }: {
  issue: Issue; projectId: string; sprints: Sprint[]; members: any[]; currentUser: any; onClose: () => void; onUpdate: () => void;
}) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const makeEditForm = (i: Issue): Record<string, string> => ({
    title: i.title, description: i.description ?? '',
    type: i.type, priority: i.priority, status: i.status,
    label: i.label ?? '',
    sprint_id: i.sprint_id ?? '', story_points: i.story_points?.toString() ?? '',
    due_date: i.due_date ?? '',
  });
  const [editForm, setEditForm] = useState<Record<string, string>>(makeEditForm(issue));

  // Refresh edit form when issue changes
  useMemo(() => { setEditForm(makeEditForm(issue)); }, [issue.id]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => issuesApi.update(projectId, issue.id, data),
    onSuccess: () => { onUpdate(); setEditing(false); toast.success('Issue updated'); },
    onError: () => toast.error('Failed to update'),
  });

  const commentMutation = useMutation({
    mutationFn: () => issuesApi.comment(projectId, issue.id, comment),
    onSuccess: () => { onUpdate(); setComment(''); qc.invalidateQueries({ queryKey: ['issue', issue.id] }); },
    onError: () => toast.error('Failed to add comment'),
  });

  const { icon: TypeIcon, color: typeColor, label: typeLabel } = TYPE_META[issue.type] ?? TYPE_META.task;
  const { icon: StatusIcon, color: statusColor, label: statusLabel } = STATUS_META[issue.status] ?? STATUS_META.backlog;
  const sprint = sprints.find((s) => s.id === issue.sprint_id);
  const labelMeta = LABELS.find((l) => l.name === issue.label);
  const canAssign = canManageProjects(currentUser?.role);
  const canPlan = canPlanWork(currentUser?.role);

  return (
    <div className="w-full lg:w-[440px] shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col max-h-[calc(100vh-120px)] sticky top-4">
      {/* Header */}
      <div className="flex items-start gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full text-sm font-semibold border border-primary-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <p className="text-sm font-semibold text-gray-900 leading-snug">{issue.title}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('flex items-center gap-1 text-xs', statusColor)}>
              <StatusIcon size={12} />{statusLabel}
            </span>
            <span className="text-gray-300">·</span>
            <span className={cn('flex items-center gap-1 text-xs', typeColor)}>
              <TypeIcon size={12} />{typeLabel}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetaField label="Status">
            {editing ? (
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={META_SELECT}>
                {Object.entries(STATUS_META).filter(([k]) => canPlan || k !== 'done').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            ) : (
              <span className={cn('text-xs font-medium capitalize', statusColor)}>{statusLabel}</span>
            )}
          </MetaField>

          <MetaField label="Priority">
            {editing ? (
              <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} className={META_SELECT}>
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            ) : (
              <span className="text-xs font-medium capitalize" style={{ color: PRIORITY_META[issue.priority as keyof typeof PRIORITY_META]?.color }}>
                {PRIORITY_META[issue.priority as keyof typeof PRIORITY_META]?.label}
              </span>
            )}
          </MetaField>

          <MetaField label="Assignees">
            <div className="flex items-center gap-2 min-w-0">
              <AssigneePicker
                issue={issue}
                projectId={projectId}
                members={members}
                canAssign={canAssign}
              />
              <span className={cn('text-xs truncate', assigneesOf(issue).length ? 'text-gray-700' : 'text-gray-400')}>
                {assigneesOf(issue).map((p) => p.name).join(', ') || 'Unassigned'}
              </span>
            </div>
          </MetaField>

          <MetaField label="Sprint">
            {editing ? (
              <select value={editForm.sprint_id} onChange={(e) => setEditForm({ ...editForm, sprint_id: e.target.value })} className={META_SELECT}>
                <option value="">Backlog</option>
                {sprints.filter((s) => s.status !== 'completed').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : sprint ? (
              <span className="text-xs text-gray-700">{sprint.name}</span>
            ) : <span className="text-xs text-gray-400">Backlog</span>}
          </MetaField>

          <MetaField label="Points">
            {editing ? (
              <input type="number" min={0} max={100} value={editForm.story_points}
                onChange={(e) => setEditForm({ ...editForm, story_points: e.target.value })}
                className={cn(META_SELECT, 'w-20')} />
            ) : <span className="text-xs text-gray-700">{issue.story_points ?? '—'}</span>}
          </MetaField>

          <MetaField label="Due date">
            {editing ? (
              <input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} className={META_SELECT} />
            ) : <span className="text-xs text-gray-700">{issue.due_date ? formatDate(issue.due_date) : '—'}</span>}
          </MetaField>

          <MetaField label="Type">
            {editing ? (
              <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className={META_SELECT}>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            ) : <span className="text-xs capitalize text-gray-700">{issue.type}</span>}
          </MetaField>

          <MetaField label="Label">
            {editing ? (
              <select value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} className={META_SELECT}>
                <option value="">None</option>
                {LABELS.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
              </select>
            ) : labelMeta ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                style={{ color: labelMeta.color, background: labelMeta.bg, borderColor: labelMeta.color + '40' }}>
                {labelMeta.name}
              </span>
            ) : <span className="text-xs text-gray-400">None</span>}
          </MetaField>
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
          {editing ? (
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Add a description…"
            />
          ) : issue.description ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{issue.description}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No description.</p>
          )}
        </div>

        {/* Comments */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <MessageSquare size={11} /> Comments {issue.comments?.length ? `(${issue.comments.length})` : ''}
          </p>
          <div className="space-y-3">
            {(issue.comments ?? []).map((c: any) => (
              <div key={c.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {getInitials(c.author_name ?? '?')}
                </div>
                <div className="flex-1 min-w-0 bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-gray-500 font-medium mb-0.5">{c.author_name} · {formatDate(c.created_at)}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Leave a comment…"
              rows={2}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={() => commentMutation.mutate()}
              disabled={!comment.trim() || commentMutation.isPending}
              className="self-end px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700"
            >
              {commentMutation.isPending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
        {editing ? (
          <>
            <button onClick={() => setEditing(false)} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => updateMutation.mutate({
                ...editForm,
                story_points: editForm.story_points ? Number(editForm.story_points) : null,
                sprint_id: editForm.sprint_id || null,
                label: editForm.label || null,
                due_date: editForm.due_date || null,
              })}
              disabled={updateMutation.isPending}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
            Edit issue
          </button>
        )}
      </div>
    </div>
  );
}

const META_SELECT = 'text-xs border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white w-full';

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ISSUE FORM MODAL (single create — full GitHub style)
────────────────────────────────────────────────────────────────────────── */
function IssueFormModal({ projectId, sprints, members, onClose, onSubmit, isPending }: {
  projectId: string; sprints: Sprint[]; members: any[]; onClose: () => void;
  onSubmit: (data: any) => void; isPending: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const f = (field: string) => (e: React.ChangeEvent<any>) => setForm({ ...form, [field]: e.target.value });

  const { icon: TypeIcon, color: typeColor } = TYPE_META[form.type as keyof typeof TYPE_META] ?? TYPE_META.task;
  const labelMeta = LABELS.find((l) => l.name === form.label);

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error('Title is required');
    onSubmit({
      ...form,
      story_points: form.story_points ? Number(form.story_points) : undefined,
      assignee_id: form.assignee_id || undefined,
      sprint_id: form.sprint_id || undefined,
      label: form.label || undefined,
      due_date: form.due_date || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 pt-16 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className={cn('p-1.5 rounded-md', TYPE_META[form.type as keyof typeof TYPE_META]?.bg ?? 'bg-gray-100')}>
            <TypeIcon size={16} className={typeColor} />
          </div>
          <h2 className="text-base font-bold text-gray-900 flex-1">New Issue</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <input
              autoFocus
              value={form.title} onChange={f('title')}
              placeholder="Issue title *"
              className="w-full text-base font-medium border-0 border-b border-gray-200 pb-2 focus:outline-none focus:border-primary-400 placeholder:text-gray-300"
            />
          </div>

          {/* Description */}
          <div>
            <textarea
              value={form.description} onChange={f('description')}
              placeholder="Add a description (supports Markdown)…"
              rows={4}
              className="w-full px-0 py-2 text-sm text-gray-700 border-0 border-b border-gray-200 resize-none focus:outline-none focus:border-primary-400 placeholder:text-gray-300"
            />
          </div>

          {/* Type + Priority row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <LabeledSelect label="Type" value={form.type} onChange={f('type')}>
              {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </LabeledSelect>
            <LabeledSelect label="Priority" value={form.priority} onChange={f('priority')}>
              {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </LabeledSelect>
            <LabeledSelect label="Status" value={form.status ?? 'backlog'} onChange={f('status')}>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </LabeledSelect>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Story points</label>
              <input type="number" min={0} value={form.story_points} onChange={f('story_points')} placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {/* Assignee + Sprint + Label row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <LabeledSelect label="Assignee" value={form.assignee_id} onChange={f('assignee_id')}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </LabeledSelect>
            <LabeledSelect label="Sprint" value={form.sprint_id} onChange={f('sprint_id')}>
              <option value="">Backlog</option>
              {sprints.filter((s) => s.status !== 'completed').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </LabeledSelect>
            <LabeledSelect label="Label" value={form.label} onChange={f('label')}>
              <option value="">None</option>
              {LABELS.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
            </LabeledSelect>
          </div>

          {/* Due date */}
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-500 mb-1">Due date</label>
            <input type="date" value={form.due_date} onChange={f('due_date')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {/* Label preview */}
          {labelMeta && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Label preview:</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                style={{ color: labelMeta.color, background: labelMeta.bg, borderColor: labelMeta.color + '40' }}>
                {labelMeta.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim() || isPending}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Creating…' : 'Submit issue'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   BULK CREATE MODAL
────────────────────────────────────────────────────────────────────────── */
type BulkRow = {
  title: string; type: string; priority: string;
  assignee_id: string; sprint_id: string; label: string; story_points: string;
};

function BulkCreateModal({ projectId, sprints, members, onClose, onSuccess }: {
  projectId: string; sprints: Sprint[]; members: any[]; onClose: () => void; onSuccess: () => void;
}) {
  const [mode, setMode] = useState<'paste' | 'table'>('paste');
  const [pasteText, setPasteText] = useState('');
  // Defaults applied to all pasted issues
  const [defaults, setDefaults] = useState({ type: 'task', priority: 'medium', sprint_id: '', assignee_id: '' });
  // Table mode rows
  const emptyRow = (): BulkRow => ({ title: '', type: 'task', priority: 'medium', assignee_id: '', sprint_id: '', label: '', story_points: '' });
  const [rows, setRows] = useState<BulkRow[]>([emptyRow(), emptyRow(), emptyRow()]);

  const bulkMutation = useMutation({
    mutationFn: (issues: any[]) => issuesApi.bulkCreate(projectId, issues),
    onSuccess: (created: any[]) => { toast.success(`${created.length} issues created`); onSuccess(); },
    onError: () => toast.error('Bulk create failed'),
  });

  const handlePasteSubmit = () => {
    const titles = pasteText.split('\n').map((l) => l.replace(/^[-*•#\d.\s]+/, '').trim()).filter(Boolean);
    if (!titles.length) return toast.error('No titles found');
    bulkMutation.mutate(titles.map((title) => ({
      title,
      type: defaults.type,
      priority: defaults.priority,
      sprint_id: defaults.sprint_id || undefined,
      assignee_id: defaults.assignee_id || undefined,
    })));
  };

  const handleTableSubmit = () => {
    const valid = rows.filter((r) => r.title.trim());
    if (!valid.length) return toast.error('Add at least one issue');
    bulkMutation.mutate(valid.map((r) => ({
      ...r,
      story_points: r.story_points ? Number(r.story_points) : undefined,
      assignee_id: r.assignee_id || undefined,
      sprint_id: r.sprint_id || undefined,
      label: r.label || undefined,
    })));
  };

  const updateRow = (i: number, field: keyof BulkRow, val: string) =>
    setRows(rows.map((r, j) => j === i ? { ...r, [field]: val } : r));

  const addRow = () => setRows([...rows, emptyRow()]);
  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i));

  const activeSprints = sprints.filter((s) => s.status !== 'completed');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <Layers size={18} className="text-primary-600" />
          <h2 className="text-base font-bold text-gray-900 flex-1">Bulk Import Issues</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={18} /></button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 mx-6 mt-4 bg-gray-100 p-1 rounded-xl w-fit">
          <button onClick={() => setMode('paste')} className={cn('px-4 py-1.5 text-sm font-medium rounded-lg transition-colors', mode === 'paste' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
            Paste text
          </button>
          <button onClick={() => setMode('table')} className={cn('px-4 py-1.5 text-sm font-medium rounded-lg transition-colors', mode === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
            Table editor
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {mode === 'paste' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Paste issue titles (one per line, or a markdown list)</label>
                <textarea
                  autoFocus
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"- Fix login redirect bug\n- Add CSV export to reports\n- Improve mobile navigation\n# Epic: User onboarding\n- Welcome email\n- Onboarding checklist"}
                  rows={10}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Supports markdown lists (-, *, •, #) and numbered lists. Each line becomes one issue.
                </p>
              </div>
              {/* Defaults */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-xl">
                <p className="col-span-full text-xs font-semibold text-gray-500 uppercase tracking-wide">Apply to all</p>
                <LabeledSelect label="Type" value={defaults.type} onChange={(e) => setDefaults({ ...defaults, type: e.target.value })}>
                  {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </LabeledSelect>
                <LabeledSelect label="Priority" value={defaults.priority} onChange={(e) => setDefaults({ ...defaults, priority: e.target.value })}>
                  {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </LabeledSelect>
                <LabeledSelect label="Sprint" value={defaults.sprint_id} onChange={(e) => setDefaults({ ...defaults, sprint_id: e.target.value })}>
                  <option value="">Backlog</option>
                  {activeSprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </LabeledSelect>
                <LabeledSelect label="Assignee" value={defaults.assignee_id} onChange={(e) => setDefaults({ ...defaults, assignee_id: e.target.value })}>
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </LabeledSelect>
              </div>
              {pasteText.trim() && (
                <p className="text-xs text-gray-500">
                  Preview: {pasteText.split('\n').map((l) => l.replace(/^[-*•#\d.\s]+/, '').trim()).filter(Boolean).length} issues to create
                </p>
              )}
            </>
          ) : (
            /* Table mode */
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 font-medium min-w-[220px]">Title *</th>
                    <th className="pb-2 font-medium px-2 min-w-[90px]">Type</th>
                    <th className="pb-2 font-medium px-2 min-w-[90px]">Priority</th>
                    <th className="pb-2 font-medium px-2 min-w-[110px]">Assignee</th>
                    <th className="pb-2 font-medium px-2 min-w-[110px]">Sprint</th>
                    <th className="pb-2 font-medium px-2 min-w-[80px]">Label</th>
                    <th className="pb-2 font-medium px-2 min-w-[60px]">Pts</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={i} className="group">
                      <td className="py-1.5">
                        <input
                          value={row.title}
                          onChange={(e) => updateRow(i, 'title', e.target.value)}
                          placeholder="Issue title…"
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={row.type} onChange={(e) => updateRow(i, 'type', e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none">
                          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={row.priority} onChange={(e) => updateRow(i, 'priority', e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none">
                          {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={row.assignee_id} onChange={(e) => updateRow(i, 'assignee_id', e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none">
                          <option value="">None</option>
                          {members.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={row.sprint_id} onChange={(e) => updateRow(i, 'sprint_id', e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none">
                          <option value="">Backlog</option>
                          {activeSprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={row.label} onChange={(e) => updateRow(i, 'label', e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none">
                          <option value="">—</option>
                          {LABELS.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <input type="number" min={0} value={row.story_points} onChange={(e) => updateRow(i, 'story_points', e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none text-center" />
                      </td>
                      <td className="py-1.5 pl-2">
                        <button onClick={() => removeRow(i)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 rounded transition-all">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addRow} className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                <Plus size={14} /> Add row
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={mode === 'paste' ? handlePasteSubmit : handleTableSubmit}
            disabled={bulkMutation.isPending}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {bulkMutation.isPending ? 'Creating…' : 'Create issues'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */
function FilterSelect({ value, onChange, label, options }: {
  value: string; onChange: (v: string) => void; label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function LabeledSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select value={value} onChange={onChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
        {children}
      </select>
    </div>
  );
}
