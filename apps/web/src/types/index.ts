export type Role = 'admin' | 'manager' | 'employee' | 'hr';
export type IssueType = 'bug' | 'task' | 'story' | 'epic';
export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
export type SprintStatus = 'planning' | 'active' | 'completed';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'annual' | 'sick' | 'emergency' | 'unpaid' | 'maternity' | 'paternity';

export interface User {
  id: string;
  company_id: string;
  department_id?: string;
  department_name?: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  avatar_url?: string;
  job_title?: string;
  reports_to?: string;
  reports_to_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  manager_id?: string;
  manager_name?: string;
}

export interface Project {
  id: string;
  company_id: string;
  owner_id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'completed';
  color?: string;
  icon?: string;
  members?: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  avatar_url?: string;
  role: 'owner' | 'member' | 'viewer';
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal?: string;
  status: SprintStatus;
  start_date?: string;
  end_date?: string;
}

export interface Issue {
  id: string;
  project_id: string;
  sprint_id?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_avatar?: string;
  reporter_id: string;
  reporter_name?: string;
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  story_points?: number;
  position: number;
  label?: string;
  due_date?: string;
  comments?: Comment[];
  created_at: string;
}

export interface Comment {
  id: string;
  issue_id: string;
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  body: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  employee_name?: string;
  employee_reports_to?: string;
  employee_department_id?: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason?: string;
  status: LeaveStatus;
  approver_name?: string;
  approver_note?: string;
}

export interface Announcement {
  id: string;
  author_id: string;
  author_name?: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
}

export interface Doc {
  id: string;
  project_id: string;
  author_id: string;
  author_name?: string;
  title: string;
  content?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface LeavePackageType {
  id: string;
  package_id: string;
  leave_type: string;
  days_allowed: number;
}

export interface LeavePackage {
  id: string;
  company_id: string;
  created_by: string;
  created_by_name?: string;
  name: string;
  period_start: string;
  period_end: string;
  types: LeavePackageType[];
  employee_count?: number;
  allocated_user_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  package_id: string;
  package_name: string;
  period_start: string;
  period_end: string;
  leave_type: string;
  days_allowed: number;
  days_used: number;
  days_remaining: number;
}

export interface PerformanceReview {
  id: string;
  company_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_name?: string;
  reviewee_name?: string;
  period: string;
  status: 'draft' | 'submitted' | 'acknowledged';
  score?: number;
  feedback?: string;
  goals?: string;
  created_at: string;
  updated_at: string;
}

export interface StandupNote {
  id: string;
  subject_user_id: string;
  standup_date: string;
  content: string;
  first_name: string;
  last_name: string;
  job_title?: string;
  avatar_url?: string;
  department_id?: string;
  project?: {
    id: string;
    name: string;
    color?: string;
    icon?: string;
    status: 'active' | 'archived' | 'completed';
  };
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  payload?: any;
  is_read: boolean;
  created_at: string;
}

export const ISSUE_STATUS_COLUMNS: { key: IssueStatus; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: '#6b7280' },
  { key: 'todo', label: 'To Do', color: '#3b82f6' },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { key: 'in_review', label: 'In Review', color: '#8b5cf6' },
  { key: 'done', label: 'Done', color: '#10b981' },
];

export const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#6b7280' },
  medium: { label: 'Medium', color: '#3b82f6' },
  high: { label: 'High', color: '#f59e0b' },
  urgent: { label: 'Urgent', color: '#ef4444' },
};
