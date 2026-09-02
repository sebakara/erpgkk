export enum Role {
  Admin = 'admin',
  Manager = 'manager',
  Employee = 'employee',
  Hr = 'hr',
}

export enum IssueType {
  Bug = 'bug',
  Task = 'task',
  Story = 'story',
  Epic = 'epic',
}

export enum IssueStatus {
  Backlog = 'backlog',
  Todo = 'todo',
  InProgress = 'in_progress',
  InReview = 'in_review',
  Done = 'done',
}

export enum IssuePriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum SprintStatus {
  Planning = 'planning',
  Active = 'active',
  Completed = 'completed',
}

export enum LeaveType {
  Annual = 'annual',
  Sick = 'sick',
  Emergency = 'emergency',
  Unpaid = 'unpaid',
  Maternity = 'maternity',
  Paternity = 'paternity',
}

export enum LeaveStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum NotificationEventType {
  IssueAssigned = 'issue_assigned',
  IssueStatusChanged = 'issue_status_changed',
  CommentAdded = 'comment_added',
  CommentMention = 'comment_mention',
  SprintStarted = 'sprint_started',
  SprintCompleted = 'sprint_completed',
  LeaveRequested = 'leave_requested',
  LeaveApproved = 'leave_approved',
  LeaveRejected = 'leave_rejected',
  LeavePackageAllocated = 'leave_package_allocated',
  ReviewCreated = 'performance_review_created',
  ReviewSubmitted = 'performance_review_submitted',
  Announcement = 'announcement',
  ChatMention = 'chat_mention',
  ProjectAccessGranted = 'project_access_granted',
  ProjectAccessRevoked = 'project_access_revoked',
  FileUploaded = 'file_uploaded',
  DepartmentHeadAssigned = 'department_head_assigned',
  RoleChanged = 'role_changed',
  DepartmentChanged = 'department_changed',
}
