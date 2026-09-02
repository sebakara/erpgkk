import type { Knex } from 'knex';
import { ensureManagementDepartment } from '../../common/access/management';

export async function up(knex: Knex): Promise<void> {
  const companies = await knex('companies').select('id');
  for (const company of companies) {
    const departmentId = await ensureManagementDepartment(knex, company.id);
    await knex('users')
      .where({ company_id: company.id, role: 'manager' })
      .update({ department_id: departmentId, updated_at: knex.fn.now() });
  }
}

export async function down(): Promise<void> {
  // Original home departments cannot be restored.
}
