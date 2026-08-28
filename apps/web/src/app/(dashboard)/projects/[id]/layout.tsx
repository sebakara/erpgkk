'use client';
import { useParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, sprintsApi } from '@/lib/api';
import Link from 'next/link';
import {
  LayoutGrid,
  ListTodo,
  FileText,
  BarChart2,
  Settings,
  CircleDot,
  FolderOpen,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

const TABS: Array<{
  label: string;
  segment: string;
  icon: LucideIcon;
  leadershipOnly?: boolean;
}> = [
  { label: 'Issues',    segment: 'issues',    icon: CircleDot  },
  { label: 'Board',     segment: 'board',     icon: LayoutGrid },
  { label: 'Backlog',   segment: 'backlog',   icon: ListTodo   },
  { label: 'Docs',      segment: 'docs',      icon: FileText   },
  { label: 'Standup Notes', segment: 'standup-notes', icon: Lock, leadershipOnly: true },
  { label: 'Folder',    segment: 'folder',    icon: FolderOpen },
  { label: 'Analytics', segment: 'analytics', icon: BarChart2  },
  { label: 'Settings',  segment: 'settings',  icon: Settings   },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const canViewStandupNotes = user?.role === 'admin' || user?.role === 'manager';

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
  });
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', id],
    queryFn: () => sprintsApi.list(id),
  });

  const activeSprint = (sprints as any[]).find((s) => s.status === 'active');

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!project) return <p className="text-gray-500">Project not found</p>;

  return (
    <div className="space-y-0">
      {/* Project header */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 pt-5 pb-0 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{project.icon || '📁'}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{project.name}</h1>
            {project.description && (
              <p className="text-gray-400 text-sm truncate">{project.description}</p>
            )}
          </div>
          <span className={cn(
            'ml-auto text-xs px-2.5 py-1 rounded-full capitalize shrink-0',
            project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
          )}>
            {project.status}
          </span>
        </div>

        {activeSprint && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Active Sprint</p>
              <p className="text-indigo-900 font-semibold text-sm">{activeSprint.name}</p>
            </div>
            <Link href={`/projects/${id}/board`} className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700">
              Open Board
            </Link>
          </div>
        )}

        {/* Tab nav */}
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.filter((tab) => !tab.leadershipOnly || canViewStandupNotes).map(({ label, segment, icon: Icon }) => {
            const href = `/projects/${id}/${segment}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={segment}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  active
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300',
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      <div className="pt-5">
        {children}
      </div>
    </div>
  );
}
