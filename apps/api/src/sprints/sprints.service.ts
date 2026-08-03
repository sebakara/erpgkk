import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SprintsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

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

  async stats(id: string) {
    const issues = await this.knex('issues').where({ sprint_id: id }).select('status', 'story_points');
    const total = issues.length;
    const done = issues.filter((i) => i.status === 'done').length;
    const totalPoints = issues.reduce((s, i) => s + (i.story_points || 0), 0);
    const donePoints = issues.filter((i) => i.status === 'done').reduce((s, i) => s + (i.story_points || 0), 0);
    return { total, done, remaining: total - done, totalPoints, donePoints };
  }

  remove(id: string) {
    return this.knex('sprints').where({ id }).update({ deleted_at: new Date() });
  }
}
