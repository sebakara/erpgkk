import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { v4 as uuid } from 'uuid';

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
    if (data.assignee_id && data.assignee_id !== reporterId) {
      this.notificationsGateway?.notifyUser(data.assignee_id, {
        type: 'issue_assigned',
        title: 'Issue assigned to you',
        body: issue.title,
      });
    }
    return issue;
  }

  async update(id: string, data: Partial<{ title: string; description: string; type: string; status: string; priority: string; assignee_id: string; sprint_id: string; story_points: number; position: number; label: string; due_date: string }>) {
    await this.knex('issues').where({ id }).update({ ...data, updated_at: new Date() });
    const issue = await this.findById(id);
    if (data.assignee_id) {
      this.notificationsGateway?.notifyUser(data.assignee_id, {
        type: 'issue_assigned',
        title: 'Issue assigned to you',
        body: issue.title,
      });
    }
    return issue;
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
    const notified = new Set<string>([authorId]);
    for (const recipientId of [issue?.reporter_id, issue?.assignee_id]) {
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
      if (item.assignee_id && item.assignee_id !== reporterId) {
        this.notificationsGateway?.notifyUser(item.assignee_id, {
          type: 'issue_assigned',
          title: 'Issue assigned to you',
          body: item.title,
        });
      }
    }
    return created;
  }

  remove(id: string) {
    return this.knex('issues').where({ id }).update({ deleted_at: new Date() });
  }
}
