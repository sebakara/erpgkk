'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Bug, CheckSquare, BookOpen, Zap, Send, Pencil, Save } from 'lucide-react';
import { issuesApi } from '@/lib/api';
import { PRIORITY_CONFIG, type Issue, type IssueStatus, type IssuePriority, type IssueType, type ProjectMember, type Comment } from '@/types';
import { getInitials, formatDate, cn, assigneesOf } from '@/lib/utils';
import { AssigneePicker } from '@/components/kanban/assignee-picker';
import { IssuePrLinks } from '@/components/issues/issue-pr-links';
import toast from 'react-hot-toast';

const TYPE_ICON = { bug: Bug, task: CheckSquare, story: BookOpen, epic: Zap };
const TYPE_COLOR = { bug: 'text-red-500', task: 'text-blue-500', story: 'text-green-500', epic: 'text-purple-500' };
const TYPE_BG = { bug: 'bg-red-50', task: 'bg-blue-50', story: 'bg-green-50', epic: 'bg-purple-50' };

interface Props {
  projectId: string;
  issueId: string;
  members: ProjectMember[];
  canAssign?: boolean;
  onClose: () => void;
}

export function IssueDetailDrawer({ projectId, issueId, members, canAssign, onClose }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [editForm, setEditForm] = useState<Partial<Issue>>({});

  const { data: issue, isLoading } = useQuery<Issue>({
    queryKey: ['issue', projectId, issueId],
    queryFn: () => issuesApi.get(projectId, issueId),
  });

  useEffect(() => {
    if (issue && !editing) {
      setEditForm({
        title: issue.title,
        description: issue.description,
        type: issue.type,
        priority: issue.priority,
        status: issue.status,
        story_points: issue.story_points,
        due_date: issue.due_date,
      });
    }
  }, [issue, editing]);

  const updateMutation = useMutation({
    mutationFn: () => issuesApi.update(projectId, issueId, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue', projectId, issueId] });
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      toast.success('Issue updated');
      setEditing(false);
    },
    onError: () => toast.error('Failed to update issue'),
  });

  const commentMutation = useMutation({
    mutationFn: () => issuesApi.comment(projectId, issueId, commentText.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue', projectId, issueId] });
      setCommentText('');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  const ef =
    (k: keyof typeof editForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setEditForm((f) => ({ ...f, [k]: e.target.value === '' ? undefined : e.target.value }));

  if (isLoading || !issue) {
    return (
      <div className="fixed inset-0 z-40 flex" onClick={onClose}>
        <div className="flex-1" />
        <div className="w-[520px] h-full bg-white shadow-2xl flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const TypeIcon = TYPE_ICON[issue.type];
  const priority = PRIORITY_CONFIG[issue.priority];
  const comments: Comment[] = issue.comments || [];

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/20" />
      <div
        className="w-[560px] h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className={cn('p-1.5 rounded-md', TYPE_BG[issue.type])}>
            <TypeIcon size={16} className={TYPE_COLOR[issue.type]} />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={editForm.title ?? ''}
                onChange={ef('title')}
                className="w-full text-base font-semibold text-gray-900 border-b border-primary-400 focus:outline-none pb-0.5"
              />
            ) : (
              <h2 className="text-base font-semibold text-gray-900 truncate">{issue.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                >
                  <Save size={12} />
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1.5 rounded-lg transition-colors"
              >
                <Pencil size={12} />
                Edit
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Meta fields */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <MetaRow label="Status">
                {editing ? (
                  <select
                    value={editForm.status ?? issue.status}
                    onChange={ef('status')}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <StatusBadge status={issue.status} />
                )}
              </MetaRow>

              <MetaRow label="Priority">
                {editing ? (
                  <select
                    value={editForm.priority ?? issue.priority}
                    onChange={ef('priority')}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-gray-700">
                    <span className="w-2 h-2 rounded-full" style={{ background: priority.color }} />
                    {priority.label}
                  </span>
                )}
              </MetaRow>

              <MetaRow label="Type">
                {editing ? (
                  <select
                    value={editForm.type ?? issue.type}
                    onChange={ef('type')}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full"
                  >
                    <option value="task">Task</option>
                    <option value="bug">Bug</option>
                    <option value="story">Story</option>
                    <option value="epic">Epic</option>
                  </select>
                ) : (
                  <span className={cn('text-sm font-medium capitalize', TYPE_COLOR[issue.type])}>{issue.type}</span>
                )}
              </MetaRow>

              <MetaRow label="Assignees">
                <div className="flex items-center gap-2 min-w-0">
                  <AssigneePicker
                    issue={issue}
                    projectId={projectId}
                    members={members}
                    canAssign={canAssign}
                  />
                  <span className={cn('text-sm truncate', assigneesOf(issue).length ? 'text-gray-700' : 'text-gray-400')}>
                    {assigneesOf(issue).map((p) => p.name).join(', ') || 'Unassigned'}
                  </span>
                </div>
              </MetaRow>

              <MetaRow label="Story Points">
                {editing ? (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.story_points ?? ''}
                    onChange={ef('story_points')}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full"
                  />
                ) : (
                  <span className="text-sm text-gray-700">
                    {issue.story_points != null ? `${issue.story_points} pts` : '—'}
                  </span>
                )}
              </MetaRow>

              <MetaRow label="Due Date">
                {editing ? (
                  <input
                    type="date"
                    value={editForm.due_date ?? ''}
                    onChange={ef('due_date')}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full"
                  />
                ) : (
                  <span className="text-sm text-gray-700">{issue.due_date ? formatDate(issue.due_date) : '—'}</span>
                )}
              </MetaRow>

              <MetaRow label="Reporter">
                <span className="text-sm text-gray-700">{issue.reporter_name ?? '—'}</span>
              </MetaRow>

              <MetaRow label="Created">
                <span className="text-sm text-gray-700">{formatDate(issue.created_at)}</span>
              </MetaRow>
            </div>
          </div>

          {/* Description */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Description</p>
            {editing ? (
              <textarea
                value={editForm.description ?? ''}
                onChange={ef('description')}
                rows={5}
                placeholder="Add a description..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            ) : issue.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{issue.description}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No description provided.</p>
            )}
          </div>

          <IssuePrLinks projectId={projectId} issue={issue} />

          {/* Comments */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">
              Comments {comments.length > 0 && <span className="text-gray-400">({comments.length})</span>}
            </p>
            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {getInitials(c.author_name ?? 'U')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-800">{c.author_name}</span>
                      <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{c.body}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-gray-400 italic">No comments yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Comment input */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-3 items-end">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && commentText.trim()) {
                  commentMutation.mutate();
                }
              }}
              placeholder="Add a comment… (Cmd+Enter to submit)"
              rows={2}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white"
            />
            <button
              onClick={() => commentText.trim() && commentMutation.mutate()}
              disabled={!commentText.trim() || commentMutation.isPending}
              className="p-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<IssueStatus, string> = {
  backlog: 'bg-gray-100 text-gray-600',
  todo: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  in_review: 'bg-purple-50 text-purple-700',
  done: 'bg-green-50 text-green-700',
};
const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
