'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, FileText, FolderOpen, Lock, Users,
} from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';

type Overview = {
  briefing: string;
  description: string | null;
  counts: {
    total: number;
    open: number;
    done: number;
    inProgress: number;
    inReview: number;
    urgent: number;
    bugs: number;
    unassigned: number;
  };
  sprint: {
    id: string;
    name: string;
    goal?: string;
    start_date?: string;
    end_date?: string;
    total: number;
    done: number;
  } | null;
  stale: {
    id: string;
    title: string;
    status: string;
    priority: string;
    updated_at: string;
    assignee_name: string | null;
  }[];
  people: { id: string; name: string; open: number }[];
  recentlyDone: { id: string; title: string; updated_at: string; assignee_name: string | null }[];
  docs: { id: string; title: string; updated_at: string }[];
  files: { id: string; name: string; created_at: string }[];
  standup: { id: string; content: string; standup_date: string; subject_name: string }[];
};

export default function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const allowed = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    if (user && !allowed) router.replace(`/projects/${id}/issues`);
  }, [user, allowed, id, router]);

  const { data, isLoading, isError } = useQuery<Overview>({
    queryKey: ['project-overview', id],
    queryFn: () => projectsApi.overview(id),
    enabled: allowed,
  });

  if (!allowed || isLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-gray-500 text-sm">Could not load this briefing.</p>;
  }

  const paragraphs = data.briefing.split('\n\n').filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-3">Status</p>
        <div className="space-y-3">
          {paragraphs.map((para) => (
            <p key={para} className="text-base text-gray-800 leading-relaxed">{para}</p>
          ))}
        </div>
        <Link href={`/projects/${id}/board`} className="inline-block mt-4 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          Open board →
        </Link>
      </div>

      {data.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">What this project is</p>
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-6 whitespace-pre-wrap">{data.description}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Stuck</p>
            <span className="text-xs text-gray-400">In progress or review, quiet for 7+ days</span>
          </div>
          {data.stale.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing looks stalled</p>
          ) : (
            <div className="space-y-1">
              {data.stale.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/projects/${id}/board`}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50"
                >
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 truncate">{issue.title}</p>
                    <p className="text-xs text-gray-400">
                      {issue.status.replace('_', ' ')}
                      {issue.assignee_name ? ` · ${issue.assignee_name}` : ' · unassigned'}
                      {' · '}{formatDate(issue.updated_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Open work by person</p>
          </div>
          {data.people.length === 0 ? (
            <p className="text-sm text-gray-400">No assigned open work</p>
          ) : (
            <div className="space-y-2">
              {data.people.map((person) => (
                <div key={person.id} className="flex items-center justify-between gap-2">
                  <p className="text-sm text-gray-800 truncate">{person.name}</p>
                  <span className="text-xs font-semibold tabular-nums text-gray-500">{person.open}</span>
                </div>
              ))}
            </div>
          )}
          {data.counts.unassigned > 0 && (
            <p className="text-xs text-amber-600 mt-3">{data.counts.unassigned} unassigned</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Lately</p>

        {data.recentlyDone.length > 0 && (
          <Section icon={<CheckCircle2 size={13} className="text-emerald-500" />} title="Recently done">
            {data.recentlyDone.map((issue) => (
              <Link key={issue.id} href={`/projects/${id}/issues`} className="block py-1.5 hover:text-indigo-600">
                <p className="text-sm text-gray-800 truncate">{issue.title}</p>
                <p className="text-xs text-gray-400">
                  {issue.assignee_name ?? 'Unassigned'} · {formatDate(issue.updated_at)}
                </p>
              </Link>
            ))}
          </Section>
        )}

        {data.standup.length > 0 && (
          <Section icon={<Lock size={13} className="text-indigo-500" />} title="Standup notes">
            {data.standup.map((note) => (
              <div key={note.id} className="py-1.5">
                <p className="text-sm text-gray-800 truncate">{note.subject_name}</p>
                <p className="text-xs text-gray-400 line-clamp-2">{note.content}</p>
              </div>
            ))}
          </Section>
        )}

        {data.docs.length > 0 && (
          <Section icon={<FileText size={13} className="text-gray-400" />} title="Docs">
            {data.docs.map((doc) => (
              <Link key={doc.id} href={`/projects/${id}/docs/${doc.id}`} className="block py-1.5 text-sm text-gray-800 truncate hover:text-indigo-600">
                {doc.title}
              </Link>
            ))}
          </Section>
        )}

        {data.files.length > 0 && (
          <Section icon={<FolderOpen size={13} className="text-gray-400" />} title="Files">
            {data.files.map((file) => (
              <Link key={file.id} href={`/projects/${id}/folder`} className="block py-1.5 text-sm text-gray-800 truncate hover:text-indigo-600">
                {file.name}
              </Link>
            ))}
          </Section>
        )}

        {data.recentlyDone.length === 0 && data.standup.length === 0 && data.docs.length === 0 && data.files.length === 0 && (
          <p className="text-sm text-gray-400">No recent activity</p>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1">
        {icon} {title}
      </p>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}
