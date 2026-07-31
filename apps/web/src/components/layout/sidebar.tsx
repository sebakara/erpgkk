'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';
import {
  LayoutDashboard, FolderOpen, Users, Bell, LogOut, Settings, MessageSquare,
} from 'lucide-react';

const ALL_NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'employee'] },
  { label: 'Projects', href: '/projects', icon: FolderOpen, roles: ['admin', 'manager', 'employee'] },
  { label: 'HR', href: '/hr', icon: Users, roles: ['admin', 'manager', 'employee'] },
  { label: 'Messages', href: '/chat', icon: MessageSquare, roles: ['admin', 'manager', 'employee'] },
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: ['admin', 'manager', 'employee'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin', 'manager'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const nav = ALL_NAV.filter((n) => !user?.role || n.roles.includes(user.role));

  const { data: unreadData } = useQuery({
    queryKey: ['chat-unread'],
    queryFn: chatApi.getUnread,
    refetchInterval: 10000,
    enabled: !!user,
  });
  const chatUnread: number = (unreadData as any)?.count ?? 0;

  return (
    <aside className="w-60 bg-[#1e1b4b] flex flex-col text-white shrink-0">
      <div className="p-5 border-b border-indigo-900">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🏢</span>
          <div>
            <p className="font-bold text-sm leading-tight">GKK ERP</p>
            <p className="text-indigo-300 text-xs">CompanyOS</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-indigo-700 text-white'
                : 'text-indigo-200 hover:bg-indigo-800 hover:text-white',
            )}>
            <Icon size={17} />
            <span className="flex-1">{label}</span>
            {href === '/chat' && chatUnread > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {chatUnread > 9 ? '9+' : chatUnread}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-indigo-900">
        <Link href="/profile" className="flex items-center gap-2.5 px-2 py-2 mb-2 rounded-lg hover:bg-indigo-800 transition-colors">
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold shrink-0">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-indigo-300 capitalize">{user?.role}</p>
          </div>
        </Link>
        <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2 text-indigo-300 hover:text-white hover:bg-indigo-800 rounded-lg text-sm transition-colors">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
