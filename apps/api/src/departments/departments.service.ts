import { Injectable, Inject, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly notificationsGateway: NotificationsGateway,
  ) {}

  findAll(companyId: string) {
    return this.knex('departments as d')
      .where('d.company_id', companyId)
      .whereNull('d.deleted_at')
      .leftJoin('users as m', 'd.manager_id', 'm.id')
      .select(
        'd.*',
        this.knex.raw("CONCAT(m.first_name, ' ', m.last_name) as manager_name"),
      );
  }

  findById(id: string, companyId: string) {
    return this.knex('departments').where({ id, company_id: companyId }).whereNull('deleted_at').first();
  }

  async create(companyId: string, data: { name: string; manager_id?: string }) {
    const id = uuid();
    await this.knex('departments').insert({ id, company_id: companyId, ...data });
    if (data.manager_id) {
      await this.notifyHeadAssigned(id, data.name, data.manager_id);
    }
    return this.findById(id, companyId);
  }

  async update(id: string, data: Partial<{ name: string; manager_id: string }>) {
    const prev = await this.knex('departments').where({ id }).first();
    await this.knex('departments').where({ id }).update({ ...data, updated_at: new Date() });
    const dept = await this.knex('departments').where({ id }).first();
    if (data.manager_id && data.manager_id !== prev?.manager_id) {
      await this.notifyHeadAssigned(id, dept?.name ?? prev?.name, data.manager_id);
    }
    return dept;
  }

  private async notifyHeadAssigned(departmentId: string, name: string, managerId: string) {
    await this.notificationsGateway?.notifyUser(managerId, {
      type: 'department_head_assigned',
      title: 'You now head a department',
      body: `You were assigned as head of ${name}`,
      data: { href: '/hr?tab=employees', department_id: departmentId },
    });
  }

  remove(id: string, companyId: string) {
    return this.knex('departments').where({ id, company_id: companyId }).update({ deleted_at: new Date() });
  }
}
