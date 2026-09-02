'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { usePresenceStore } from '@/store/presence.store';
import { desktopNotify } from '@/lib/desktop-notify';
import { notificationHref } from '@/lib/notifications';
import { chatApi } from '@/lib/api';
import toast from 'react-hot-toast';

const INVALIDATIONS: Record<string, string[][]> = {
  leave_approved:              [['leaves'], ['leave-balance']],
  leave_rejected:              [['leaves'], ['leave-balance']],
  leave_request_submitted:     [['leaves']],
  leave_requested:             [['leaves']],
  leave_package_allocated:     [['leave-balance'], ['leave-packages']],
  issue_assigned:              [['issues']],
  issue_status_changed:        [['issues']],
  comment_added:               [['issues']],
  comment_mention:             [['issues']],
  performance_review_added:    [['performance']],
  performance_review_created:  [['performance']],
  performance_review_submitted:[['performance']],
  announcement:                [['announcements']],
  chat_mention:                [['chat-convs'], ['chat-unread']],
  sprint_started:              [['sprints'], ['projects']],
  sprint_completed:            [['sprints'], ['projects']],
  project_access_granted:      [['projects']],
  project_access_revoked:      [['projects']],
  file_uploaded:               [['project-files']],
  department_head_assigned:    [['departments'], ['employees']],
  role_changed:                [['employees']],
  department_changed:          [['employees'], ['departments']],
};

function typeEmoji(type?: string) {
  switch (type) {
    case 'leave_approved':              return '✅';
    case 'leave_rejected':              return '❌';
    case 'leave_request_submitted':     return '📅';
    case 'leave_requested':             return '📅';
    case 'leave_package_allocated':     return '🎁';
    case 'issue_assigned':              return '📋';
    case 'issue_status_changed':        return '🔄';
    case 'comment_added':               return '💬';
    case 'comment_mention':             return '💬';
    case 'performance_review_added':    return '⭐';
    case 'performance_review_created':  return '⭐';
    case 'performance_review_submitted':return '⭐';
    case 'announcement':                return '📢';
    case 'slack_joined':                return '💼';
    case 'slack_employee_joined':       return '👋';
    case 'chat_mention':                return '💬';
    case 'sprint_started':              return '🚀';
    case 'sprint_completed':            return '🏁';
    case 'project_access_granted':      return '🔑';
    case 'project_access_revoked':      return '🚫';
    case 'file_uploaded':               return '📎';
    case 'department_head_assigned':    return '🏢';
    case 'role_changed':                return '👤';
    case 'department_changed':          return '🏬';
    default:                            return '🔔';
  }
}

function appendMessage(qc: ReturnType<typeof useQueryClient>, msg: any) {
  if (!msg?.conversation_id || !msg?.id) return;
  qc.setQueryData(['chat-msgs', msg.conversation_id], (old: any[] | undefined) => {
    if (!old) return old;
    if (old.some((m) => m.id === msg.id)) return old;
    return [...old, msg];
  });
  qc.invalidateQueries({ queryKey: ['chat-convs'] });
  qc.invalidateQueries({ queryKey: ['chat-unread'] });
}

export function NotificationListener() {
  const qc = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setAll = usePresenceStore((s) => s.setAll);
  const addOnline = usePresenceStore((s) => s.add);
  const removeOnline = usePresenceStore((s) => s.remove);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();

    chatApi.getPresence()
      .then((res) => setAll(res.userIds ?? []))
      .catch(() => {});

    const onNotification = (notif: { title: string; body?: string; type?: string; payload?: any }) => {
      const href = notificationHref(notif);
      toast.custom(
        (t) => (
          <button
            type="button"
            onClick={() => { toast.dismiss(t.id); if (href) router.push(href); }}
            className={`flex items-start gap-3 text-left bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 max-w-sm transition-all ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
          >
            <span className="text-lg leading-none mt-0.5">{typeEmoji(notif.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
              {notif.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.body}</p>}
            </div>
          </button>
        ),
        { duration: 5000, position: 'top-right' },
      );

      desktopNotify(notif.title, notif.body, notif.type, href);

      qc.invalidateQueries({ queryKey: ['notif-count'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      (INVALIDATIONS[notif.type ?? ''] ?? []).forEach((key) =>
        qc.invalidateQueries({ queryKey: key }),
      );
    };

    const onChatMessage = (msg: any) => appendMessage(qc, msg);
    const onOnline = (p: { userId: string }) => { if (p?.userId) addOnline(p.userId); };
    const onOffline = (p: { userId: string }) => { if (p?.userId) removeOnline(p.userId); };

    socket.on('notification', onNotification);
    socket.on('chat:message', onChatMessage);
    socket.on('presence:online', onOnline);
    socket.on('presence:offline', onOffline);
    socket.on('connect_error', (err) => console.warn('[socket] connect error:', err.message));

    return () => {
      socket.off('notification', onNotification);
      socket.off('chat:message', onChatMessage);
      socket.off('presence:online', onOnline);
      socket.off('presence:offline', onOffline);
    };
  }, [user, qc, router, setAll, addOnline, removeOnline]);

  useEffect(() => { return () => { disconnectSocket(); }; }, []);

  return null;
}
