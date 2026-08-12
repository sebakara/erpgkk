import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ClientsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  findAll(companyId: string, search?: string) {
    let q = this.knex('clients').where({ company_id: companyId }).whereNull('deleted_at');
    if (search) q = q.whereILike('name', `%${search}%`);
    return q.orderBy('name', 'asc');
  }

  async findById(id: string, companyId: string) {
    const client = await this.knex('clients').where({ id, company_id: companyId }).whereNull('deleted_at').first();
    if (!client) throw new NotFoundException('Client not found');

    const projects = await this.knex('project_clients as pc')
      .join('projects as p', 'pc.project_id', 'p.id')
      .where('pc.client_id', id)
      .whereNull('p.deleted_at')
      .select('p.id', 'p.name', 'p.color', 'p.icon', 'p.status');

    return { ...client, projects };
  }

  async create(companyId: string, data: Record<string, any>) {
    const id = uuid();
    await this.knex('clients').insert({ id, company_id: companyId, ...data });
    return this.knex('clients').where({ id }).first();
  }

  async update(id: string, companyId: string, data: Record<string, any>) {
    await this.knex('clients').where({ id, company_id: companyId }).update({ ...data, updated_at: new Date() });
    return this.knex('clients').where({ id }).first();
  }

  remove(id: string, companyId: string) {
    return this.knex('clients').where({ id, company_id: companyId }).update({ deleted_at: new Date() });
  }

  async linkProject(clientId: string, projectId: string) {
    await this.knex('project_clients')
      .insert({ project_id: projectId, client_id: clientId })
      .onConflict(['project_id', 'client_id']).ignore();
  }

  unlinkProject(clientId: string, projectId: string) {
    return this.knex('project_clients').where({ project_id: projectId, client_id: clientId }).delete();
  }
}
