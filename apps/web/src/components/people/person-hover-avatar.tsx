'use client';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { Mail } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { roleLabel } from '@/lib/roles';
import type { TaskPerson } from '@/types';

const AVATAR_COLORS = [
  { bg: '#d8c4f0', fg: '#5a3d7a' },
  { bg: '#c5e4f7', fg: '#1e5a7a' },
  { bg: '#fde2c8', fg: '#8a4b12' },
  { bg: '#d4edda', fg: '#1e5c34' },
  { bg: '#f8d0d8', fg: '#8a1e3a' },
  { bg: '#fcefc7', fg: '#7a5b10' },
];

function colorFor(id: string) {
  let n = 0;
  for (const c of id) n += c.charCodeAt(0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

interface Props {
  person: TaskPerson;
  size?: number;
  className?: string;
  disabled?: boolean;
}

export function PersonHoverAvatar({ person, size = 24, className, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, place: 'above' as 'above' | 'below' });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const showTimer = useRef<number>();
  const hideTimer = useRef<number>();
  const color = colorFor(person.id || person.name);

  const updatePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const place = r.top < 160 ? 'below' : 'above';
    setPos({
      top: place === 'above' ? r.top : r.bottom,
      left: r.left + r.width / 2,
      place,
    });
  };

  const show = () => {
    window.clearTimeout(hideTimer.current);
    showTimer.current = window.setTimeout(() => {
      updatePos();
      setOpen(true);
    }, 180);
  };

  const hide = () => {
    window.clearTimeout(showTimer.current);
    hideTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  const blockCard = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={person.name}
        onMouseEnter={disabled ? undefined : show}
        onMouseLeave={disabled ? undefined : hide}
        onFocus={disabled ? undefined : show}
        onBlur={disabled ? undefined : hide}
        onPointerDown={blockCard}
        onClick={blockCard}
        className={cn(
          'rounded-full overflow-hidden shrink-0 ring-2 ring-white focus:outline-none focus:ring-indigo-300',
          className,
        )}
        style={{ width: size, height: size, background: person.avatar_url ? undefined : color.bg }}
      >
        {person.avatar_url ? (
          <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
        ) : (
          <span
            className="w-full h-full flex items-center justify-center font-bold"
            style={{ color: color.fg, fontSize: Math.max(9, size * 0.38) }}
          >
            {getInitials(person.name || '?')}
          </span>
        )}
      </button>

      {open && !disabled && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          onMouseEnter={() => {
            window.clearTimeout(hideTimer.current);
            setOpen(true);
          }}
          onMouseLeave={hide}
          onPointerDown={blockCard}
          onClick={blockCard}
          className="fixed z-[80] w-64 -translate-x-1/2"
          style={{
            top: pos.top,
            left: pos.left,
            transform: pos.place === 'above'
              ? 'translate(-50%, calc(-100% - 10px))'
              : 'translate(-50%, 10px)',
          }}
        >
          <div className="bg-white rounded-xl shadow-[0_8px_28px_rgba(15,23,42,0.16)] border border-gray-100 p-3.5">
            <div className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-full overflow-hidden shrink-0"
                style={{ background: person.avatar_url ? undefined : color.bg }}
              >
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span
                    className="w-full h-full flex items-center justify-center text-sm font-bold"
                    style={{ color: color.fg }}
                  >
                    {getInitials(person.name || '?')}
                  </span>
                )}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{person.name}</p>
                {person.job_title && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{person.job_title}</p>
                )}
                {person.involvement && (
                  <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5">
                    {person.involvement}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-gray-600">
              {person.email && (
                <p className="flex items-center gap-1.5 truncate">
                  <Mail size={12} className="text-gray-400 shrink-0" />
                  <span className="truncate">{person.email}</span>
                </p>
              )}
              {(person.department || person.role) && (
                <p className="text-gray-500">
                  {[person.department, roleLabel(person.role)].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function UnassignedAvatar({ size = 24, disabled }: { size?: number; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = () => {
    timer.current = window.setTimeout(() => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.top, left: r.left + r.width / 2 });
      setOpen(true);
    }, 180);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title="Unassigned"
        onMouseEnter={disabled ? undefined : show}
        onMouseLeave={disabled ? undefined : hide}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="rounded-full border border-dashed border-gray-300 shrink-0 bg-white ring-2 ring-white"
        style={{ width: size, height: size }}
      />
      {open && !disabled && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[80] -translate-x-1/2 -translate-y-full"
          style={{ top: pos.top - 10, left: pos.left }}
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
            Unassigned
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
