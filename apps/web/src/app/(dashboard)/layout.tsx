'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { NotificationListener } from '@/components/layout/notification-listener';
import { Bell, X } from 'lucide-react';

function NotificationBanner() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  if (dismissed || permission === 'granted' || permission === null) return null;

  const handleAllow = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') setDismissed(true);
  };

  return (
    <div className="flex items-center gap-3 bg-indigo-600 text-white px-4 py-2.5 text-sm">
      <Bell size={15} className="shrink-0" />
      {permission === 'denied' ? (
        <span className="flex-1">
          Desktop notifications are blocked. To enable them, click the lock icon in your browser's address bar and allow notifications for this site.
        </span>
      ) : (
        <>
          <span className="flex-1">Enable desktop notifications to get instant alerts for leave approvals, task assignments, and more.</span>
          <button onClick={handleAllow} className="shrink-0 bg-white text-indigo-700 font-semibold px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors text-xs">
            Enable
          </button>
        </>
      )}
      <button onClick={() => setDismissed(true)} className="shrink-0 p-0.5 hover:bg-white/20 rounded transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const updateUser = useAuthStore((s) => s.updateUser);

  useEffect(() => {
    if (hasHydrated && !user) router.replace('/login');
  }, [hasHydrated, user, router]);

  useEffect(() => {
    if (!hasHydrated || !user) return;
    let cancelled = false;
    authApi.me().then((me) => {
      if (!cancelled && me) updateUser(me);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [hasHydrated, user?.id, updateUser]);

  if (!hasHydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <NotificationListener />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <NotificationBanner />
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
