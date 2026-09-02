'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle, FolderOpen, Lock, Search } from 'lucide-react';
import { hrApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, getInitials } from '@/lib/utils';
import type { StandupNote } from '@/types';

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export default function ProjectStandupNotesPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const canView = user?.role === 'manager';
  const [dateFrom, setDateFrom] = useState(() => localDate(-30));
  const [dateTo, setDateTo] = useState(() => localDate());
  const [search, setSearch] = useState('');

  const { data: notes = [], isLoading, isError } = useQuery<StandupNote[]>({
    queryKey: ['standup-notes', 'project', projectId, dateFrom, dateTo],
    queryFn: () => hrApi.standupNotes.byProject(projectId, { dateFrom, dateTo }),
    enabled: canView && Boolean(projectId && dateFrom && dateTo),
  });

  if (!canView) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <Lock size={28} className="mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-700">Private leadership notes</p>
        <p className="mt-1 text-sm text-gray-400">This area is available only to managers.</p>
      </div>
    );
  }

  const normalizedSearch = search.trim().toLowerCase();
  const visibleNotes = notes.filter((note) =>
    `${note.first_name} ${note.last_name} ${note.job_title ?? ''} ${note.content}`
      .toLowerCase()
      .includes(normalizedSearch),
  );
  const notesByDate = visibleNotes.reduce<Record<string, StandupNote[]>>((groups, note) => {
    if (!groups[note.standup_date]) groups[note.standup_date] = [];
    groups[note.standup_date].push(note);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Project standup notes</h2>
          <p className="text-sm text-gray-500">Your private notes that reference this project.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays size={15} className="text-gray-400" />
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(event) => setDateFrom(event.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(event) => setDateTo(event.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
        <Lock size={15} className="shrink-0" />
        Only notes written by you are shown here.
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by developer or note content…"
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-5 text-sm text-red-700">
          Standup notes could not be loaded.
        </div>
      ) : visibleNotes.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <FolderOpen size={30} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">No linked standup notes</p>
          <p className="mt-1 text-sm text-gray-400">
            Link this project when writing a note in HR → Standup Notes.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(notesByDate).map(([date, dateNotes]) => (
            <section key={date} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {formatDate(`${date}T12:00:00`)}
              </h3>
              <div className="grid gap-3">
                {dateNotes.map((note) => (
                  <article key={note.id} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      {note.avatar_url ? (
                        <img src={note.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                          {getInitials(`${note.first_name} ${note.last_name}`)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{note.first_name} {note.last_name}</p>
                            <p className="text-xs text-gray-400">
                              Developer · {note.job_title ?? 'Team member'}
                            </p>
                          </div>
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle size={12} /> Saved
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-gray-700 whitespace-pre-wrap">{note.content}</p>
                        {note.project && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: note.project.color ?? '#9ca3af' }}
                              />
                              {note.project.icon && <span>{note.project.icon}</span>}
                              {note.project.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
