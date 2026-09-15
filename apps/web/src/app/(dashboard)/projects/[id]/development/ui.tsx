'use client';
import Link from 'next/link';

export function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DevSpinner() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function Empty({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
      <p className="font-medium text-gray-600">{title}</p>
      <p className="mt-1 text-sm text-gray-400">{body}</p>
      {href && cta && (
        <Link href={href} className="inline-block mt-4 text-sm font-medium text-primary-600 hover:underline">{cta}</Link>
      )}
    </div>
  );
}

export function GitRow({ href, title, meta, badge }: { href?: string | null; title: string; meta: string; badge?: React.ReactNode }) {
  const inner = (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
        <p className="text-xs text-gray-400 truncate">{meta}</p>
      </div>
      {badge}
    </div>
  );
  const cls = 'block px-5 py-3 hover:bg-gray-50';
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
    : <div className={cls}>{inner}</div>;
}

export function mappedName(row: any) {
  if (row.mapped_first_name) return `${row.mapped_first_name} ${row.mapped_last_name}`;
  return row.author_login || row.author_name || row.login || 'unknown';
}
