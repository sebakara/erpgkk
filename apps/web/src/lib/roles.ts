export type AppRole = 'admin' | 'manager' | 'employee' | 'hr' | 'project_manager';

export function isHrLead(role?: string | null) {
  return role === 'admin' || role === 'manager' || role === 'hr';
}

export function canManageProjects(
  role?: string | null,
  ownerId?: string,
  userId?: string,
  projectRole?: string | null,
) {
  if (role === 'admin' || role === 'manager') return true;
  if (ownerId && userId && ownerId === userId) return true;
  if (role === 'project_manager' && (projectRole === 'owner' || projectRole === 'manager')) return true;
  return false;
}

export function roleLabel(role?: string | null) {
  if (role === 'project_manager') return 'Project manager';
  if (role === 'hr') return 'HR';
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}
