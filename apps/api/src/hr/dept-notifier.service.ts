import { Injectable, Inject, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Role } from '../common/enums';

@Injectable()
export class DeptNotifierService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Notify the department head of the user who performed an action.
   * Silently skips if the user has no department, the department has no head,
   * or the actor IS the head.
   */
  async notifyHead(
    actorUserId: string,
    payload: { type: string; title: string; body?: string; data?: any },
  ): Promise<void> {
    const row = await this.knex('users as u')
      .where('u.id', actorUserId)
      .leftJoin('departments as d', 'u.department_id', 'd.id')
      .select('d.manager_id')
      .first();

    const headId: string | undefined = row?.manager_id;
    if (!headId || headId === actorUserId) return;

    await this.gateway?.notifyUser(headId, payload);
  }

  /** Notify every active HR user in the company, excluding the actor. */
  async notifyHr(
    companyId: string,
    payload: { type: string; title: string; body?: string; data?: any },
    exceptUserId?: string,
  ): Promise<void> {
    const hrIds: string[] = await this.knex('users')
      .where({ company_id: companyId, role: Role.Hr, is_active: true })
      .pluck('id');

    for (const hrId of hrIds) {
      if (!hrId || hrId === exceptUserId) continue;
      await this.gateway?.notifyUser(hrId, payload);
    }
  }

  /** Notify the person's manager (reports_to), unless they are the actor or already covered. */
  async notifyReportsTo(
    actorUserId: string,
    payload: { type: string; title: string; body?: string; data?: any },
    exceptUserIds: (string | null | undefined)[] = [],
  ): Promise<void> {
    const user = await this.knex('users').where({ id: actorUserId }).select('reports_to').first();
    const managerId: string | undefined = user?.reports_to;
    if (!managerId || managerId === actorUserId) return;
    if (exceptUserIds.filter(Boolean).includes(managerId)) return;
    await this.gateway?.notifyUser(managerId, payload);
  }

  /** Notify an arbitrary user (for notifying employees on allocation). */
  async notifyUser(
    userId: string,
    payload: { type: string; title: string; body?: string; data?: any },
  ): Promise<void> {
    await this.gateway?.notifyUser(userId, payload);
  }
}
