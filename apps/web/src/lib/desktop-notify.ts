export function requestDesktopPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
}

export function desktopNotify(title: string, body?: string, type?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const notif = new Notification(title, {
    body: body ?? '',
    icon: '/icon.png',
    tag: type,    // collapses duplicate notifications of the same type
    silent: false,
  });

  notif.onclick = () => { window.focus(); notif.close(); };
}
