'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Bell, LogOut, Menu, Building2, SlidersHorizontal, Compass, ChevronRight, Settings, Search, Clock3, type LucideIcon } from 'lucide-react';
import { timeAgo, type NotificationsResponse } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isGateOpen, useConfig } from '@/lib/config';
import { useRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import { Avatar, Badge, Logo } from '../ui/misc';
import { Dialog, Sheet } from '../ui/dialog';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/theme-toggle';
import { LanguagePicker } from '../i18n/language-picker';
import { ModuleAccess } from './module-access';
import { ProductCatalog } from './product-catalog';
import { brokerUpcomingModules, moduleAllowed, moduleForPath } from '@brokeriq/shared';

export interface NavItem {
  href: string;
  label: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconGradient?: string;
  iconShadow?: string;
  iconImage?: string;
  badge?: number | string | null;
  exact?: boolean;
  /** Hidden while Super Admin has this feature flag switched off ('paid' = hidden in free mode). */
  flag?: string;
  /** Only these roles see the item (Super Admin always does). */
  roles?: string[];
  /** Sub-navigation items for collapsible dropdown */
  children?: NavItem[];
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

function isActive(pathname: string, item: NavItem) {
  const path = item.href.split('?')[0];
  return item.exact ? pathname === path : pathname === path || pathname.startsWith(path + '/');
}

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  if (item.iconGradient && item.icon) {
    return (
      <div
        className={cn(
          'relative size-7 shrink-0 flex items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-110 shadow-sm',
          `bg-gradient-to-br ${item.iconGradient} text-white ${item.iconShadow || ''}`,
          active ? 'ring-2 ring-brand-500/40 shadow-md scale-105' : 'opacity-90 group-hover:opacity-100',
        )}
      >
        <item.icon className="size-4 text-white stroke-[2.2] drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
      </div>
    );
  }
  if (item.iconImage) {
    return (
      <div
        className={cn(
          'relative size-6 shrink-0 flex items-center justify-center rounded-lg overflow-hidden transition-all duration-200 group-hover:scale-110 shadow-sm border border-black/5 dark:border-white/10',
          active ? 'ring-2 ring-brand-500/30 shadow-[0_2px_10px_rgba(37,99,235,0.25)]' : 'opacity-90 group-hover:opacity-100',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.iconImage}
          alt=""
          className={cn('size-full object-cover select-none transition-transform duration-200', active ? 'scale-105' : 'group-hover:scale-105')}
        />
      </div>
    );
  }
  if (item.icon) {
    return <item.icon className={cn('relative size-[18px]', active ? 'text-brand-600 dark:text-brand-300' : 'text-subtle group-hover:text-fg')} />;
  }
  return null;
}

function NavEntry({
  item,
  pathname,
  onNavigate,
  config,
  role,
  searching,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  config: any;
  role?: string;
  searching?: boolean;
}) {
  const allowedChildren = (item.children ?? []).filter(
    (child) =>
      isGateOpen(config, child.flag) &&
      (!moduleForPath(child.href) || moduleAllowed(config.modules, moduleForPath(child.href)!, role ?? '')) &&
      (!child.roles || role === 'SUPER_ADMIN' || (!!role && child.roles.includes(role))),
  );

  const hasChildren = allowedChildren.length > 0;
  const hasActiveChild = allowedChildren.some((child) => isActive(pathname, child));
  const isSelfActive = isActive(pathname, item);
  const isItemActive = isSelfActive || hasActiveChild;

  // Automatically open/expand if current pathname matches any child's href
  const [isOpen, setIsOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild, pathname]);

  if (!hasChildren) {
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
          isSelfActive ? 'text-brand-700 dark:text-white' : 'text-muted hover:bg-surface-2 hover:text-fg',
        )}
      >
        {isSelfActive && (
          <motion.span
            layoutId="panel-nav"
            className="absolute inset-0 rounded-xl bg-brand-50 dark:bg-brand-500/15"
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />
        )}
        <NavIcon item={item} active={isSelfActive} />
        <span className="relative flex-1">{item.label}</span>
        {item.badge ? <span className="relative rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">{item.badge}</span> : null}
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={!!(isOpen || searching)}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition text-left select-none',
          isItemActive ? 'text-brand-700 dark:text-white' : 'text-muted hover:bg-surface-2 hover:text-fg',
        )}
      >
        {isItemActive && !hasActiveChild && (
          <motion.span
            layoutId="panel-nav"
            className="absolute inset-0 rounded-xl bg-brand-50 dark:bg-brand-500/15"
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />
        )}
        <NavIcon item={item} active={isItemActive} />
        <span className="relative flex-1">{item.label}</span>
        {item.badge ? <span className="relative rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">{item.badge}</span> : null}
        <ChevronRight
          className={cn(
            'relative size-4 shrink-0 text-subtle transition-transform duration-200 group-hover:text-fg',
            (isOpen || searching) && 'rotate-90 text-fg',
          )}
        />
      </button>

      {(isOpen || searching) && (
        <div className="ml-5 space-y-0.5 border-l-2 border-line/70 pl-3">
          {allowedChildren.map((child) => {
            const childActive = isActive(pathname, child);
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  'group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition',
                  childActive ? 'bg-brand-50 text-brand-700 font-bold dark:bg-brand-500/15 dark:text-brand-300' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {ChildIcon && (
                    <ChildIcon
                      className={cn(
                        'size-3.5 shrink-0 transition-colors',
                        childActive ? 'text-brand-600 dark:text-brand-400' : 'text-subtle group-hover:text-fg',
                      )}
                    />
                  )}
                  <span className="truncate">{child.label}</span>
                </div>
                {child.badge ? <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{child.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Nav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const config = useConfig();
  const role = useAuth().user?.role;
  const [search, setSearch] = useState('');
  const term = search.trim().toLocaleLowerCase();
  const canShow = (item: NavItem) =>
    isGateOpen(config, item.flag) &&
    (!moduleForPath(item.href) || moduleAllowed(config.modules, moduleForPath(item.href)!, role ?? '')) &&
    (!item.roles || role === 'SUPER_ADMIN' || (!!role && item.roles.includes(role)));
  const visible = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(canShow).flatMap((item) => {
        const children = item.children?.filter(canShow);
        if (!term || item.label.toLocaleLowerCase().includes(term)) return [{ ...item, children }];
        const matches = children?.filter((child) => child.label.toLocaleLowerCase().includes(term));
        return matches?.length ? [{ ...item, children: matches }] : [];
      }),
    }))
    .filter((group) => group.items.length);
  const upcoming = brokerUpcomingModules(config.modules, role ?? '').filter((item) => `${item.name} ${item.description}`.toLocaleLowerCase().includes(term));
  return (
    <nav aria-label="Workspace navigation" className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-subtle" />
        <input
          aria-label="Find a module or tool"
          placeholder="Find a module or tool"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-xs outline-none focus:border-brand-500"
        />
      </div>
      {visible.map((group, index) => (
        <div key={group.title ?? index}>
          {group.title && <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-subtle">{group.title}</p>}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavEntry key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} config={config} role={role} searching={!!term} />
            ))}
          </div>
        </div>
      ))}
      {!!upcoming.length && (
        <details className="rounded-xl border border-dashed border-line" open={term ? true : undefined}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-muted">
            <Clock3 className="size-4" />
            <span>Coming soon</span>
            <span className="ml-auto text-subtle">{upcoming.length}</span>
          </summary>
          <div className="space-y-2 border-t border-line px-3 py-3">
            {upcoming.map((item) => (
              <div key={item.key} aria-disabled="true" className="rounded-lg bg-surface-2 p-2.5">
                <p className="text-xs font-semibold text-muted">{item.name}</p>
                <p className="mt-1 text-[11px] leading-4 text-subtle">{item.description}</p>
                <span className="mt-1 block text-[10px] font-semibold text-subtle">Coming soon · Disabled</span>
              </div>
            ))}
          </div>
        </details>
      )}
      {!visible.length && !upcoming.length && <p className="px-3 text-xs text-muted">No matching features.</p>}
    </nav>
  );
}

export function NotificationsBell({ href }: { href: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const { data, refetch, isError, isLoading } = useQuery({
    queryKey: ['notifications', user?.id, 'summary'],
    enabled: !!user,
    queryFn: () => api<NotificationsResponse>('/me/notifications'),
    refetchInterval: 60_000,
  });
  useRealtime('notification', () => refetch());
  const unread = data?.unreadCount ?? 0;
  const markAll = async () => {
    try {
      await api('/me/notifications/read', { method: 'POST', body: {} });
      await client.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <DM.Root>
      <DM.Trigger className="relative grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg" aria-label="Notifications">
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
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
                <Link
                  href={'/notification?notification=' + encodeURIComponent(n.id)}
                  className={cn('flex gap-3 border-b border-line px-4 py-3 outline-none hover:bg-surface-2', !n.readAt && 'bg-brand-50/50 dark:bg-brand-500/5')}
                >
                  {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="line-clamp-2 text-xs text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-subtle">{timeAgo(n.createdAt)}</p>
                  </div>
                </Link>
              </DM.Item>
            ))}
            {isError && (
              <button className="p-4 text-sm" onClick={() => refetch()}>
                Notifications नहीं मिलीं · Retry
              </button>
            )}
            {isLoading && <p className="p-4 text-sm">Loading…</p>}
            {!isError && !isLoading && !data?.items?.length && <p className="p-6 text-center text-sm text-muted">कोई notification नहीं</p>}
          </div>
          <Link href={href} className="block px-4 py-3 text-center text-sm font-semibold text-brand-600 hover:bg-surface-2">
            सब देखें
          </Link>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function PanelShell({
  groups,
  children,
  title,
  accent = 'brand',
  headerExtra,
  notificationsHref,
  footer,
}: {
  groups: NavGroup[];
  children: React.ReactNode;
  title: string;
  accent?: 'brand' | 'dark';
  headerExtra?: React.ReactNode;
  notificationsHref: string;
  footer?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { app } = useConfig();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-5">
        <Link href={user?.role === 'SUPER_ADMIN' ? '/admin' : user?.role === 'USER' ? '/user/account' : '/broker'}>
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
      <div className="border-t border-line px-3 pt-2">
        <Link
          href={user?.role === 'SUPER_ADMIN' ? '/admin/settings/app' : user?.role === 'USER' ? '/user/account/profile' : '/broker/settings'}
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Settings className="size-[18px]" />
          <span>{user?.role === 'BROKER_AGENT' ? 'My account' : 'Settings'}</span>
        </Link>
        {!['BROKER_ADMIN', 'BROKER_AGENT'].includes(user?.role ?? '') && <ProductCatalog />}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar name={user?.name} src={user?.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-muted">{user?.organization?.name ?? user?.email}</p>
          </div>
          <button onClick={() => setConfirmLogout(true)} className="rounded-lg p-2 text-subtle hover:bg-surface-2 hover:text-rose-600" aria-label="Logout">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="workspace-shell min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>
      <Sheet open={open} onOpenChange={setOpen} side="left" className="max-w-[280px]">
        {sidebar}
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-xl sm:px-6">
          <button className="rounded-xl p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">{headerExtra}</div>
          <LanguagePicker />
          <ThemeToggle />
          <NotificationsBell href={notificationsHref} />
        </header>
        <main className="workspace-content mx-auto max-w-[1680px] px-3.5 py-3.5 sm:px-6 sm:py-4 lg:px-8">
          <ModuleAccess>{children}</ModuleAccess>
        </main>
      </div>
      <Dialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Log out of BrokerIQ?"
        description="Are you sure you want to log out of your account?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmLogout(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmLogout(false);
                logout();
              }}
            >
              Log out
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">You will need to sign in again to access your workspace, leads and inventory.</p>
      </Dialog>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  const path = usePathname();
  const section = path.startsWith('/admin') ? 'Platform administration' : path.startsWith('/broker') ? 'Broker workspace' : 'Your property journey';
  const Icon = path.startsWith('/admin') ? SlidersHorizontal : path.startsWith('/broker') ? Building2 : Compass;
  return (
    <div className="workspace-page-header mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-brand-700 dark:text-brand-300">
          <Icon className="size-3.5" aria-hidden />
          {section}
          <ChevronRight className="size-3" aria-hidden />
        </p>
        <h1 className="break-words font-display text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 max-w-3xl text-xs sm:text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:max-w-[50%]">{actions}</div>}
    </div>
  );
}
