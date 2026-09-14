import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Issue, TaskPerson } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isOverdue(due?: string | null, status?: string | null) {
  if (!due || status === 'done') return false;
  const day = new Date(`${due}T00:00:00`);
  if (Number.isNaN(day.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return day < today;
}

export function assigneesOf(issue: Issue): TaskPerson[] {
  if (Array.isArray(issue.assignees) && issue.assignees.length) return issue.assignees;
  if (issue.assignee_id && issue.assignee_name) {
    return [{
      id: issue.assignee_id,
      name: issue.assignee_name,
      email: issue.assignee_email,
      job_title: issue.assignee_job_title,
      role: issue.assignee_role,
      avatar_url: issue.assignee_avatar,
      department: issue.assignee_department,
      involvement: 'Assignee',
    }];
  }
  return [];
}

export function issueAssigneeIds(issue: Issue): string[] {
  return assigneesOf(issue).map((person) => person.id);
}

export function issueHasAssignee(issue: Issue, userId: string) {
  return issueAssigneeIds(issue).includes(userId);
}

export function issueIsUnassigned(issue: Issue) {
  return issueAssigneeIds(issue).length === 0;
}
