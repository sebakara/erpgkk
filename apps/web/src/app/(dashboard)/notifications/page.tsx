'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { notificationsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { notificationHref } from '@/lib/notifications';
import { Bell, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Notification } from '@/types';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: notifications = [], isLoading } = useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notif-count'] }); toast.success('All marked as read'); },
  });

  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notif-count'] }); },
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  const unread = (notifications as Notification[]).filter((n) => !n.is_read);

  const open = (n: Notification) => {
    if (!n.is_read) markOne.mutate(n.id);
    const href = notificationHref(n);
    if (href) router.push(href);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 text-sm">{unread.length} unread</p>
        </div>
        {unread.length > 0 && (
          <button onClick={() => markAll.mutate()} className="flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
          <Bell size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(notifications as Notification[]).map((n) => (
            <div key={n.id} onClick={() => open(n)}
              className={`bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'border-l-4 border-l-primary-500' : ''}`}>
              <div className="w-2 h-2 mt-1.5 rounded-full shrink-0" style={{ background: n.is_read ? '#d1d5db' : '#4f46e5' }} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>{n.title}</p>
                {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
