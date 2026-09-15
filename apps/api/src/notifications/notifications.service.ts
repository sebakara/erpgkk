import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';

@Injectable()
export class NotificationsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async create(userId: string, payload: { type: string; title: string; body?: string; data?: any }) {
    const id = uuid();
    await this.knex('notifications').insert({
      id,
      user_id: userId,
      type: payload.type,
      title: payload.title,
      body: payload.body || null,
      payload: payload.data ? JSON.stringify(payload.data) : null,
    });
    return this.parseRow(await this.knex('notifications').where({ id }).first());
  }

  async findAll(userId: string) {
    const rows = await this.knex('notifications')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(50);
    return rows.map((row) => this.parseRow(row));
  }

  unreadCount(userId: string) {
    return this.knex('notifications').where({ user_id: userId, is_read: false }).count('* as count').first();
  }

  markRead(id: string, userId: string) {
    return this.knex('notifications').where({ id, user_id: userId }).update({ is_read: true });
  }

  markAllRead(userId: string) {
    return this.knex('notifications').where({ user_id: userId, is_read: false }).update({ is_read: true });
  }

  private parseRow(row: any) {
    if (!row) return row;
    if (typeof row.payload === 'string') {
      try { row.payload = JSON.parse(row.payload); } catch { /* keep raw */ }
    }
    return row;
  }
}
