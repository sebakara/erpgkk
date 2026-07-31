'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { sprintsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Redirect /projects/[id] → /projects/[id]/issues as the default tab
  useEffect(() => {
    router.replace(`/projects/${id}/issues`);
  }, [id, router]);

  return null;
}
