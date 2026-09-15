import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SprintsService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  findAll(projectId: string) {
    return this.knex('sprints').where({ project_id: projectId }).whereNull('deleted_at').orderBy('created_at', 'desc');
  }

  async findById(id: string) {
    const sprint = await this.knex('sprints').where({ id }).whereNull('deleted_at').first();
    if (!sprint) throw new NotFoundException('Sprint not found');
    return sprint;
  }

  async create(projectId: string, data: { name: string; goal?: string; start_date?: string; end_date?: string }) {
    const id = uuid();
    await this.knex('sprints').insert({ id, project_id: projectId, ...data });
    return this.findById(id);
  }

  async update(id: string, data: Partial<{ name: string; goal: string; status: string; start_date: string; end_date: string }>) {
    await this.knex('sprints').where({ id }).update({ ...data, updated_at: new Date() });
    return this.findById(id);
  }

  async start(projectId: string, id: string, actorId?: string) {
    const sprint = await this.findById(id);
    if (sprint.project_id !== projectId) throw new NotFoundException('Sprint not found');
    if (sprint.status === 'completed') throw new BadRequestException('Cannot start a completed sprint');
    if (sprint.status === 'active') return sprint;

    const active = await this.knex('sprints')
      .where({ project_id: projectId, status: 'active' })
      .whereNull('deleted_at')
      .first();
    if (active && active.id !== id) {
      throw new BadRequestException(`Complete “${active.name}” before starting another sprint`);
    }

    await this.knex('sprints').where({ id }).update({ status: 'active', updated_at: new Date() });
    const started = await this.findById(id);
    await this.notifyProject(projectId, actorId, {
      type: 'sprint_started',
      title: 'Sprint started',
      body: started.name,
      data: { project_id: projectId, sprint_id: id, href: `/projects/${projectId}/board` },
    });
    return started;
  }

  async complete(projectId: string, id: string, actorId?: string) {
    const sprint = await this.findById(id);
    if (sprint.project_id !== projectId) throw new NotFoundException('Sprint not found');
    if (sprint.status === 'completed') return { sprint, rolled: 0, rolledTo: null };

    const leftoverIds = await this.knex('issues')
      .where({ sprint_id: id })
      .whereNull('deleted_at')
      .whereNot('status', 'done')
      .pluck('id');

    const next = await this.knex('sprints')
      .where({ project_id: projectId, status: 'planning' })
      .whereNull('deleted_at')
      .whereNot('id', id)
      .orderBy('created_at', 'asc')
      .first();

    await this.knex.transaction(async (trx) => {
      if (leftoverIds.length) {
        await trx('issues').whereIn('id', leftoverIds).update({
          sprint_id: next?.id ?? null,
          updated_at: new Date(),
        });
      }
      await trx('sprints').where({ id }).update({ status: 'completed', updated_at: new Date() });
    });

    const finished = await this.findById(id);
    await this.notifyProject(projectId, actorId, {
      type: 'sprint_completed',
      title: 'Sprint completed',
      body: leftoverIds.length
        ? `${finished.name} · ${leftoverIds.length} open issue${leftoverIds.length === 1 ? '' : 's'} rolled`
        : finished.name,
      data: { project_id: projectId, sprint_id: id, href: `/projects/${projectId}/board` },
    });
    return {
      sprint: finished,
      rolled: leftoverIds.length,
      rolledTo: next ? { id: next.id, name: next.name } : null,
    };
  }

  async stats(id: string) {
    const issues = await this.knex('issues').where({ sprint_id: id }).whereNull('deleted_at').select('status', 'story_points');
    const total = issues.length;
    const done = issues.filter((i) => i.status === 'done').length;
    const totalPoints = issues.reduce((s, i) => s + (i.story_points || 0), 0);
    const donePoints = issues.filter((i) => i.status === 'done').reduce((s, i) => s + (i.story_points || 0), 0);
    return { total, done, remaining: total - done, totalPoints, donePoints };
  }

  remove(id: string) {
    return this.knex('sprints').where({ id }).update({ deleted_at: new Date() });
  }

  private async notifyProject(
    projectId: string,
    actorId: string | undefined,
    payload: { type: string; title: string; body?: string; data?: any },
  ) {
    const members = await this.knex('project_members').where({ project_id: projectId }).pluck('user_id');
    const owners = await this.knex('projects').where({ id: projectId }).pluck('owner_id');
    await this.notificationsGateway.notifyUsers([...members, ...owners], payload, actorId);
  }
}
