import { Injectable, Inject, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { loadPullRequestsForIssues, insertPrLink } from '../integrations/github-pr-links';
import { v4 as uuid } from 'uuid';

type IssueWrite = {
  title?: string;
  type?: string;
  priority?: string;
  status?: string;
  assignee_id?: string | null;
  assignee_ids?: string[];
  sprint_id?: string;
  story_points?: number;
  description?: string;
  label?: string;
  due_date?: string;
  position?: number;
};

@Injectable()
export class IssuesService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async findAll(projectId: string, sprintId?: string, userId?: string, userRole?: string) {
    const q = this.knex('issues as i')
      .where('i.project_id', projectId)
      .whereNull('i.deleted_at')
      .leftJoin('users as a', 'i.assignee_id', 'a.id')
      .leftJoin('users as r', 'i.reporter_id', 'r.id')
      .leftJoin('departments as ad', 'a.department_id', 'ad.id')
      .leftJoin('departments as rd', 'r.department_id', 'rd.id')
      .select(
        'i.*',
        this.knex.raw("CONCAT(a.first_name, ' ', a.last_name) as assignee_name"),
        'a.avatar_url as assignee_avatar',
        'a.email as assignee_email',
        'a.job_title as assignee_job_title',
        'a.role as assignee_role',
        'ad.name as assignee_department',
        this.knex.raw("CONCAT(r.first_name, ' ', r.last_name) as reporter_name"),
        'r.avatar_url as reporter_avatar',
        'r.email as reporter_email',
        'r.job_title as reporter_job_title',
        'r.role as reporter_role',
        'rd.name as reporter_department',
        this.knex.raw('(select count(*) from comments where comments.issue_id = i.id) as comment_count'),
      )
      .orderBy('i.position', 'asc');
    if (sprintId) q.where('i.sprint_id', sprintId);
    if (userRole === 'employee' && userId) this.restrictToAssignee(q, userId, 'i');

    const issues = await q;
    if (!issues.length) return issues;

    const commentRows = await this.knex('comments as c')
      .join('users as u', 'c.author_id', 'u.id')
      .leftJoin('departments as d', 'u.department_id', 'd.id')
      .whereIn('c.issue_id', issues.map((issue: any) => issue.id))
      .select(
        'c.issue_id',
        'u.id',
        this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as name"),
        'u.email',
        'u.job_title',
        'u.role',
        'u.avatar_url',
        'd.name as department',
      );

    const commentersByIssue = new Map<string, any[]>();
    for (const row of commentRows) {
      const list = commentersByIssue.get(row.issue_id) ?? [];
      if (!list.some((person) => person.id === row.id)) {
        list.push({
          id: row.id,
          name: row.name,
          email: row.email,
          job_title: row.job_title,
          role: row.role,
          avatar_url: row.avatar_url,
          department: row.department,
        });
        commentersByIssue.set(row.issue_id, list);
      }
    }

    const withAssignees = await this.attachAssignees(issues);
    const withPrs = await this.attachPullRequests(withAssignees);
    return withPrs.map((issue: any) => ({
      ...issue,
      commenters_json: commentersByIssue.get(issue.id) ?? [],
    }));
  }

  backlog(projectId: string, userId?: string, userRole?: string) {
    const q = this.knex('issues').where({ project_id: projectId }).whereNull('sprint_id').whereNull('deleted_at').orderBy('position');
    if (userRole === 'employee' && userId) this.restrictToAssignee(q, userId, 'issues');
    return q;
  }

  async findById(id: string) {
    const issue = await this.knex('issues as i')
      .where('i.id', id)
      .whereNull('i.deleted_at')
      .leftJoin('users as a', 'i.assignee_id', 'a.id')
      .leftJoin('users as r', 'i.reporter_id', 'r.id')
      .leftJoin('departments as ad', 'a.department_id', 'ad.id')
      .leftJoin('departments as rd', 'r.department_id', 'rd.id')
      .select('i.*',
        this.knex.raw("CONCAT(a.first_name, ' ', a.last_name) as assignee_name"),
        'a.avatar_url as assignee_avatar',
        'a.email as assignee_email',
        'a.job_title as assignee_job_title',
        'a.role as assignee_role',
        'ad.name as assignee_department',
        this.knex.raw("CONCAT(r.first_name, ' ', r.last_name) as reporter_name"),
        'r.avatar_url as reporter_avatar',
        'r.email as reporter_email',
        'r.job_title as reporter_job_title',
        'r.role as reporter_role',
        'rd.name as reporter_department',
      )
      .first();
    if (!issue) throw new NotFoundException('Issue not found');
    const comments = await this.knex('comments as c')
      .join('users as u', 'c.author_id', 'u.id')
      .where('c.issue_id', id)
      .select('c.*', this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as author_name"), 'u.avatar_url as author_avatar')
      .orderBy('c.created_at', 'asc');
    const [withAssignees] = await this.attachAssignees([issue]);
    const [withPrs] = await this.attachPullRequests([withAssignees]);
    return { ...withPrs, comments };
  }

  async create(projectId: string, reporterId: string, data: IssueWrite & { title: string }) {
    const { assignee_ids, assignee_id, ...rest } = data;
    const ids = this.normalizeAssigneeIds(assignee_ids, assignee_id);
    const lead = ids[0] ?? null;
    const id = uuid();
    const maxPos = await this.knex('issues').where({ project_id: projectId }).max('position as m').first();
    await this.knex('issues').insert({
      id, project_id: projectId, reporter_id: reporterId,
      position: (maxPos?.m || 0) + 1,
      ...rest,
      assignee_id: lead,
      status: data.status ?? (lead ? 'todo' : 'backlog'),
    });
    await this.replaceAssignees(id, ids);
    const issue = await this.findById(id);
    this.notifyNewAssignees(ids, reporterId, issue.title);
    return issue;
  }

  async update(id: string, data: IssueWrite) {
    const { assignee_ids, assignee_id, ...rest } = data;
    const hasAssigneePayload = Array.isArray(assignee_ids) || assignee_id !== undefined;
    if (Object.keys(rest).length) {
      await this.knex('issues').where({ id }).update({ ...rest, updated_at: new Date() });
    }
    if (hasAssigneePayload) {
      const previous: string[] = await this.knex('issue_assignees').where({ issue_id: id }).pluck('user_id');
      const ids = this.normalizeAssigneeIds(assignee_ids, assignee_id);
      await this.replaceAssignees(id, ids);
      const issue = await this.findById(id);
      const added = ids.filter((uid) => !previous.includes(uid));
      this.notifyNewAssignees(added, issue.reporter_id, issue.title);
      return issue;
    }
    return this.findById(id);
  }

  async moveStatus(id: string, status: string, position: number) {
    await this.knex('issues').where({ id }).update({ status, position, updated_at: new Date() });
  }

  async addComment(issueId: string, authorId: string, body: string) {
    const id = uuid();
    await this.knex('comments').insert({ id, issue_id: issueId, author_id: authorId, body });
    const comment = await this.knex('comments as c')
      .join('users as u', 'c.author_id', 'u.id')
      .where('c.id', id)
      .select('c.*', this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as author_name"), 'u.avatar_url as author_avatar')
      .first();
    const issue = await this.knex('issues').where({ id: issueId }).select('reporter_id', 'assignee_id', 'title').first();
    const extra: string[] = await this.knex('issue_assignees').where({ issue_id: issueId }).pluck('user_id');
    const notified = new Set<string>([authorId]);
    for (const recipientId of [issue?.reporter_id, issue?.assignee_id, ...extra]) {
      if (recipientId && !notified.has(recipientId)) {
        notified.add(recipientId);
        this.notificationsGateway?.notifyUser(recipientId, {
          type: 'comment_added',
          title: 'New comment on an issue',
          body: issue.title,
        });
      }
    }
    return comment;
  }

  async bulkCreate(
    projectId: string,
    reporterId: string,
    items: IssueWrite[],
  ) {
    const maxPos = await this.knex('issues').where({ project_id: projectId }).max('position as m').first();
    let pos = (maxPos?.m || 0) + 1;
    const created: any[] = [];
    for (const item of items) {
      const { assignee_ids, assignee_id, ...rest } = item;
      const ids = this.normalizeAssigneeIds(assignee_ids, assignee_id);
      const lead = ids[0] ?? null;
      const id = uuid();
      await this.knex('issues').insert({
        id, project_id: projectId, reporter_id: reporterId,
        position: pos++,
        status: lead ? 'todo' : 'backlog',
        type: 'task', priority: 'medium',
        ...rest,
        assignee_id: lead,
      });
      await this.replaceAssignees(id, ids);
      const issue = await this.findById(id);
      created.push(issue);
      this.notifyNewAssignees(ids, reporterId, item.title ?? issue.title);
    }
    return created;
  }

  remove(id: string) {
    return this.knex('issues').where({ id }).update({ deleted_at: new Date() });
  }

  async linkPullRequest(issueId: string, pullRequestId: string) {
    const issue = await this.knex('issues').where({ id: issueId }).whereNull('deleted_at').first();
    if (!issue) throw new NotFoundException('Issue not found');
    const pr = await this.knex('github_pull_requests as pr')
      .join('project_github_repositories as pgr', 'pgr.github_repository_id', 'pr.github_repository_id')
      .where('pr.id', pullRequestId)
      .andWhere('pgr.project_id', issue.project_id)
      .select('pr.id')
      .first();
    if (!pr) throw new BadRequestException('Pull request is not on a repository linked to this project');
    await insertPrLink(this.knex, issueId, pullRequestId);
    return this.findById(issueId);
  }

  async unlinkPullRequest(issueId: string, pullRequestId: string) {
    const deleted = await this.knex('github_pr_links')
      .where({ issue_id: issueId, pull_request_id: pullRequestId })
      .delete();
    if (!deleted) throw new NotFoundException('Pull request is not linked to this issue');
    return this.findById(issueId);
  }

  private async attachPullRequests(issues: any[]) {
    if (!issues.length) return issues;
    try {
      const byIssue = await loadPullRequestsForIssues(this.knex, issues.map((issue: any) => issue.id));
      return issues.map((issue: any) => ({
        ...issue,
        pull_requests: byIssue.get(issue.id) ?? [],
      }));
    } catch {
      return issues.map((issue: any) => ({ ...issue, pull_requests: issue.pull_requests ?? [] }));
    }
  }

  private normalizeAssigneeIds(assigneeIds?: string[] | null, assigneeId?: string | null) {
    if (Array.isArray(assigneeIds)) return [...new Set(assigneeIds.filter(Boolean))];
    return assigneeId ? [assigneeId] : [];
  }

  private restrictToAssignee(q: Knex.QueryBuilder, userId: string, issueAlias: string) {
    q.where((builder) => {
      builder
        .where(`${issueAlias}.assignee_id`, userId)
        .orWhereExists(
          this.knex('issue_assignees as ia')
            .whereRaw(`ia.issue_id = ${issueAlias}.id`)
            .andWhere('ia.user_id', userId),
        );
    });
  }

  private async attachAssignees(issues: any[]) {
    if (!issues.length) return issues;
    const rows = await this.knex('issue_assignees as ia')
      .join('users as u', 'ia.user_id', 'u.id')
      .leftJoin('departments as d', 'u.department_id', 'd.id')
      .whereIn('ia.issue_id', issues.map((issue: any) => issue.id))
      .select(
        'ia.issue_id',
        'u.id',
        this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as name"),
        'u.email',
        'u.job_title',
        'u.role',
        'u.avatar_url',
        'd.name as department',
        'ia.created_at',
      )
      .orderBy('ia.created_at', 'asc');

    const byIssue = new Map<string, any[]>();
    for (const row of rows) {
      const list = byIssue.get(row.issue_id) ?? [];
      if (!list.some((person) => person.id === row.id)) {
        list.push({
          id: row.id,
          name: row.name,
          email: row.email,
          job_title: row.job_title,
          role: row.role,
          avatar_url: row.avatar_url,
          department: row.department,
          involvement: 'Assignee',
        });
        byIssue.set(row.issue_id, list);
      }
    }

    return issues.map((issue: any) => {
      const assignees = byIssue.get(issue.id) ?? [];
      if (!assignees.length && issue.assignee_id && issue.assignee_name) {
        assignees.push({
          id: issue.assignee_id,
          name: issue.assignee_name,
          email: issue.assignee_email,
          job_title: issue.assignee_job_title,
          role: issue.assignee_role,
          avatar_url: issue.assignee_avatar,
          department: issue.assignee_department,
          involvement: 'Assignee',
        });
      }
      return { ...issue, assignees };
    });
  }

  private async replaceAssignees(issueId: string, userIds: string[]) {
    const unique = [...new Set(userIds.filter(Boolean))];
    await this.knex('issue_assignees').where({ issue_id: issueId }).del();
    if (unique.length) {
      await this.knex('issue_assignees').insert(
        unique.map((user_id) => ({ id: uuid(), issue_id: issueId, user_id })),
      );
    }
    await this.knex('issues').where({ id: issueId }).update({
      assignee_id: unique[0] ?? null,
      updated_at: new Date(),
    });
  }

  private notifyNewAssignees(userIds: string[], reporterId: string, title: string) {
    for (const userId of userIds) {
      if (userId && userId !== reporterId) {
        this.notificationsGateway?.notifyUser(userId, {
          type: 'issue_assigned',
          title: 'Issue assigned to you',
          body: title,
        });
      }
    }
  }
}
