import type { Knex } from 'knex';
import { v4 as uuid } from 'uuid';

const MANAGEMENT_NAME = /^(administration|management)(\s+department)?$/i;

export function isManagementDepartment(name?: string | null): boolean {
  if (!name) return false;
  return MANAGEMENT_NAME.test(name.trim());
}

export function pickManagementDepartment<T extends { name: string }>(depts: T[]): T | undefined {
  const exact = (pattern: RegExp) => depts.find((dept) => pattern.test(dept.name.trim()));
  return exact(/^management(\s+department)?$/i)
    ?? exact(/^administration(\s+department)?$/i)
    ?? depts.find((dept) => isManagementDepartment(dept.name));
}

/** Home department for users with role `manager`. Prefer Management, then Administration, else create Management. */
export async function ensureManagementDepartment(knex: Knex, companyId: string): Promise<string> {
  const active = await knex('departments')
    .where({ company_id: companyId })
    .whereNull('deleted_at')
    .select('id', 'name');

  const picked = pickManagementDepartment(active);
  if (picked) return picked.id;

  const restored = await knex('departments')
    .where({ company_id: companyId })
    .whereNotNull('deleted_at')
    .andWhere((q) => {
      q.whereRaw('LOWER(name) = ?', ['management'])
        .orWhereRaw('LOWER(name) = ?', ['administration'])
        .orWhereRaw("LOWER(name) IN ('management department', 'administration department')");
    })
    .orderByRaw("CASE WHEN LOWER(name) LIKE 'management%' THEN 0 ELSE 1 END")
    .first();

  if (restored) {
    await knex('departments').where({ id: restored.id }).update({ deleted_at: null, updated_at: new Date() });
    return restored.id;
  }

  const id = uuid();
  await knex('departments').insert({ id, company_id: companyId, name: 'Management' });
  return id;
}
