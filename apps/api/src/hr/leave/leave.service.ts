import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.module';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { DeptNotifierService } from '../dept-notifier.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class LeaveService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly notificationsGateway: NotificationsGateway,
    private readonly deptNotifier: DeptNotifierService,
  ) {}

  findAll(companyId: string, userId?: string) {
    const q = this.knex('leave_requests as l')
      .where('l.company_id', companyId)
      .join('users as u', 'l.user_id', 'u.id')
      .leftJoin('users as a', 'l.approver_id', 'a.id')
      .select(
        'l.*',
        this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as employee_name"),
        'u.avatar_url as employee_avatar',
        this.knex.raw("CONCAT(a.first_name, ' ', a.last_name) as approver_name"),
      )
      .orderBy('l.created_at', 'desc');
    if (userId) q.where('l.user_id', userId);
    return q;
  }

  async findById(id: string) {
    const req = await this.knex('leave_requests').where({ id }).first();
    if (!req) throw new NotFoundException('Leave request not found');
    return req;
  }

  async create(companyId: string, userId: string, data: { type: string; start_date: string; end_date: string; reason?: string }) {
    const id = uuid();
    await this.knex('leave_requests').insert({ id, company_id: companyId, user_id: userId, ...data });
    const req = await this.findById(id);

    // Look up the actor's full name for the notification body
    const actor = await this.knex('users').where({ id: userId }).select('first_name', 'last_name').first();
    const name = actor ? `${actor.first_name} ${actor.last_name}` : 'An employee';
    const days = Math.round(
      (new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / 86400000,
    ) + 1;

    await this.deptNotifier.notifyHead(userId, {
      type: 'leave_requested',
      title: 'New leave request',
      body: `${name} requested ${days} day${days !== 1 ? 's' : ''} of ${data.type} leave`,
      data: { leave_request_id: id, href: '/hr' },
    });

    return req;
  }

  async approve(id: string, approverId: string, note?: string) {
    await this.knex('leave_requests').where({ id }).update({
      status: 'approved', approver_id: approverId, approver_note: note, updated_at: new Date(),
    });
    const req = await this.findById(id);
    await this.notificationsGateway?.notifyUser(req.user_id, {
      type: 'leave_approved',
      title: 'Leave request approved ✓',
      body: `Your ${req.type} leave request has been approved`,
      data: { leave_request_id: id, href: '/hr' },
    });
    return req;
  }

  async reject(id: string, approverId: string, note?: string) {
    await this.knex('leave_requests').where({ id }).update({
      status: 'rejected', approver_id: approverId, approver_note: note, updated_at: new Date(),
    });
    const req = await this.findById(id);
    await this.notificationsGateway?.notifyUser(req.user_id, {
      type: 'leave_rejected',
      title: 'Leave request rejected',
      body: note || `Your ${req.type} leave request was not approved`,
      data: { leave_request_id: id, href: '/hr' },
    });
    return req;
  }

  async summary(companyId: string) {
    return this.knex('leave_requests')
      .where({ company_id: companyId })
      .groupBy('status')
      .select('status')
      .count('* as count');
  }
}
