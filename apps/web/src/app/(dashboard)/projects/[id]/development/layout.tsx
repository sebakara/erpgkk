'use client';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const SUBNAV = [
  { label: 'Overview', segment: '' },
  { label: 'Repositories', segment: 'repositories' },
  { label: 'Pull Requests', segment: 'pull-requests' },
  { label: 'Commits', segment: 'commits' },
  { label: 'Contributors', segment: 'contributors' },
  { label: 'Releases', segment: 'releases' },
  { label: 'GitHub Issues', segment: 'issues' },
];

export default function DevelopmentLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const base = `/projects/${id}/development`;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
        {SUBNAV.map(({ label, segment }) => {
          const href = segment ? `${base}/${segment}` : base;
          const active = segment
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === base;
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
