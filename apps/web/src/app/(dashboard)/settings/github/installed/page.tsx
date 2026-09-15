'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { githubApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function GitHubInstalledPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Completing GitHub installation…</p>}>
      <GitHubInstalledInner />
    </Suspense>
  );
}

function GitHubInstalledInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const installationId = searchParams.get('installation_id');

  const { data: status } = useQuery({
    queryKey: ['github-status'],
    queryFn: githubApi.status,
  });

  const install = useMutation({
    mutationFn: (id: string) => githubApi.install(id),
    onSuccess: () => {
      toast.success('GitHub connected');
      router.replace('/settings?section=integrations');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to complete GitHub install');
      router.replace('/settings?section=integrations');
    },
  });

  useEffect(() => {
    if (!installationId) {
      router.replace('/settings?section=integrations');
      return;
    }
    if (status && !status.configured) {
      toast.error('GitHub App env vars are missing on the API');
      router.replace('/settings?section=integrations');
      return;
    }
    if (status?.configured && !install.isPending && !install.isSuccess && !install.isError) {
      install.mutate(installationId);
    }
  }, [installationId, status?.configured]);

  return <p className="text-sm text-gray-500">Completing GitHub installation…</p>;
}
