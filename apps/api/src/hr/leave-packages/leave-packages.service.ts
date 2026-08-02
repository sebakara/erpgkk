import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.module';
import { DeptNotifierService } from '../dept-notifier.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class LeavePackagesService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly deptNotifier: DeptNotifierService,
  ) {}

  async findAll(companyId: string) {
    const packages = await this.knex('leave_packages as lp')
      .where('lp.company_id', companyId)
      .leftJoin('users as u', 'lp.created_by', 'u.id')
      .select(
        'lp.*',
        this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as created_by_name"),
      )
      .orderBy('lp.period_start', 'desc');

    for (const pkg of packages) {
      pkg.types = await this.knex('leave_package_types').where({ package_id: pkg.id });
      pkg.employee_count = await this.knex('employee_leave_packages')
        .where({ package_id: pkg.id })
        .count('id as count')
        .first()
        .then((r: any) => Number(r?.count ?? 0));
    }
    return packages;
  }

  async findById(id: string) {
    const pkg = await this.knex('leave_packages').where({ id }).first();
    if (!pkg) throw new NotFoundException('Package not found');
    pkg.types = await this.knex('leave_package_types').where({ package_id: id });
    pkg.allocations = await this.knex('employee_leave_packages as elp')
      .where('elp.package_id', id)
      .join('users as u', 'elp.user_id', 'u.id')
      .select('elp.*', 'u.first_name', 'u.last_name', 'u.email', 'u.job_title');
    return pkg;
  }

  async create(companyId: string, createdBy: string, data: {
    name: string;
    period_start: string;
    period_end: string;
    types: { leave_type: string; days_allowed: number }[];
  }) {
    const id = uuid();
    await this.knex('leave_packages').insert({
      id, company_id: companyId, created_by: createdBy,
      name: data.name, period_start: data.period_start, period_end: data.period_end,
    });
    if (data.types?.length) {
      await this.knex('leave_package_types').insert(
        data.types.map((t) => ({ id: uuid(), package_id: id, leave_type: t.leave_type, days_allowed: t.days_allowed })),
      );
    }
    return this.findById(id);
  }

  async update(id: string, data: {
    name?: string;
    period_start?: string;
    period_end?: string;
    types?: { leave_type: string; days_allowed: number }[];
  }) {
    const { types, ...rest } = data;
    if (Object.keys(rest).length) {
      await this.knex('leave_packages').where({ id }).update({ ...rest, updated_at: new Date() });
    }
    if (types) {
      await this.knex('leave_package_types').where({ package_id: id }).delete();
      await this.knex('leave_package_types').insert(
        types.map((t) => ({ id: uuid(), package_id: id, leave_type: t.leave_type, days_allowed: t.days_allowed })),
      );
    }
    return this.findById(id);
  }

  async remove(id: string) {
    await this.knex('leave_packages').where({ id }).delete();
  }

  // Allocate to one, many, or all employees
  async allocate(packageId: string, companyId: string, userIds: string[] | 'all') {
    let ids: string[] = [];
    if (userIds === 'all') {
      const users = await this.knex('users').where({ company_id: companyId, is_active: true }).select('id');
      ids = users.map((u: any) => u.id);
    } else {
      ids = userIds;
    }

    const pkg = await this.knex('leave_packages').where({ id: packageId }).select('name', 'period_start', 'period_end').first();
    const rows = ids.map((userId) => ({ id: uuid(), user_id: userId, package_id: packageId }));
    // Insert ignoring duplicates
    for (const row of rows) {
      await this.knex('employee_leave_packages')
        .insert(row)
        .onConflict(['user_id', 'package_id'])
        .ignore();
    }

    // Notify each allocated employee and their department head
    if (pkg) {
      for (const userId of ids) {
        await this.deptNotifier.notifyUser(userId, {
          type: 'leave_package_allocated',
          title: 'Leave package assigned',
          body: `You have been assigned the "${pkg.name}" leave package`,
          data: { package_id: packageId },
        });
        await this.deptNotifier.notifyHead(userId, {
          type: 'leave_package_allocated',
          title: 'Leave package assigned to team member',
          body: `A team member was assigned the "${pkg.name}" leave package`,
          data: { package_id: packageId },
        });
      }
    }

    return { allocated: ids.length };
  }

  async removeAllocation(packageId: string, userId: string) {
    await this.knex('employee_leave_packages').where({ package_id: packageId, user_id: userId }).delete();
  }

  // Compute leave balance for a user: their active packages + days used
  async getBalance(userId: string) {
    const now = new Date().toISOString().split('T')[0];

    // Get all packages allocated to this user that cover today
    const packages = await this.knex('employee_leave_packages as elp')
      .where('elp.user_id', userId)
      .join('leave_packages as lp', 'elp.package_id', 'lp.id')
      .where('lp.period_start', '<=', now)
      .where('lp.period_end', '>=', now)
      .join('leave_package_types as lpt', 'lp.id', 'lpt.package_id')
      .select('lp.id as package_id', 'lp.name as package_name', 'lp.period_start', 'lp.period_end',
              'lpt.leave_type', 'lpt.days_allowed');

    if (!packages.length) return [];

    // For each package+type combo, compute days used from approved leave requests
    const result: any[] = [];
    for (const row of packages) {
      const used = await this.knex('leave_requests')
        .where({ user_id: userId, type: row.leave_type, status: 'approved' })
        .where('start_date', '>=', row.period_start)
        .where('end_date', '<=', row.period_end)
        .select(this.knex.raw('COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) as days'))
        .first()
        .then((r: any) => Number(r?.days ?? 0));

      result.push({
        package_id: row.package_id,
        package_name: row.package_name,
        period_start: row.period_start,
        period_end: row.period_end,
        leave_type: row.leave_type,
        days_allowed: row.days_allowed,
        days_used: used,
        days_remaining: Math.max(0, row.days_allowed - used),
      });
    }
    return result;
  }
}
