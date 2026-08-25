'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

/** Client-only: send an already-signed-in user to the dashboard. */
export function RedirectIfAuthed() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (hasHydrated && user) router.replace('/dashboard');
  }, [hasHydrated, user, router]);

  return null;
}
