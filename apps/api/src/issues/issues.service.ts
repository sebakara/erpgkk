import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { findMentionedUsers } from '../common/mentions';
import { v4 as uuid } from 'uuid';

const ISSUE_STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

@Injectable()
export class IssuesService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly notificationsGateway: NotificationsGateway,
  ) {}

  findAll(projectId: string, sprintId?: string, userId?: string, userRole?: string) {
    const q = this.knex('issues as i')
      .where('i.project_id', projectId)
      .whereNull('i.deleted_at')
      .leftJoin('users as a', 'i.assignee_id', 'a.id')
      .leftJoin('users as r', 'i.reporter_id', 'r.id')
      .select(
        'i.*',
        this.knex.raw("CONCAT(a.first_name, ' ', a.last_name) as assignee_name"),
        'a.avatar_url as assignee_avatar',
        this.knex.raw("CONCAT(r.first_name, ' ', r.last_name) as reporter_name"),
      )
      .orderBy('i.position', 'asc');
    if (sprintId) q.where('i.sprint_id', sprintId);
    if (userRole === 'employee' && userId) q.where('i.assignee_id', userId);
    return q;
  }

  backlog(projectId: string, userId?: string, userRole?: string) {
    const q = this.knex('issues').where({ project_id: projectId }).whereNull('sprint_id').whereNull('deleted_at').orderBy('position');
    if (userRole === 'employee' && userId) q.where('assignee_id', userId);
    return q;
  }

  async findById(id: string) {
    const issue = await this.knex('issues as i')
      .where('i.id', id)
      .whereNull('i.deleted_at')
      .leftJoin('users as a', 'i.assignee_id', 'a.id')
      .leftJoin('users as r', 'i.reporter_id', 'r.id')
      .select('i.*',
        this.knex.raw("CONCAT(a.first_name, ' ', a.last_name) as assignee_name"),
        this.knex.raw("CONCAT(r.first_name, ' ', r.last_name) as reporter_name"),
      )
      .first();
    if (!issue) throw new NotFoundException('Issue not found');
    const comments = await this.knex('comments as c')
      .join('users as u', 'c.author_id', 'u.id')
      .where('c.issue_id', id)
      .select('c.*', this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as author_name"), 'u.avatar_url as author_avatar')
      .orderBy('c.created_at', 'asc');
    return { ...issue, comments };
  }

  async create(projectId: string, reporterId: string, data: { title: string; type?: string; priority?: string; assignee_id?: string; sprint_id?: string; story_points?: number; description?: string; label?: string; due_date?: string }) {
    const id = uuid();
    const maxPos = await this.knex('issues').where({ project_id: projectId }).max('position as m').first();
    await this.knex('issues').insert({
      id, project_id: projectId, reporter_id: reporterId,
      position: (maxPos?.m || 0) + 1,
      status: data.assignee_id ? 'todo' : 'backlog',
      ...data,
    });
    const issue = await this.findById(id);
    if (data.assignee_id) {
      await this.grantAccess(projectId, data.assignee_id);
    }
    if (data.assignee_id && data.assignee_id !== reporterId) {
      await this.notificationsGateway?.notifyUser(data.assignee_id, {
        type: 'issue_assigned',
        title: 'Issue assigned to you',
        body: issue.title,
        data: { href: `/projects/${projectId}/issues`, project_id: projectId, issue_id: id },
      });
    }
    return issue;
  }

  async update(id: string, data: Partial<{ title: string; description: string; type: string; status: string; priority: string; assignee_id: string; sprint_id: string; story_points: number; position: number; label: string; due_date: string }>, actorId?: string) {
    const prev = await this.knex('issues').where({ id }).whereNull('deleted_at').first();
    if (!prev) throw new NotFoundException('Issue not found');
    await this.knex('issues').where({ id }).update({ ...data, updated_at: new Date() });
    const issue = await this.findById(id);
    if (data.assignee_id) {
      await this.grantAccess(issue.project_id, data.assignee_id);
    }
    if (data.assignee_id && data.assignee_id !== prev.assignee_id && data.assignee_id !== actorId) {
      await this.notificationsGateway?.notifyUser(data.assignee_id, {
        type: 'issue_assigned',
        title: 'Issue assigned to you',
        body: issue.title,
        data: { href: `/projects/${issue.project_id}/issues`, project_id: issue.project_id, issue_id: id },
      });
    }
    if (data.status && data.status !== prev.status) {
      await this.notifyStatusChange(issue, prev.status, data.status, actorId);
    }
    return issue;
  }

  async moveStatus(id: string, status: string, position: number, actorId?: string) {
    const prev = await this.knex('issues').where({ id }).whereNull('deleted_at').first();
    if (!prev) throw new NotFoundException('Issue not found');
    await this.knex('issues').where({ id }).update({ status, position, updated_at: new Date() });
    if (status !== prev.status) {
      const issue = await this.findById(id);
      await this.notifyStatusChange(issue, prev.status, status, actorId);
    }
  }

  async addComment(issueId: string, authorId: string, body: string) {
    const id = uuid();
    await this.knex('comments').insert({ id, issue_id: issueId, author_id: authorId, body });
    const comment = await this.knex('comments as c')
      .join('users as u', 'c.author_id', 'u.id')
      .where('c.id', id)
      .select('c.*', this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as author_name"), 'u.avatar_url as author_avatar')
      .first();
    const issue = await this.knex('issues').where({ id: issueId }).select('reporter_id', 'assignee_id', 'title', 'project_id').first();
    const href = `/projects/${issue?.project_id}/issues`;
    const notified = new Set<string>([authorId]);
    for (const recipientId of [issue?.reporter_id, issue?.assignee_id]) {
      if (recipientId && !notified.has(recipientId)) {
        notified.add(recipientId);
        await this.notificationsGateway?.notifyUser(recipientId, {
          type: 'comment_added',
          title: 'New comment on an issue',
          body: issue.title,
          data: { href, project_id: issue.project_id, issue_id: issueId },
        });
      }
    }

    if (issue?.project_id) {
      const project = await this.knex('projects').where({ id: issue.project_id }).select('company_id').first();
      if (project?.company_id) {
        const users = await this.knex('users')
          .where({ company_id: project.company_id, is_active: true })
          .select('id', 'first_name', 'last_name');
        const mentioned = findMentionedUsers(body, users, authorId);
        const author = await this.knex('users').where({ id: authorId }).select('first_name', 'last_name').first();
        const authorName = author ? `${author.first_name} ${author.last_name}` : 'Someone';
        for (const user of mentioned) {
          if (notified.has(user.id)) continue;
          notified.add(user.id);
          await this.notificationsGateway?.notifyUser(user.id, {
            type: 'comment_mention',
            title: `${authorName} mentioned you`,
            body: issue.title,
            data: { href, project_id: issue.project_id, issue_id: issueId },
          });
        }
      }
    }
    return comment;
  }

  async bulkCreate(
    projectId: string,
    reporterId: string,
    items: { title: string; type?: string; priority?: string; assignee_id?: string; sprint_id?: string; story_points?: number; description?: string; label?: string; due_date?: string }[],
  ) {
    const maxPos = await this.knex('issues').where({ project_id: projectId }).max('position as m').first();
    let pos = (maxPos?.m || 0) + 1;
    const created: any[] = [];
    for (const item of items) {
      const id = uuid();
      await this.knex('issues').insert({
        id, project_id: projectId, reporter_id: reporterId,
        position: pos++,
        status: item.assignee_id ? 'todo' : 'backlog',
        type: 'task', priority: 'medium',
        ...item,
      });
      const issue = await this.findById(id);
      created.push(issue);
      if (item.assignee_id) {
        await this.grantAccess(projectId, item.assignee_id);
      }
      if (item.assignee_id && item.assignee_id !== reporterId) {
        await this.notificationsGateway?.notifyUser(item.assignee_id, {
          type: 'issue_assigned',
          title: 'Issue assigned to you',
          body: item.title,
          data: { href: `/projects/${projectId}/issues`, project_id: projectId, issue_id: id },
        });
      }
    }
    return created;
  }

  remove(id: string) {
    return this.knex('issues').where({ id }).update({ deleted_at: new Date() });
  }

  private async notifyStatusChange(issue: any, from: string, to: string, actorId?: string) {
    const label = ISSUE_STATUS_LABEL[to] ?? to;
    await this.notificationsGateway?.notifyUsers(
      [issue.assignee_id, issue.reporter_id],
      {
        type: 'issue_status_changed',
        title: `Issue moved to ${label}`,
        body: issue.title,
        data: { href: `/projects/${issue.project_id}/board`, project_id: issue.project_id, issue_id: issue.id, status: to, from },
      },
      actorId,
    );
  }

  private async grantAccess(projectId: string, userId?: string) {
    if (!projectId || !userId) return;
    await this.knex('project_members')
      .insert({ id: uuid(), project_id: projectId, user_id: userId, role: 'member' })
      .onConflict(['project_id', 'user_id'])
      .ignore();
  }
}
