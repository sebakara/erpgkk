import type { Knex } from 'knex';

export const PROJECT_LEAD_ROLES = ['owner', 'manager'] as const;

export function roleCanPlanWork(role?: string) {
  return role === 'admin' || role === 'manager' || role === 'project_manager';
}

export async function userManagesProject(knex: Knex, projectId: string, userId: string): Promise<boolean> {
  const project = await knex('projects').where({ id: projectId }).whereNull('deleted_at').first();
  if (!project) return false;
  if (project.owner_id === userId) return true;
  const row = await knex('project_members')
    .where({ project_id: projectId, user_id: userId })
    .whereIn('role', [...PROJECT_LEAD_ROLES])
    .first();
  return !!row;
}
