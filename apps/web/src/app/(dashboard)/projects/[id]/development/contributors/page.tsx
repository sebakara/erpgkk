'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { githubApi } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import { DevSpinner, Empty } from '../ui';

export default function DevelopmentContributorsPage() {
  const { id } = useParams<{ id: string }>();
  const { data = [], isLoading } = useQuery({
    queryKey: ['github-contributors', id],
    queryFn: () => githubApi.contributors(id),
  });

  if (isLoading) return <DevSpinner />;
  if (!data.length) return <Empty title="No GitHub contributors yet" body="Activity is grouped by GitHub login. Link people in Settings or Profile to show CompanyOS names." />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">GitHub contributors</h2>
        <p className="text-sm text-gray-500">Evidence from pull requests, reviews, and commits — not a performance score.</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {data.map((person: any) => (
          <div key={person.login} className="flex items-center gap-4 px-5 py-4">
            {person.mapped_user?.avatar_url ? (
              <img src={person.mapped_user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center">
                {getInitials(person.mapped_user ? `${person.mapped_user.first_name} ${person.mapped_user.last_name}` : person.login)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {person.mapped_user
                  ? `${person.mapped_user.first_name} ${person.mapped_user.last_name}`
                  : `@${person.login}`}
              </p>
              <p className="text-xs text-gray-400">@{person.login}</p>
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>{person.pr_count} PRs</span>
              <span>{person.commit_count} commits</span>
              <span>{person.review_count} reviews</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
