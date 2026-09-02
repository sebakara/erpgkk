import type { Notification } from '@/types';

export function notificationPayload(notification?: Pick<Notification, 'payload'> | { payload?: any } | null): Record<string, any> {
  const raw = notification?.payload;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (typeof raw === 'object') return raw;
  return {};
}

export function notificationHref(notification?: Pick<Notification, 'payload' | 'type'> | { payload?: any; type?: string } | null): string | null {
  const payload = notificationPayload(notification);
  if (typeof payload.href === 'string' && payload.href.startsWith('/')) return payload.href;
  return null;
}
