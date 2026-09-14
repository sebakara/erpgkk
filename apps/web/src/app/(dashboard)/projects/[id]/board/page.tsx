'use client';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { issuesApi, projectsApi, sprintsApi } from '@/lib/api';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { cn, getInitials, isOverdue, issueHasAssignee, issueIsUnassigned } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { ISSUE_STATUS_COLUMNS, type Issue, type ProjectMember, type Sprint } from '@/types';
import toast from 'react-hot-toast';

export default function BoardPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const showWorkload = role !== 'employee';
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssignee] = useState('all');
  const [sprintOverride, setSprintOverride] = useState<string | undefined>(undefined);
  const [hideCompleted, setHideCompleted] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const members: ProjectMember[] = project?.members ?? [];

  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId),
  });
  const activeSprint = sprints.find((s) => s.status === 'active');
  const sprintFilter = sprintOverride ?? activeSprint?.id ?? 'all';
  const selectedSprint = sprints.find((s) => s.id === sprintFilter);

  const { data: issues = [], isLoading } = useQuery<Issue[]>({
    queryKey: ['issues', projectId, 'all'],
    queryFn: () => issuesApi.list(projectId),
    enabled: !!projectId,
  });

  const statsSprintId = sprintFilter !== 'all' && sprintFilter !== 'none' ? sprintFilter : activeSprint?.id;
  const { data: stats } = useQuery({
    queryKey: ['sprint-stats', projectId, statsSprintId],
    queryFn: () => sprintsApi.stats(projectId, statsSprintId!),
    enabled: !!statsSprintId && sprintFilter !== 'all' && sprintFilter !== 'none',
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status, position }: { id: string; status: string; position: number }) =>
      issuesApi.move(projectId, id, { status, position }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues', projectId] }),
    onError: () => toast.error('Failed to move issue'),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((i) => {
      if (hideCompleted && i.status === 'done') return false;
      if (assigneeFilter === 'unassigned' && !issueIsUnassigned(i)) return false;
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && !issueHasAssignee(i, assigneeFilter)) return false;
      if (sprintFilter === 'none' && i.sprint_id) return false;
      if (sprintFilter !== 'all' && sprintFilter !== 'none' && i.sprint_id !== sprintFilter) return false;
      if (q && !i.title.toLowerCase().includes(q) && !(i.label || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [issues, search, assigneeFilter, sprintFilter, hideCompleted]);

  const columns = ISSUE_STATUS_COLUMNS.map((col) => ({
    ...col,
    issues: filtered.filter((i) => i.status === col.key).sort((a, b) => a.position - b.position),
  }));

  const createSprintId = sprintFilter !== 'all' && sprintFilter !== 'none' ? sprintFilter : undefined;
  const defaultSprint = activeSprint?.id ?? 'all';
  const filtersActive = search || assigneeFilter !== 'all' || sprintFilter !== defaultSprint || hideCompleted;

  const workload = useMemo(() => {
    if (!showWorkload) return [];
    return members.map((m) => {
      const theirs = issues.filter((i) => issueHasAssignee(i, m.id) && i.status !== 'done');
      return {
        member: m,
        open: theirs.length,
        overdue: theirs.filter((i) => isOverdue(i.due_date, i.status)).length,
        inReview: theirs.filter((i) => i.status === 'in_review').length,
      };
    }).sort((a, b) => b.open - a.open);
  }, [showWorkload, members, issues]);

  const unassignedOpen = issues.filter((i) => issueIsUnassigned(i) && i.status !== 'done').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cyclePct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-15rem)] min-h-[560px]">
      {selectedSprint && (
        <div className="shrink-0 bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
              {selectedSprint.status === 'active' ? 'Active cycle' : selectedSprint.status === 'planning' ? 'Planning' : 'Completed cycle'}
            </p>
            <p className="text-sm font-semibold text-gray-900 truncate">{selectedSprint.name}</p>
          </div>
          {selectedSprint.start_date && selectedSprint.end_date && (
            <p className="text-xs text-gray-500">
              {new Date(selectedSprint.start_date).toLocaleDateString()} → {new Date(selectedSprint.end_date).toLocaleDateString()}
            </p>
          )}
          {stats && (
            <div className="flex items-center gap-2 ml-auto min-w-[180px]">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${cyclePct}%` }} />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {stats.done}/{stats.total} done
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <h1 className="text-lg font-semibold text-gray-900 mr-2">Board</h1>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks"
            className="w-52 pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssignee(e.target.value)}
          className="text-sm bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.first_name} {m.last_name}
            </option>
          ))}
        </select>
        {sprints.length > 0 && (
          <select
            value={sprintFilter}
            onChange={(e) => setSprintOverride(e.target.value)}
            className="text-sm bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All sprints</option>
            <option value="none">No sprint</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.status === 'active' ? ' (active)' : ''}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setHideCompleted((v) => !v)}
          className={cn(
            'text-sm px-2.5 py-1.5 rounded-lg border transition-colors',
            hideCompleted
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
          )}
        >
          Hide completed
        </button>
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setAssignee('all');
              setSprintOverride(undefined);
              setHideCompleted(false);
            }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} of {issues.length} tasks
        </span>
      </div>

      {showWorkload && workload.some((w) => w.open > 0) && (
        <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 shrink-0">Workload</span>
          {workload.filter((w) => w.open > 0).map(({ member, open, overdue, inReview }) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setAssignee(member.id)}
              className={cn(
                'flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full border text-xs shrink-0',
                assigneeFilter === member.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50',
              )}
            >
              {member.avatar_url ? (
                <img src={member.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold flex items-center justify-center">
                  {getInitials(`${member.first_name} ${member.last_name}`)}
                </span>
              )}
              <span className="text-gray-700">{member.first_name}</span>
              <span className="text-gray-400">{open}</span>
              {inReview > 0 && <span className="text-purple-600">{inReview} review</span>}
              {overdue > 0 && <span className="text-red-600">{overdue} overdue</span>}
            </button>
          ))}
          {unassignedOpen > 0 && (
            <button
              type="button"
              onClick={() => setAssignee('unassigned')}
              className={cn(
                'text-xs px-2 py-0.5 rounded-full border shrink-0',
                assigneeFilter === 'unassigned' ? 'border-indigo-400 bg-indigo-50' : 'border-dashed border-gray-300 text-gray-500',
              )}
            >
              Unassigned {unassignedOpen}
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <KanbanBoard
          columns={columns}
          onMove={(issueId, status, position) => moveMutation.mutate({ id: issueId, status, position })}
          projectId={projectId}
          sprintId={createSprintId}
        />
      </div>
    </div>
  );
}
