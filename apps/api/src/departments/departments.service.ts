import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DepartmentsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

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
    return this.findById(id, companyId);
  }

  async update(id: string, data: Partial<{ name: string; manager_id: string }>) {
    await this.knex('departments').where({ id }).update({ ...data, updated_at: new Date() });
    return this.knex('departments').where({ id }).first();
  }

  remove(id: string, companyId: string) {
    return this.knex('departments').where({ id, company_id: companyId }).update({ deleted_at: new Date() });
  }
}
