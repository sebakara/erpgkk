import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.module';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { DeptNotifierService } from '../dept-notifier.service';
import { Role } from '../../common/enums';
import { v4 as uuid } from 'uuid';

type LeaveActor = {
  id: string;
  company_id: string;
  role: Role | string;
  department_id?: string | null;
};

@Injectable()
export class LeaveService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly notificationsGateway: NotificationsGateway,
    private readonly deptNotifier: DeptNotifierService,
  ) {}

  async findAll(actor: LeaveActor, userId?: string) {
    const q = this.knex('leave_requests as l')
      .where('l.company_id', actor.company_id)
      .join('users as u', 'l.user_id', 'u.id')
      .leftJoin('users as a', 'l.approver_id', 'a.id')
      .select(
        'l.*',
        'u.department_id as employee_department_id',
        this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as employee_name"),
        'u.avatar_url as employee_avatar',
        this.knex.raw("CONCAT(a.first_name, ' ', a.last_name) as approver_name"),
      )
      .orderBy('l.created_at', 'desc');
    if (userId) q.where('l.user_id', userId);
    if (actor.role === Role.Manager) {
      const deptIds = await this.departmentScope(actor);
      q.where((builder) => {
        builder.where('l.user_id', actor.id);
        if (deptIds.length) builder.orWhereIn('u.department_id', deptIds);
      });
    }
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

    const actor = await this.knex('users').where({ id: userId }).select('first_name', 'last_name').first();
    const name = actor ? `${actor.first_name} ${actor.last_name}` : 'An employee';
    const days = Math.round(
      (new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / 86400000,
    ) + 1;

    const payload = {
      type: 'leave_requested',
      title: 'New leave request',
      body: `${name} requested ${days} day${days !== 1 ? 's' : ''} of ${data.type} leave`,
      data: { href: '/hr?tab=overview', leave_request_id: id },
    };

    await this.deptNotifier.notifyHead(userId, payload);
    await this.deptNotifier.notifyHr(companyId, payload, userId);

    return req;
  }

  async approve(id: string, actor: LeaveActor, note?: string) {
    await this.assertCanDecide(id, actor);
    await this.knex('leave_requests').where({ id }).update({
      status: 'approved', approver_id: actor.id, approver_note: note, updated_at: new Date(),
    });
    const req = await this.findById(id);
    this.notificationsGateway?.notifyUser(req.user_id, {
      type: 'leave_approved',
      title: 'Leave request approved ✓',
      body: `Your ${req.type} leave request has been approved`,
      data: { href: '/hr?tab=overview', leave_request_id: id },
    });
    return req;
  }

  async reject(id: string, actor: LeaveActor, note?: string) {
    await this.assertCanDecide(id, actor);
    await this.knex('leave_requests').where({ id }).update({
      status: 'rejected', approver_id: actor.id, approver_note: note, updated_at: new Date(),
    });
    const req = await this.findById(id);
    this.notificationsGateway?.notifyUser(req.user_id, {
      type: 'leave_rejected',
      title: 'Leave request rejected',
      body: note || `Your ${req.type} leave request was not approved`,
      data: { href: '/hr?tab=overview', leave_request_id: id },
    });
    return req;
  }

  async summary(actor: LeaveActor) {
    const q = this.knex('leave_requests as l')
      .where('l.company_id', actor.company_id)
      .join('users as u', 'l.user_id', 'u.id');

    if (actor.role === Role.Manager) {
      const deptIds = await this.departmentScope(actor);
      if (!deptIds.length) return [];
      q.whereIn('u.department_id', deptIds);
    }

    return q.groupBy('l.status').select('l.status').count('* as count');
  }

  private async departmentScope(actor: LeaveActor): Promise<string[]> {
    const headed: string[] = await this.knex('departments')
      .where({ company_id: actor.company_id, manager_id: actor.id })
      .pluck('id');
    const ids = new Set(headed);
    if (actor.department_id) ids.add(actor.department_id);
    return [...ids];
  }

  private async assertCanDecide(id: string, actor: LeaveActor) {
    const req = await this.knex('leave_requests as l')
      .where('l.id', id)
      .where('l.company_id', actor.company_id)
      .join('users as u', 'l.user_id', 'u.id')
      .select('l.id', 'u.department_id as employee_department_id')
      .first();
    if (!req) throw new NotFoundException('Leave request not found');
    if (actor.role === Role.Admin || actor.role === Role.Hr) return;
    if (actor.role !== Role.Manager) {
      throw new ForbiddenException('You cannot decide this leave request');
    }

    const deptIds = await this.departmentScope(actor);
    if (!req.employee_department_id || !deptIds.includes(req.employee_department_id)) {
      throw new ForbiddenException('You can only approve leave from your department');
    }
  }
}
