'use client';
import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { issuesApi } from '@/lib/api';
import { IssueCard } from './issue-card';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Issue, IssueStatus, ProjectMember } from '@/types';

interface Column { key: IssueStatus; label: string; color: string; issues: Issue[] }

interface Props {
  column: Column;
  projectId: string;
  sprintId?: string;
  isDragTarget?: boolean;
  onCardClick: (issue: Issue) => void;
  members: ProjectMember[];
  canAssign: boolean;
  canCreate?: boolean;
  onIssuePatch?: (issueId: string, patch: Partial<Issue>) => void;
}

export function KanbanColumn({ column, projectId, sprintId, isDragTarget, onCardClick, members, canAssign, canCreate, onIssuePatch }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  const [adding, setAdding] = useState(false);

  return (
    <section
      className={cn(
        'flex flex-col w-[280px] shrink-0 rounded-2xl h-full max-h-full',
        (isOver || isDragTarget) ? 'bg-[#e6f0ff]' : 'bg-[#eceae8]',
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: column.color }} />
        <h2 className="text-[15px] font-semibold text-gray-800 truncate">{column.label}</h2>
        <span className="text-xs text-gray-500">{column.issues.length}</span>
        {canCreate && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ml-auto p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-black/5"
            title={`Add task to ${column.label}`}
          >
            <Plus size={16} />
          </button>
        )}
      </header>

      <SortableContext items={column.issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 overflow-y-auto px-2 pb-1 space-y-2 min-h-[80px]">
          {column.issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onCardClick={onCardClick}
              members={members}
              projectId={projectId}
              canAssign={canAssign}
              onIssuePatch={onIssuePatch}
            />
          ))}
        </div>
      </SortableContext>

      {canCreate && (
      <div className="px-2 pb-2 pt-1">
        {adding ? (
          <InlineAddTask
            projectId={projectId}
            sprintId={sprintId}
            status={column.key}
            onClose={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-500 hover:text-gray-800 hover:bg-black/5 rounded-lg"
          >
            <Plus size={14} /> Add task
          </button>
        )}
      </div>
      )}
    </section>
  );
}

function InlineAddTask({
  projectId,
  sprintId,
  status,
  onClose,
}: {
  projectId: string;
  sprintId?: string;
  status: IssueStatus;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const create = useMutation({
    mutationFn: () =>
      issuesApi.create(projectId, {
        title: title.trim(),
        type: 'task',
        status,
        sprint_id: sprintId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      setTitle('');
      ref.current?.focus();
    },
    onError: () => toast.error('Could not add task'),
  });

  const submit = () => {
    if (!title.trim() || create.isPending) return;
    create.mutate();
  };

  return (
    <div className="bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-2">
      <textarea
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Task name"
        rows={2}
        className="w-full resize-none text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
      />
      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || create.isPending}
          className="px-3 py-1 text-[13px] font-semibold text-white bg-[#4573d2] hover:bg-[#3d68c5] rounded-md disabled:opacity-50"
        >
          {create.isPending ? 'Adding…' : 'Add task'}
        </button>
        <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
