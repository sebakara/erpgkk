'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/projects/${id}/board`);
  }, [id, router]);

  return null;
}
