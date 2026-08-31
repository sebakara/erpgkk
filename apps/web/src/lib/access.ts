import type { User } from '@/types';
import type { Department } from '@/types';

export function matchesMarketingOrProduct(value?: string | null): boolean {
  if (!value) return false;
  const text = value.toLowerCase();
  return /\bmarketing\b/.test(text) || /\bproduct\b/.test(text);
}

export function hasCommercialAccess(
  user?: Pick<User, 'role' | 'department_id' | 'department_name' | 'job_title' | 'id'> | null,
  departments: Pick<Department, 'id' | 'name' | 'manager_id'>[] = [],
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (matchesMarketingOrProduct(user.job_title) || matchesMarketingOrProduct(user.department_name)) {
    return true;
  }
  const myDept = departments.find((dept) => dept.id === user.department_id);
  if (matchesMarketingOrProduct(myDept?.name)) return true;
  return departments.some(
    (dept) => dept.manager_id === user.id && matchesMarketingOrProduct(dept.name),
  );
}
