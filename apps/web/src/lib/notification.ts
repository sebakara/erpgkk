export function notificationPayload(notif: { payload?: any; data?: any }) {
  const raw = notif?.payload ?? notif?.data;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

export function notificationHref(notif: { payload?: any; data?: any; type?: string }) {
  const data = notificationPayload(notif);
  if (typeof data.href === 'string' && data.href.startsWith('/')) return data.href;
  if (data.project_id && data.issue_id) return `/projects/${data.project_id}/board?issue=${data.issue_id}`;
  if (data.project_id) return `/projects/${data.project_id}/board`;
  if (notif.type?.startsWith('leave_') || notif.type === 'announcement' || notif.type?.startsWith('performance_')) {
    return '/hr';
  }
  return '/notifications';
}
