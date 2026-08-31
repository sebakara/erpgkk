import type { Knex } from 'knex';

export function isEngineeringDepartment(name?: string | null): boolean {
  if (!name) return false;
  return /r\s*&\s*d|r\s+and\s+d|\bengineering\b/i.test(name);
}

export function isEngineeringHeadTitle(title?: string | null): boolean {
  if (!title) return false;
  return /head\s+of\s+(engineering|r\s*[&+]\s*d|r\s+and\s+d)/i.test(title);
}

export function pickEngineeringDepartment<T extends { name: string }>(depts: T[]): T | undefined {
  return depts.find((dept) => /r\s*&\s*d|r\s+and\s+d/i.test(dept.name))
    ?? depts.find((dept) => isEngineeringDepartment(dept.name));
}

const LEADERSHIP_ROLES = new Set(['admin', 'manager', 'hr']);

/** Leadership (admin / manager / HR) and Head of Engineering see every company project. */
export async function canManageAllProjects(
  knex: Knex,
  companyId: string,
  userId: string,
  userRole?: string,
): Promise<boolean> {
  if (userRole && LEADERSHIP_ROLES.has(userRole)) return true;

  const user = await knex('users as u')
    .leftJoin('departments as d', 'u.department_id', 'd.id')
    .where('u.id', userId)
    .select('u.role', 'u.job_title', 'd.name as department_name')
    .first();

  if (!user) return false;
  if (LEADERSHIP_ROLES.has(user.role)) return true;
  if (isEngineeringHeadTitle(user.job_title)) return true;

  const headed = await knex('departments')
    .where({ company_id: companyId, manager_id: userId })
    .select('name');
  return headed.some((dept) => isEngineeringDepartment(dept.name));
}

export async function engineeringHeadIds(knex: Knex, companyId: string): Promise<string[]> {
  const [people, headed] = await Promise.all([
    knex('users as u')
      .leftJoin('departments as d', 'u.department_id', 'd.id')
      .where('u.company_id', companyId)
      .andWhere('u.is_active', true)
      .select('u.id', 'u.role', 'u.job_title', 'd.name as department_name'),
    knex('departments')
      .where({ company_id: companyId })
      .select('manager_id', 'name'),
  ]);

  const ids = new Set<string>();
  for (const person of people) {
    if (isEngineeringHeadTitle(person.job_title)) ids.add(person.id);
    if (person.role === 'manager' && isEngineeringDepartment(person.department_name)) ids.add(person.id);
  }
  for (const dept of headed) {
    if (dept.manager_id && isEngineeringDepartment(dept.name)) ids.add(dept.manager_id);
  }
  return [...ids];
}
