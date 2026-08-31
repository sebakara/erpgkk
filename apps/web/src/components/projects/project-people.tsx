'use client';
import { cn } from '@/lib/utils';
import type { ProjectMember } from '@/types';

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
];

function colorFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function firstLetter(person: Pick<ProjectMember, 'first_name' | 'last_name'>) {
  return (person.first_name?.[0] || person.last_name?.[0] || '?').toUpperCase();
}

export function ProjectPeople({
  people,
  max = 5,
  className,
}: {
  people?: Pick<ProjectMember, 'id' | 'first_name' | 'last_name' | 'avatar_url'>[];
  max?: number;
  className?: string;
}) {
  if (!people?.length) return null;

  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <div className={cn('flex items-center', className)}>
      <div className="flex -space-x-2">
        {shown.map((person) => {
          const name = `${person.first_name} ${person.last_name}`.trim();
          return (
            <div key={person.id} title={name} className="relative">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={name}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-white"
                />
              ) : (
                <div
                  className={cn(
                    'w-7 h-7 rounded-full ring-2 ring-white text-white text-[11px] font-semibold flex items-center justify-center',
                    colorFor(person.id),
                  )}
                >
                  {firstLetter(person)}
                </div>
              )}
            </div>
          );
        })}
        {extra > 0 && (
          <div
            title={`${extra} more`}
            className="w-7 h-7 rounded-full ring-2 ring-white bg-gray-200 text-gray-600 text-[10px] font-semibold flex items-center justify-center"
          >
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}
