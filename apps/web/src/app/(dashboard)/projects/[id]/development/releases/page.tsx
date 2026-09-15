'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { githubApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DevSpinner, Empty, GitRow, formatDate } from '../ui';

export default function DevelopmentReleasesPage() {
  const { id } = useParams<{ id: string }>();
  const { data = [], isLoading } = useQuery({
    queryKey: ['github-releases', id],
    queryFn: () => githubApi.releases(id),
  });

  if (isLoading) return <DevSpinner />;
  if (!data.length) return <Empty title="No releases" body="Published GitHub releases for attached repositories will show up here." />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Releases</h2>
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {data.map((rel: any) => (
          <GitRow
            key={rel.id}
            href={rel.html_url}
            title={`${rel.name || rel.tag_name} · ${rel.repository}`}
            meta={`${rel.author_login ?? 'unknown'} · ${rel.tag_name} · ${formatDate(rel.published_at)}`}
            badge={
              <span className={cn(
                'text-[11px] px-2 py-0.5 rounded-full',
                rel.draft ? 'bg-gray-100 text-gray-600' : rel.prerelease ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
              )}>
                {rel.draft ? 'draft' : rel.prerelease ? 'pre-release' : 'published'}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}
