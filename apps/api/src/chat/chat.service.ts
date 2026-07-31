import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import { KNEX_CONNECTION } from '../database/database.module';

@Injectable()
export class ChatService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async getMyConversations(userId: string, companyId: string) {
    const user = await this.knex('users').where('id', userId).first();

    // --- Direct conversations ---
    const directConvIds = await this.knex('chat_conversation_members')
      .where('user_id', userId)
      .pluck('conversation_id');

    const directConvs = directConvIds.length
      ? await this.knex('chat_conversations').whereIn('id', directConvIds).andWhere('type', 'direct')
      : [];

    const enrichedDirect = await Promise.all(
      directConvs.map(async (conv) => {
        const otherUser = await this.knex('chat_conversation_members as cm')
          .join('users as u', 'cm.user_id', 'u.id')
          .where('cm.conversation_id', conv.id)
          .andWhereNot('cm.user_id', userId)
          .select('u.id', 'u.first_name', 'u.last_name', 'u.avatar_url', 'u.job_title')
          .first();

        const lastMsg = await this.knex('chat_messages')
          .where('conversation_id', conv.id)
          .orderBy('created_at', 'desc')
          .first();

        const unread = await this.knex('chat_messages as m')
          .where('m.conversation_id', conv.id)
          .andWhereNot('m.sender_id', userId)
          .whereNotExists(
            this.knex('chat_message_reads as r')
              .whereRaw('r.message_id = m.id')
              .andWhere('r.user_id', userId),
          )
          .count('m.id as c')
          .first();

        return { ...conv, other_user: otherUser, last_message: lastMsg, unread_count: Number((unread as any)?.c ?? 0) };
      }),
    );

    // --- Department conversations ---
    let deptConvQuery = this.knex('chat_conversations as c')
      .join('departments as d', 'c.department_id', 'd.id')
      .where('c.company_id', companyId)
      .andWhere('c.type', 'department')
      .select('c.*', 'd.name as department_name');

    if (user?.role !== 'admin') {
      const managedIds = await this.knex('departments').where({ company_id: companyId, manager_id: userId }).pluck('id');
      const deptIds = [user?.department_id, ...managedIds].filter(Boolean);
      if (!deptIds.length) deptConvQuery = deptConvQuery.whereRaw('1=0');
      else deptConvQuery = deptConvQuery.whereIn('c.department_id', deptIds);
    }

    const deptConvs = await deptConvQuery;

    const enrichedDept = await Promise.all(
      deptConvs.map(async (conv) => {
        const lastMsg = await this.knex('chat_messages')
          .where('conversation_id', conv.id)
          .orderBy('created_at', 'desc')
          .first();

        const unread = await this.knex('chat_messages as m')
          .where('m.conversation_id', conv.id)
          .andWhereNot('m.sender_id', userId)
          .whereNotExists(
            this.knex('chat_message_reads as r')
              .whereRaw('r.message_id = m.id')
              .andWhere('r.user_id', userId),
          )
          .count('m.id as c')
          .first();

        return { ...conv, last_message: lastMsg, unread_count: Number((unread as any)?.c ?? 0) };
      }),
    );

    const sortByLastMsg = (a: any, b: any) => {
      const at = a.last_message?.created_at ?? a.created_at;
      const bt = b.last_message?.created_at ?? b.created_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    };

    return { direct: enrichedDirect.sort(sortByLastMsg), department: enrichedDept };
  }

  async getOrCreateDirect(userId: string, otherUserId: string, companyId: string) {
    const existing = await this.knex('chat_conversations as c')
      .join('chat_conversation_members as m1', 'c.id', 'm1.conversation_id')
      .join('chat_conversation_members as m2', 'c.id', 'm2.conversation_id')
      .where('c.company_id', companyId)
      .andWhere('c.type', 'direct')
      .andWhere('m1.user_id', userId)
      .andWhere('m2.user_id', otherUserId)
      .select('c.id')
      .first();

    if (existing) return existing;

    const id = uuid();
    await this.knex('chat_conversations').insert({ id, company_id: companyId, type: 'direct' });
    await this.knex('chat_conversation_members').insert([
      { conversation_id: id, user_id: userId },
      { conversation_id: id, user_id: otherUserId },
    ]);
    return { id };
  }

  async getOrCreateDepartment(deptId: string, companyId: string) {
    const existing = await this.knex('chat_conversations')
      .where({ company_id: companyId, type: 'department', department_id: deptId })
      .first();

    if (existing) return existing;

    const id = uuid();
    await this.knex('chat_conversations').insert({ id, company_id: companyId, type: 'department', department_id: deptId });
    return { id };
  }

  async getMessages(convId: string) {
    return this.knex('chat_messages as m')
      .join('users as u', 'm.sender_id', 'u.id')
      .where('m.conversation_id', convId)
      .select(
        'm.id', 'm.conversation_id', 'm.content', 'm.created_at', 'm.sender_id',
        'u.first_name', 'u.last_name', 'u.avatar_url',
      )
      .orderBy('m.created_at', 'asc')
      .limit(100);
  }

  async sendMessage(convId: string, senderId: string, content: string) {
    const id = uuid();
    await this.knex('chat_messages').insert({ id, conversation_id: convId, sender_id: senderId, content });
    return this.knex('chat_messages as m')
      .join('users as u', 'm.sender_id', 'u.id')
      .where('m.id', id)
      .select('m.*', 'u.first_name', 'u.last_name', 'u.avatar_url')
      .first();
  }

  async markRead(convId: string, userId: string) {
    const msgIds = await this.knex('chat_messages')
      .where('conversation_id', convId)
      .andWhereNot('sender_id', userId)
      .pluck('id');

    if (!msgIds.length) return;

    await this.knex('chat_message_reads')
      .insert(msgIds.map((mid) => ({ message_id: mid, user_id: userId })))
      .onConflict(['message_id', 'user_id'])
      .ignore();
  }

  async getUnreadCount(userId: string, companyId: string) {
    const user = await this.knex('users').where('id', userId).first();

    const directIds = await this.knex('chat_conversation_members').where('user_id', userId).pluck('conversation_id');

    let deptIds: string[] = [];
    if (user?.role === 'admin') {
      deptIds = await this.knex('chat_conversations').where({ company_id: companyId, type: 'department' }).pluck('id');
    } else if (user?.department_id) {
      deptIds = await this.knex('chat_conversations')
        .where({ company_id: companyId, type: 'department', department_id: user.department_id })
        .pluck('id');
    }

    const allIds = [...new Set([...directIds, ...deptIds])];
    if (!allIds.length) return { count: 0 };

    const result = await this.knex('chat_messages as m')
      .whereIn('m.conversation_id', allIds)
      .andWhereNot('m.sender_id', userId)
      .whereNotExists(
        this.knex('chat_message_reads as r').whereRaw('r.message_id = m.id').andWhere('r.user_id', userId),
      )
      .count('m.id as c')
      .first();

    return { count: Number((result as any)?.c ?? 0) };
  }

  getUsers(companyId: string) {
    return this.knex('users')
      .where({ company_id: companyId, is_active: true })
      .select('id', 'first_name', 'last_name', 'avatar_url', 'job_title', 'department_id');
  }

  getDepartments(companyId: string) {
    return this.knex('departments').where('company_id', companyId).select('id', 'name');
  }
}
