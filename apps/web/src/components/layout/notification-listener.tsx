'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

export function NotificationListener() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();

    const onNotification = (notif: { title: string; body?: string; type?: string }) => {
      toast.custom(
        (t) => (
          <div
            className={`flex items-start gap-3 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 max-w-sm transition-all ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
          >
            <span className="text-lg leading-none mt-0.5">{typeEmoji(notif.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
              {notif.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.body}</p>}
            </div>
          </div>
        ),
        { duration: 5000, position: 'top-right' },
      );
      qc.invalidateQueries({ queryKey: ['notif-count'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (notif.type === 'leave_approved' || notif.type === 'leave_rejected') {
        qc.invalidateQueries({ queryKey: ['leaves'] });
        qc.invalidateQueries({ queryKey: ['leave-balance'] });
      }
    };

    socket.on('notification', onNotification);
    socket.on('connect_error', (err) => console.warn('[socket] connect error:', err.message));

    return () => {
      socket.off('notification', onNotification);
    };
  }, [user, qc]);

  // Disconnect socket on unmount (user left dashboard)
  useEffect(() => {
    return () => { disconnectSocket(); };
  }, []);

  return null;
}

function typeEmoji(type?: string) {
  switch (type) {
    case 'issue_assigned': return '📋';
    case 'comment_added': return '💬';
    case 'leave_approved': return '✅';
    case 'leave_rejected': return '❌';
    default: return '🔔';
  }
}
