import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.module';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AnnouncementsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  findAll(companyId: string) {
    return this.knex('announcements as a')
      .where('a.company_id', companyId)
      .whereNull('a.deleted_at')
      .join('users as u', 'a.author_id', 'u.id')
      .select('a.*', this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as author_name"), 'u.avatar_url as author_avatar')
      .orderBy('a.is_pinned', 'desc')
      .orderBy('a.created_at', 'desc');
  }

  async create(companyId: string, authorId: string, data: { title: string; body: string; is_pinned?: boolean }) {
    const id = uuid();
    await this.knex('announcements').insert({ id, company_id: companyId, author_id: authorId, ...data });
    return this.knex('announcements').where({ id }).first();
  }

  update(id: string, data: Partial<{ title: string; body: string; is_pinned: boolean }>) {
    return this.knex('announcements').where({ id }).update({ ...data, updated_at: new Date() });
  }

  remove(id: string, companyId: string) {
    return this.knex('announcements').where({ id, company_id: companyId }).update({ deleted_at: new Date() });
  }
}
