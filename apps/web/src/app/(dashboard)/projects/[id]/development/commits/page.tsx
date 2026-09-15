'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { githubApi } from '@/lib/api';
import { DevSpinner, Empty, GitRow, formatDate, mappedName } from '../ui';

export default function DevelopmentCommitsPage() {
  const { id } = useParams<{ id: string }>();
  const { data = [], isLoading } = useQuery({
    queryKey: ['github-commits', id],
    queryFn: () => githubApi.commits(id),
  });

  if (isLoading) return <DevSpinner />;
  if (!data.length) return <Empty title="No commits" body="Commits from the last 90 days will appear after a sync." />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Commits</h2>
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {data.map((c: any) => (
          <GitRow
            key={c.id}
            href={c.html_url}
            title={c.message}
            meta={`${mappedName(c)} · ${c.repository} · ${c.sha?.slice(0, 7)} · ${formatDate(c.committed_at)}`}
          />
        ))}
      </div>
    </div>
  );
}
