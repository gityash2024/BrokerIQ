'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Bell, ExternalLink, LogOut, Menu, type LucideIcon } from 'lucide-react';
import { timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { useRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import { Avatar, Badge, Logo } from '../ui/misc';
import { Sheet } from '../ui/dialog';
import { ThemeToggle } from '../ui/theme-toggle';
import { LanguagePicker } from '../i18n/language-picker';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string | null;
  exact?: boolean;
  /** Hidden while Super Admin has this feature flag switched off. */
  flag?: string;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
}

function Nav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { flags } = useConfig();
  return (
    <nav className="space-y-6">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <p className="mb-2 px-3 text-[11px] font-bold tracking-wider text-subtle uppercase">{g.title}</p>}
          <div className="space-y-0.5">
            {g.items.filter((it) => !it.flag || flags[it.flag] !== false).map((it) => {
              const active = isActive(pathname, it);
              return (
                <Link key={it.href} href={it.href} onClick={onNavigate} className={cn('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', active ? 'text-brand-700 dark:text-white' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
                  {active && <motion.span layoutId="panel-nav" className="absolute inset-0 rounded-xl bg-brand-50 dark:bg-brand-500/15" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <it.icon className={cn('relative size-[18px]', active ? 'text-brand-600 dark:text-brand-300' : 'text-subtle group-hover:text-fg')} />
                  <span className="relative flex-1">{it.label}</span>
                  {it.badge ? <span className="relative rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">{it.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function NotificationsBell({ href }: { href: string }) {
  const { data, refetch } = useQuery({ queryKey: ['notifications'], queryFn: () => api<any>('/me/notifications'), refetchInterval: 60_000 });
  useRealtime('notification', () => refetch());
  const unread = data?.unreadCount ?? 0;
  const markAll = async () => {
    await api('/me/notifications/read', { method: 'POST', body: {} });
    refetch();
  };
  return (
    <DM.Root>
      <DM.Trigger className="relative grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg" aria-label="Notifications">
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="z-50 w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-semibold text-brand-600">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(data?.items ?? []).slice(0, 15).map((n: any) => (
              <DM.Item key={n.id} asChild>
                <Link href={n.link ?? href} className={cn('flex gap-3 border-b border-line px-4 py-3 outline-none hover:bg-surface-2', !n.readAt && 'bg-brand-50/50 dark:bg-brand-500/5')}>
                  {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="line-clamp-2 text-xs text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-subtle">{timeAgo(n.createdAt)}</p>
                  </div>
                </Link>
              </DM.Item>
            ))}
            {!data?.items?.length && <p className="p-6 text-center text-sm text-muted">कोई notification नहीं</p>}
          </div>
          <Link href={href} className="block px-4 py-3 text-center text-sm font-semibold text-brand-600 hover:bg-surface-2">
            सब देखें
          </Link>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function PanelShell({ groups, children, title, accent = 'brand', headerExtra, notificationsHref, footer }: { groups: NavGroup[]; children: React.ReactNode; title: string; accent?: 'brand' | 'dark'; headerExtra?: React.ReactNode; notificationsHref: string; footer?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { app } = useConfig();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-5">
        <Link href="/">
          <Logo name={app.siteName} className="text-lg" />
        </Link>
        <Badge tone={accent === 'dark' ? 'danger' : 'brand'} className="ml-auto text-[10px]">
          {title}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <Nav groups={groups} onNavigate={() => setOpen(false)} />
      </div>
      {footer}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar name={user?.name} src={user?.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-muted">{user?.organization?.name ?? user?.email}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-subtle hover:bg-surface-2 hover:text-rose-600" aria-label="Logout">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>
      <Sheet open={open} onOpenChange={setOpen} side="left" className="max-w-[280px]">
        {sidebar}
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-xl sm:px-6">
          <button className="rounded-xl p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <div className="flex-1">{headerExtra}</div>
          <Link href="/" target="_blank" className="hidden items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 sm:flex">
            Website <ExternalLink className="size-3.5" />
          </Link>
          {title !== 'Super Admin' && <LanguagePicker />}
          <ThemeToggle />
          <NotificationsBell href={notificationsHref} />
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
