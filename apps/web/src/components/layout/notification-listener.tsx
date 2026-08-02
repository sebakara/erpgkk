'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

/* ── Desktop notification permission ─────────────────────────
   Called once on mount. Asks the browser for permission to show
   native OS notifications. Silently skips if already granted/denied. */
function requestDesktopPermission() {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/* ── Show a native OS desktop notification ───────────────────
   Only fires when the tab is not currently focused, so we don't
   double-notify the user who is actively looking at the page. */
function showDesktopNotification(title: string, body?: string, type?: string) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  const notif = new Notification(title, {
    body: body ?? '',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: type,          // collapses duplicate notifications of same type
    silent: false,
  });

  // Clicking the desktop notification focuses the app tab
  notif.onclick = () => {
    window.focus();
    notif.close();
  };
}

/* ── Query keys to invalidate per notification type ──────────*/
const INVALIDATIONS: Record<string, string[][]> = {
  leave_approved:           [['leaves'], ['leave-balance']],
  leave_rejected:           [['leaves'], ['leave-balance']],
  leave_request_submitted:  [['leaves']],
  leave_package_allocated:  [['leave-balance'], ['leave-packages']],
  issue_assigned:           [['issues']],
  issue_status_changed:     [['issues']],
  comment_added:            [['issues']],
  performance_review_added: [['performance']],
  announcement:             [['announcements']],
  slack_joined:             [],
  slack_employee_joined:    [],
};

/* ── Emoji per type (in-app toast) ──────────────────────────*/
function typeEmoji(type?: string) {
  switch (type) {
    case 'leave_approved':           return '✅';
    case 'leave_rejected':           return '❌';
    case 'leave_request_submitted':  return '📅';
    case 'leave_package_allocated':  return '🎁';
    case 'issue_assigned':           return '📋';
    case 'issue_status_changed':     return '🔄';
    case 'comment_added':            return '💬';
    case 'performance_review_added': return '⭐';
    case 'announcement':             return '📢';
    case 'slack_joined':             return '💼';
    case 'slack_employee_joined':    return '👋';
    default:                         return '🔔';
  }
}

export function NotificationListener() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Ask for desktop permission as soon as the user is logged in
  useEffect(() => {
    if (user) requestDesktopPermission();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();

    const onNotification = (notif: { title: string; body?: string; type?: string }) => {
      // 1. In-app toast (always)
      toast.custom(
        (t) => (
          <div className={`flex items-start gap-3 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 max-w-sm transition-all ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
            <span className="text-lg leading-none mt-0.5">{typeEmoji(notif.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
              {notif.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.body}</p>}
            </div>
          </div>
        ),
        { duration: 5000, position: 'top-right' },
      );

      // 2. Native OS desktop notification (when tab is in background)
      showDesktopNotification(notif.title, notif.body, notif.type);

      // 3. Invalidate relevant queries so UI updates immediately
      qc.invalidateQueries({ queryKey: ['notif-count'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });

      const extra = notif.type ? (INVALIDATIONS[notif.type] ?? []) : [];
      extra.forEach((key) => qc.invalidateQueries({ queryKey: key }));
    };

    socket.on('notification', onNotification);
    socket.on('connect_error', (err) => console.warn('[socket] connect error:', err.message));

    return () => {
      socket.off('notification', onNotification);
    };
  }, [user, qc]);

  useEffect(() => {
    return () => { disconnectSocket(); };
  }, []);

  return null;
}
