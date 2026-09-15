'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Play, CheckCircle, Bug, CheckSquare, BookOpen, Zap, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { sprintsApi, issuesApi } from '@/lib/api';
import { SprintCreateModal } from '@/components/sprint/sprint-create-modal';
import { cn, getInitials } from '@/lib/utils';
import { canPlanWork } from '@/lib/roles';
import { useAuthStore } from '@/store/auth.store';
import { PRIORITY_CONFIG, type Issue, type Sprint } from '@/types';
import toast from 'react-hot-toast';

const TYPE_ICON = { bug: Bug, task: CheckSquare, story: BookOpen, epic: Zap };
const TYPE_COLOR = { bug: 'text-red-500', task: 'text-blue-500', story: 'text-green-500', epic: 'text-purple-500' };

export default function BacklogPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const canPlan = canPlanWork(useAuthStore((s) => s.user?.role));
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addIssueToSprint, setAddIssueToSprint] = useState<Sprint | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Sprint | null>(null);

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery<Sprint[]>({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId),
  });

  // Fetch ALL project issues in one call, then group by sprint_id client-side
  const { data: allIssues = [], isLoading: issuesLoading } = useQuery<Issue[]>({
    queryKey: ['issues', projectId, 'all'],
    queryFn: () => issuesApi.list(projectId),
  });

  const issuesBySprint = allIssues.reduce<Record<string, Issue[]>>((acc, issue) => {
    const key = issue.sprint_id ?? '__backlog__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {});
  const backlogIssues = issuesBySprint['__backlog__'] ?? [];
  const activeSprint = sprints.find((s) => s.status === 'active');
  const nextPlanning = sprints.filter((s) => s.status === 'planning').sort((a, b) => a.name.localeCompare(b.name))[0];

  const startSprintMutation = useMutation({
    mutationFn: (sprintId: string) => sprintsApi.start(projectId, sprintId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success('Sprint started');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to start sprint'),
  });

  const completeSprintMutation = useMutation({
    mutationFn: (sprintId: string) => sprintsApi.complete(projectId, sprintId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      setCompleteTarget(null);
      const rolled = res?.rolled ?? 0;
      if (rolled && res?.rolledTo) toast.success(`Sprint completed. ${rolled} issue${rolled === 1 ? '' : 's'} moved to ${res.rolledTo.name}`);
      else if (rolled) toast.success(`Sprint completed. ${rolled} issue${rolled === 1 ? '' : 's'} moved to backlog`);
      else toast.success('Sprint completed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to complete sprint'),
  });

  const moveToSprintMutation = useMutation({
    mutationFn: ({ issueId, sprintId }: { issueId: string; sprintId: string | null }) =>
      issuesApi.update(projectId, issueId, { sprint_id: sprintId }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      if (vars.sprintId) toast.success('Moved to sprint');
      else toast.success('Moved to backlog');
    },
    onError: () => toast.error('Failed to move issue'),
  });

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  if (sprintsLoading || issuesLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sprint Planning</h1>
        {canPlan && (
        <button
          onClick={() => setShowCreateSprint(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={15} />
          Create Sprint
        </button>
        )}
      </div>

      {/* Sprint sections */}
      {sprints.map((sprint) => {
        const issues: Issue[] = issuesBySprint[sprint.id] ?? [];
        const totalPts = issues.reduce((s, i) => s + (i.story_points ?? 0), 0);
        const donePts = issues.filter((i) => i.status === 'done').reduce((s, i) => s + (i.story_points ?? 0), 0);
        const doneCount = issues.filter((i) => i.status === 'done').length;
        const isOpen = !collapsed[sprint.id];

        return (
          <div key={sprint.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Sprint header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <button onClick={() => toggle(sprint.id)} className="text-gray-400 hover:text-gray-600">
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{sprint.name}</span>
                  <SprintStatusBadge status={sprint.status} />
                  {sprint.start_date && sprint.end_date && (
                    <span className="text-xs text-gray-400">
                      {new Date(sprint.start_date).toLocaleDateString()} → {new Date(sprint.end_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {sprint.goal && <p className="text-xs text-gray-500 mt-0.5 truncate">{sprint.goal}</p>}
              </div>

              {/* Sprint stats */}
              <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                <span>{issues.length} issue{issues.length !== 1 ? 's' : ''}</span>
                {totalPts > 0 && (
                  <span className="hidden sm:block">
                    {donePts}/{totalPts} pts ({Math.round((donePts / totalPts) * 100)}%)
                  </span>
                )}
                {doneCount > 0 && totalPts > 0 && (
                  <div className="hidden md:flex items-center gap-1">
                    <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${(donePts / totalPts) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sprint actions */}
              <div className="flex items-center gap-2 shrink-0">
                {canPlan && sprint.status !== 'completed' && backlogIssues.length > 0 && (
                  <button
                    onClick={() => setAddIssueToSprint(sprint)}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={11} />
                    Add Issues
                  </button>
                )}
                {canPlan && sprint.status === 'planning' && (
                  <button
                    onClick={() => startSprintMutation.mutate(sprint.id)}
                    disabled={!!activeSprint}
                    title={activeSprint ? `Complete “${activeSprint.name}” first` : 'Start this sprint'}
                    className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play size={11} />
                    Start
                  </button>
                )}
                {sprint.status === 'active' && (
                  <>
                    <Link
                      href={`/projects/${projectId}/board`}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                      Open Board
                    </Link>
                    {canPlan && (
                    <button
                      onClick={() => setCompleteTarget(sprint)}
                      className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckCircle size={11} />
                      Complete
                    </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Sprint issues */}
            {isOpen && (
              <div>
                {issues.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400 italic">
                    No issues in this sprint. Drag issues from backlog or use the move button.
                  </p>
                ) : (
                  issues.map((issue) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      sprints={sprints.filter((s) => s.id !== sprint.id && s.status !== 'completed')}
                      onMove={(targetSprintId) =>
                        moveToSprintMutation.mutate({ issueId: issue.id, sprintId: targetSprintId })
                      }
                      onMoveToBacklog={() =>
                        moveToSprintMutation.mutate({ issueId: issue.id, sprintId: null })
                      }
                      showBacklogOption
                      canPlan={canPlan}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {sprints.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-400 text-sm mb-3">No sprints yet. {canPlan ? 'Create your first sprint to start planning.' : 'A manager will create the first sprint.'}</p>
          {canPlan && (
          <button
            onClick={() => setShowCreateSprint(true)}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            + Create Sprint
          </button>
          )}
        </div>
      )}

      {/* Backlog section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <button onClick={() => toggle('backlog')} className="text-gray-400 hover:text-gray-600">
            {!collapsed['backlog'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="font-semibold text-gray-900 text-sm">Backlog</span>
          <span className="text-xs text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full">
            {backlogIssues.length}
          </span>
        </div>

        {!collapsed['backlog'] && (
          <div>
            {backlogIssues.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400 italic">Backlog is empty.</p>
            ) : (
              backlogIssues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  sprints={sprints.filter((s) => s.status !== 'completed')}
                  onMove={(sprintId) =>
                    moveToSprintMutation.mutate({ issueId: issue.id, sprintId })
                  }
                  onMoveToBacklog={() => {}}
                  showBacklogOption={false}
                  canPlan={canPlan}
                />
              ))
            )}
          </div>
        )}
      </div>

      {showCreateSprint && (
        <SprintCreateModal projectId={projectId} onClose={() => setShowCreateSprint(false)} />
      )}

      {addIssueToSprint && (
        <AddIssuesToSprintModal
          sprint={addIssueToSprint}
          backlogIssues={backlogIssues}
          onMove={(issueId) => moveToSprintMutation.mutate({ issueId, sprintId: addIssueToSprint.id })}
          onClose={() => setAddIssueToSprint(null)}
        />
      )}

      {completeTarget && (
        <CompleteSprintModal
          sprint={completeTarget}
          leftover={(issuesBySprint[completeTarget.id] ?? []).filter((i) => i.status !== 'done').length}
          rolledToName={nextPlanning?.name}
          pending={completeSprintMutation.isPending}
          onConfirm={() => completeSprintMutation.mutate(completeTarget.id)}
          onClose={() => setCompleteTarget(null)}
        />
      )}
    </div>
  );
}

function CompleteSprintModal({
  sprint,
  leftover,
  rolledToName,
  pending,
  onConfirm,
  onClose,
}: {
  sprint: Sprint;
  leftover: number;
  rolledToName?: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-gray-900">Complete {sprint.name}?</h2>
        <p className="text-sm text-gray-600 mt-2">
          {leftover === 0
            ? 'All issues in this sprint are done.'
            : leftover === 1
              ? rolledToName
                ? `1 unfinished issue will move to ${rolledToName}.`
                : '1 unfinished issue will move back to the backlog.'
              : rolledToName
                ? `${leftover} unfinished issues will move to ${rolledToName}.`
                : `${leftover} unfinished issues will move back to the backlog.`}
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {pending ? 'Completing…' : 'Complete sprint'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddIssuesToSprintModal({
  sprint,
  backlogIssues,
  onMove,
  onClose,
}: {
  sprint: Sprint;
  backlogIssues: Issue[];
  onMove: (issueId: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const filtered = backlogIssues.filter((i) =>
    i.title.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleAdd = () => {
    selected.forEach((id) => onMove(id));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Add Issues to Sprint</h2>
            <p className="text-xs text-gray-400 mt-0.5">{sprint.name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search backlog issues…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Issue list */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No backlog issues found</p>
          ) : (
            filtered.map((issue) => {
              const Icon = TYPE_ICON[issue.type];
              const priority = PRIORITY_CONFIG[issue.priority];
              const checked = selected.has(issue.id);
              return (
                <label
                  key={issue.id}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors',
                    checked ? 'bg-indigo-50' : 'hover:bg-gray-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(issue.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className={cn('shrink-0', TYPE_COLOR[issue.type])}>
                    <Icon size={14} />
                  </div>
                  <span className="flex-1 text-sm text-gray-800 truncate">{issue.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: priority.color }} />
                      {priority.label}
                    </span>
                    {issue.story_points != null && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{issue.story_points}pt</span>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {selected.size} issue{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={selected.size === 0}
              onClick={handleAdd}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
            >
              Add to Sprint
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SprintStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planning: 'bg-blue-50 text-blue-700',
    active: 'bg-green-50 text-green-700',
    completed: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize', styles[status] ?? styles.planning)}>
      {status}
    </span>
  );
}

function IssueRow({
  issue,
  sprints,
  onMove,
  onMoveToBacklog,
  showBacklogOption,
  canPlan,
}: {
  issue: Issue;
  sprints: Sprint[];
  onMove: (sprintId: string) => void;
  onMoveToBacklog: () => void;
  showBacklogOption: boolean;
  canPlan?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const Icon = TYPE_ICON[issue.type];
  const priority = PRIORITY_CONFIG[issue.priority];

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 group transition-colors last:border-b-0">
      {/* Type */}
      <div className={cn('shrink-0', TYPE_COLOR[issue.type])}>
        <Icon size={14} />
      </div>

      {/* Title */}
      <p className="flex-1 text-sm text-gray-800 truncate min-w-0">{issue.title}</p>

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: priority.color }} />
          {priority.label}
        </span>
        {issue.story_points != null && (
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{issue.story_points}pt</span>
        )}
        {issue.status !== 'backlog' && (
          <span className="text-xs capitalize text-gray-400">{issue.status.replace('_', ' ')}</span>
        )}
        {issue.assignee_name && (
          <div
            className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold flex items-center justify-center"
            title={issue.assignee_name}
          >
            {getInitials(issue.assignee_name)}
          </div>
        )}
      </div>

      {/* Move to sprint */}
      {canPlan && sprints.length > 0 && (
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 px-2 py-1 rounded-md transition-colors"
          >
            <ArrowRight size={12} />
            Sprint
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                {showBacklogOption && (
                  <>
                    <button
                      onClick={() => { onMoveToBacklog(); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-500"
                    >
                      ↩ Move to Backlog
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                  </>
                )}
                {sprints.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { onMove(s.id); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{s.name}</span>
                    <SprintStatusBadge status={s.status} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
