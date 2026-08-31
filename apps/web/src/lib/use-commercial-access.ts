'use client';
import { useQuery } from '@tanstack/react-query';
import { departmentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { hasCommercialAccess } from '@/lib/access';
import type { Department } from '@/types';

export function useCommercialAccess() {
  const user = useAuthStore((s) => s.user);
  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });
  return { allowed: hasCommercialAccess(user, departments), isLoading };
}
