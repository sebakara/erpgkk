import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DocsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  findAll(projectId: string) {
    return this.knex('docs as d')
      .where('d.project_id', projectId)
      .whereNull('d.deleted_at')
      .join('users as u', 'd.author_id', 'u.id')
      .select('d.id', 'd.title', 'd.version', 'd.created_at', 'd.updated_at',
        this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as author_name"))
      .orderBy('d.updated_at', 'desc');
  }

  async findById(id: string) {
    const doc = await this.knex('docs').where({ id }).whereNull('deleted_at').first();
    if (!doc) throw new NotFoundException('Doc not found');
    return doc;
  }

  async create(projectId: string, authorId: string, data: { title: string; content?: string }) {
    const id = uuid();
    await this.knex('docs').insert({ id, project_id: projectId, author_id: authorId, ...data });
    return this.findById(id);
  }

  async update(id: string, data: { title?: string; content?: string }) {
    await this.knex('docs').where({ id }).update({ ...data, version: this.knex.raw('version + 1'), updated_at: new Date() });
    return this.findById(id);
  }

  remove(id: string) {
    return this.knex('docs').where({ id }).update({ deleted_at: new Date() });
  }
}
