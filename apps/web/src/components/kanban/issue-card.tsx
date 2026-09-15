'use client';
import { forwardRef, useEffect, useRef, type HTMLAttributes } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MessageSquare } from 'lucide-react';
import { assigneesOf, cn } from '@/lib/utils';
import { PersonHoverAvatar } from '@/components/people/person-hover-avatar';
import { AssigneePicker } from '@/components/kanban/assignee-picker';
import { IssuePrBadges } from '@/components/issues/issue-pr-links';
import { PRIORITY_CONFIG, type Issue, type ProjectMember, type TaskPerson } from '@/types';

function dueMeta(due?: string) {
  if (!due) return null;
  const day = new Date(`${due}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const label = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff < 0) return { label, tone: 'text-red-600 bg-red-50' };
  if (diff === 0) return { label: 'Today', tone: 'text-amber-700 bg-amber-50' };
  if (diff === 1) return { label: 'Tomorrow', tone: 'text-gray-600 bg-gray-100' };
  return { label, tone: 'text-gray-500 bg-gray-100' };
}

function parseCommenters(raw: Issue['commenters_json']): TaskPerson[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p: any) => p?.id && p?.name)
      .map((p: any) => ({
        id: String(p.id),
        name: String(p.name),
        email: p.email || undefined,
        job_title: p.job_title || undefined,
        role: p.role || undefined,
        avatar_url: p.avatar_url || undefined,
        department: p.department || undefined,
        involvement: 'Contributor',
      }));
  } catch {
    return [];
  }
}

function peopleOnIssue(issue: Issue): TaskPerson[] {
  const people: TaskPerson[] = [];
  const seen = new Set<string>();

  const add = (person: TaskPerson) => {
    if (!person.id || seen.has(person.id)) return;
    seen.add(person.id);
    people.push(person);
  };

  for (const person of assigneesOf(issue)) add(person);

  for (const commenter of parseCommenters(issue.commenters_json)) add(commenter);

  if (issue.reporter_id && issue.reporter_name) {
    add({
      id: issue.reporter_id,
      name: issue.reporter_name,
      email: issue.reporter_email,
      job_title: issue.reporter_job_title,
      role: issue.reporter_role,
      avatar_url: issue.reporter_avatar,
      department: issue.reporter_department,
      involvement: 'Reporter',
    });
  }

  return people;
}

interface FaceProps extends HTMLAttributes<HTMLDivElement> {
  issue: Issue;
  faded?: boolean;
  overlay?: boolean;
  members?: ProjectMember[];
  projectId?: string;
  canAssign?: boolean;
  onIssuePatch?: (issueId: string, patch: Partial<Issue>) => void;
}

export const IssueCardFace = forwardRef<HTMLDivElement, FaceProps>(
  function IssueCardFace({ issue, faded, overlay, className, onClick, members = [], projectId, canAssign, onIssuePatch, ...rest }, ref) {
    const priority = PRIORITY_CONFIG[issue.priority];
    const due = dueMeta(issue.due_date);
    const comments = Number(issue.comment_count ?? issue.comments?.length ?? 0);
    const people = peopleOnIssue(issue).filter((p) => p.involvement !== 'Assignee');
    const visible = people.slice(0, 2);
    const extra = people.length - visible.length;

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          'w-full text-left bg-white rounded-lg border border-transparent px-3 py-2.5 select-none',
          overlay
            ? 'shadow-[0_12px_28px_rgba(0,0,0,0.16)] rotate-2 cursor-grabbing'
            : 'shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-gray-200 cursor-grab active:cursor-grabbing',
          'transition-shadow',
          faded && 'opacity-30 shadow-none',
          className,
        )}
        {...rest}
      >
        {issue.label && (
          <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 rounded px-1.5 py-0.5 mb-1.5">
            {issue.label}
          </span>
        )}
        <p className="text-[13px] font-medium text-gray-900 leading-snug">{issue.title}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {(issue.priority === 'urgent' || issue.priority === 'high') && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: priority.color }} title={priority.label} />
            )}
            {due && (
              <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5', due.tone)}>
                <Calendar size={11} />
                {due.label}
              </span>
            )}
            {comments > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400">
                <MessageSquare size={11} /> {comments}
              </span>
            )}
            <IssuePrBadges issue={issue} />
          </div>
          <div className="flex items-center -space-x-1.5 shrink-0">
            {visible.map((person) => (
              <PersonHoverAvatar key={person.id} person={person} size={22} disabled={overlay || faded} />
            ))}
            {extra > 0 && (
              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[9px] font-semibold flex items-center justify-center ring-2 ring-white">
                +{extra}
              </span>
            )}
            {projectId ? (
              <AssigneePicker
                issue={issue}
                projectId={projectId}
                members={members}
                canAssign={canAssign}
                disabled={overlay || faded}
                onIssuePatch={onIssuePatch}
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  },
);

interface Props {
  issue: Issue;
  isDragging?: boolean;
  onCardClick?: (issue: Issue) => void;
  members?: ProjectMember[];
  projectId?: string;
  canAssign?: boolean;
  onIssuePatch?: (issueId: string, patch: Partial<Issue>) => void;
}

export function IssueCard({ issue, isDragging, onCardClick, members, projectId, canAssign, onIssuePatch }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortDragging,
  } = useSortable({ id: issue.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const faded = isDragging || isSortDragging;
  const suppressClick = useRef(false);

  useEffect(() => {
    if (isSortDragging) suppressClick.current = true;
  }, [isSortDragging]);

  return (
    <IssueCardFace
      ref={setNodeRef}
      issue={issue}
      faded={faded}
      members={members}
      projectId={projectId}
      canAssign={canAssign}
      onIssuePatch={onIssuePatch}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (suppressClick.current || faded) {
          suppressClick.current = false;
          return;
        }
        onCardClick?.(issue);
      }}
    />
  );
}
