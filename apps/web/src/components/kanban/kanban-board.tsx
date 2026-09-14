'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  MeasuringStrategy,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { KanbanColumn } from './kanban-column';
import { IssueCardFace } from './issue-card';
import { IssueDetailDrawer } from '@/components/issues/issue-detail-drawer';
import { useAuthStore } from '@/store/auth.store';
import { canManageProjects } from '@/lib/roles';
import { issueAssigneeIds } from '@/lib/utils';
import type { Issue, IssueStatus, ProjectMember } from '@/types';

interface Column { key: IssueStatus; label: string; color: string; issues: Issue[] }

function columnsFingerprint(columns: Column[]) {
  return JSON.stringify(columns.map((c) => ({
    k: c.key,
    items: c.issues.map((i) => `${i.id}:${issueAssigneeIds(i).join(',')}:${i.status}:${(i.pull_requests ?? []).map((p) => `${p.id}:${p.merged}`).join(',')}`),
  })));
}

interface Props {
  columns: Column[];
  onMove: (issueId: string, status: string, position: number) => void;
  projectId: string;
  sprintId?: string;
}

export function KanbanBoard({ columns: initialColumns, onMove, projectId, sprintId }: Props) {
  const [cols, setCols] = useState<Column[]>(initialColumns);
  const isDragging = useRef(false);
  const serverFingerprint = useRef(columnsFingerprint(initialColumns));

  useEffect(() => {
    const next = columnsFingerprint(initialColumns);
    if (isDragging.current) return;
    if (next !== serverFingerprint.current) {
      serverFingerprint.current = next;
      setCols(initialColumns);
    }
  }, [initialColumns]);

  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [activeTargetKey, setActiveTargetKey] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  // Track the column the card came from — onDragOver moves it before handleDragEnd fires
  const srcColKeyRef = useRef<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const members: ProjectMember[] = project?.members ?? [];
  const user = useAuthStore((s) => s.user);
  const myProjectRole = members.find((m) => m.id === user?.id)?.role;
  const canAssign = canManageProjects(user?.role, project?.owner_id, user?.id, myProjectRole);

  const patchIssue = useCallback((issueId: string, patch: Partial<Issue>) => {
    setCols((prev) =>
      prev.map((c) => ({
        ...c,
        issues: c.issues.map((i) => (i.id === issueId ? { ...i, ...patch } : i)),
      })),
    );
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  /** Find which column an id belongs to (column key or issue id) */
  const findColumn = useCallback((id: string): Column | undefined => {
    return cols.find((c) => c.key === id || c.issues.some((i) => i.id === id));
  }, [cols]);

  const handleDragStart = (event: DragStartEvent) => {
    isDragging.current = true;
    const activeId = String(event.active.id);
    const issue = cols.flatMap((c) => c.issues).find((i) => i.id === activeId);
    setActiveIssue(issue ?? null);
    srcColKeyRef.current = cols.find((c) => c.issues.some((i) => i.id === activeId))?.key ?? null;
  };

  /** Live update: move card between columns as you hover */
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId   = String(over.id);
    if (activeId === overId) return;

    const activeCol = findColumn(activeId);
    const overCol   = findColumn(overId);
    if (!activeCol || !overCol || activeCol.key === overCol.key) return;

    setActiveTargetKey(overCol.key);
    setCols((prev) => {
      const src  = prev.find((c) => c.key === activeCol.key)!;
      const dest = prev.find((c) => c.key === overCol.key)!;
      const card = src.issues.find((i) => i.id === activeId)!;

      // Determine insertion index in destination column
      const overIndex = dest.issues.findIndex((i) => i.id === overId);
      const insertAt  = overIndex >= 0 ? overIndex : dest.issues.length;

      return prev.map((c) => {
        if (c.key === src.key)  return { ...c, issues: c.issues.filter((i) => i.id !== activeId) };
        if (c.key === dest.key) {
          const next = [...dest.issues];
          next.splice(insertAt, 0, { ...card, status: dest.key as IssueStatus });
          return { ...c, issues: next };
        }
        return c;
      });
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    isDragging.current = false;
    const { active, over } = event;
    setActiveIssue(null);
    setActiveTargetKey(null);

    const origColKey = srcColKeyRef.current;
    srcColKeyRef.current = null;

    if (!over || !origColKey) return;

    const activeId = String(active.id);
    const overId   = String(over.id);

    // overCol is determined from the pre-optimistic state (origColKey) vs where we dropped
    const overCol = cols.find((c) => c.key === overId || c.issues.some((i) => i.id === overId));
    if (!overCol) return;

    if (origColKey === overCol.key) {
      // Same-column reorder: onDragOver didn't touch cols for this, so positions are still original
      const col = cols.find((c) => c.key === origColKey)!;
      const oldIndex = col.issues.findIndex((i) => i.id === activeId);
      const newIndex = col.issues.findIndex((i) => i.id === overId);
      if (oldIndex !== newIndex && newIndex >= 0) {
        const reordered = arrayMove(col.issues, oldIndex, newIndex);
        setCols((prev) => prev.map((c) => c.key === col.key ? { ...c, issues: reordered } : c));
        onMove(activeId, col.key, newIndex + 1);
      }
    } else {
      // Cross-column: card already moved optimistically in onDragOver; fire the server call
      const destCol = cols.find((c) => c.key === overCol.key)!;
      const position = destCol.issues.findIndex((i) => i.id === activeId);
      onMove(activeId, overCol.key, position >= 0 ? position + 1 : destCol.issues.length);
    }
  };

  const handleDragCancel = () => {
    isDragging.current = false;
    setActiveIssue(null);
    setActiveTargetKey(null);
    setCols(initialColumns); // restore
  };

  return (
    <div className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-3 overflow-x-auto h-full min-h-[520px] pb-1">
          {cols.map((col) => (
            <KanbanColumn
              key={col.key}
              column={col}
              projectId={projectId}
              sprintId={sprintId}
              isDragTarget={activeTargetKey === col.key}
              onCardClick={(issue) => setSelectedIssueId(issue.id)}
              members={members}
              canAssign={canAssign}
              onIssuePatch={patchIssue}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
          {activeIssue ? (
            <IssueCardFace
              issue={activeIssue}
              overlay
              className="w-[264px]"
              members={members}
              projectId={projectId}
              canAssign={false}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedIssueId && (
        <IssueDetailDrawer
          projectId={projectId}
          issueId={selectedIssueId}
          members={members}
          canAssign={canAssign}
          onClose={() => setSelectedIssueId(null)}
        />
      )}
    </div>
  );
}
