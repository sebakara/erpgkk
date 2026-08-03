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
  IssueAssigned = 'issue.assigned',
  IssueCommented = 'issue.commented',
  SprintStarted = 'sprint.started',
  SprintCompleted = 'sprint.completed',
  LeaveRequested = 'leave.requested',
  LeaveApproved = 'leave.approved',
  LeaveRejected = 'leave.rejected',
  ReviewSubmitted = 'review.submitted',
  Announcement = 'announcement.created',
  MentionedInComment = 'mention.comment',
}
