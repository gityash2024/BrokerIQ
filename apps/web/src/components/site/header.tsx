'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Bell, Building2, Heart, LayoutDashboard, LogOut, Menu, MessageSquare, Plus, Shield, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Avatar, Logo } from '../ui/misc';
import { Button } from '../ui/button';
import { Sheet } from '../ui/dialog';
import { LanguagePicker } from '../i18n/language-picker';
import { ThemeToggle } from '../ui/theme-toggle';

const NAV = [
  { href: '/rent', label: 'Rent' },
  { href: '/commercial', label: 'Commercial' },
  { href: '/localities', label: 'Localities' },
  { href: '/brokers', label: 'Brokers' },
  { href: '/tools', label: 'Tools' },
];

export function SiteHeader({ transparent }: { transparent?: boolean }) {
  const { user, ready, logout, homePath, isBroker, isAdmin } = useAuth();
  const { app } = useConfig();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const solid = !transparent || scrolled;

  return (
    <>
      {app.announcement.enabled && app.announcement.text && (
        <div
          className={cn(
            'relative z-40 px-4 py-2 text-center text-sm font-medium',
            app.announcement.tone === 'warning'
              ? 'bg-amber-500 text-slate-950'
              : app.announcement.tone === 'promo'
                ? 'bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white'
                : 'bg-brand-600 text-white',
          )}
        >
          {app.announcement.link ? (
            <Link href={app.announcement.link} className="underline-offset-2 hover:underline">
              {app.announcement.text} →
            </Link>
          ) : (
            app.announcement.text
          )}
        </div>
      )}
      <header
        className={cn('sticky top-0 z-40 transition-all duration-300', solid ? 'border-b border-line/70 bg-surface/80 backdrop-blur-xl' : 'bg-transparent')}
      >
        <div className="container-x flex h-16 items-center gap-4">
          <button className={cn('rounded-xl p-2 xl:hidden', solid ? 'text-fg' : 'text-white')} onClick={() => setOpen(true)} aria-label="Menu">
            <Menu className="size-6" />
          </button>
          <Link href="/" aria-label="Home">
            <Logo light={!solid} name={app.siteName} />
          </Link>
          <nav className="ml-6 hidden items-center gap-1 xl:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition',
                  solid ? 'text-muted hover:text-fg' : 'text-white/80 hover:text-white',
                  pathname.startsWith(n.href) && (solid ? 'text-brand-600' : 'text-white'),
                )}
              >
                {n.label}
                {pathname.startsWith(n.href) && (
                  <motion.span layoutId="nav-underline" className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-saffron-500" />
                )}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguagePicker light={!solid} />
            <ThemeToggle className={cn('hidden sm:grid', !solid && 'text-white hover:bg-white/10 hover:text-white')} />
            {!isBroker && !isAdmin && (
              <Button href="/post-property" size="sm" variant={solid ? 'accent' : 'accent'} className="hidden sm:inline-flex">
                <Plus className="size-4" /> Post Property <span className="rounded-md bg-slate-950/10 px-1.5 text-[10px] font-bold">FREE</span>
              </Button>
            )}
            {ready && !user && (
              <Button
                href="/login"
                size="sm"
                variant={solid ? 'secondary' : 'secondary'}
                className={cn(!solid && 'border-white/30 bg-white/10 text-white hover:bg-white/20')}
              >
                Login
              </Button>
            )}
            {user && (
              <DM.Root>
                <DM.Trigger className="rounded-full ring-2 ring-transparent transition hover:ring-brand-400 focus:outline-none" aria-label="Account">
                  <Avatar name={user.name} src={user.avatarUrl} size={38} />
                </DM.Trigger>
                <DM.Portal>
                  <DM.Content align="end" sideOffset={8} className="z-50 w-64 rounded-2xl border border-line bg-surface p-2 shadow-xl">
                    <div className="px-3 py-2">
                      <p className="truncate font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                    <DM.Separator className="my-1 h-px bg-line" />
                    <MenuLink
                      href={homePath}
                      icon={isAdmin ? <Shield className="size-4" /> : isBroker ? <Building2 className="size-4" /> : <LayoutDashboard className="size-4" />}
                    >
                      {isAdmin ? 'Super Admin' : isBroker ? 'Broker panel' : 'My dashboard'}
                    </MenuLink>
                    {!isAdmin && !isBroker && (
                      <>
                        <MenuLink href="/account/saved" icon={<Heart className="size-4" />}>
                          Saved properties
                        </MenuLink>
                        <MenuLink href="/account/messages" icon={<MessageSquare className="size-4" />}>
                          Messages
                        </MenuLink>
                      </>
                    )}
                    <MenuLink href={isBroker ? '/broker/notifications' : '/account/notifications'} icon={<Bell className="size-4" />}>
                      Notifications
                    </MenuLink>
                    <MenuLink href={isBroker ? '/broker/settings' : '/account/profile'} icon={<UserIcon className="size-4" />}>
                      Profile
                    </MenuLink>
                    <DM.Separator className="my-1 h-px bg-line" />
                    <DM.Item
                      onSelect={() => logout()}
                      className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 outline-none hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <LogOut className="size-4" /> Logout
                    </DM.Item>
                  </DM.Content>
                </DM.Portal>
              </DM.Root>
            )}
          </div>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen} side="left" title={<Logo name={app.siteName} />}>
        <div className="flex flex-col p-3">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 font-semibold hover:bg-surface-2">
              {n.label}
            </Link>
          ))}
          <Link href="/for-brokers" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 font-semibold text-brand-600 hover:bg-surface-2">
            For Brokers
          </Link>
          <div className="mt-4 px-2">
            <Button href="/post-property" variant="accent" className="w-full">
              <Plus className="size-4" /> Post Property FREE
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between px-4">
            <span className="text-sm text-muted">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </Sheet>
      <AnimatePresence />
    </>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <DM.Item asChild>
      <Link href={href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-fg outline-none hover:bg-surface-2">
        {icon}
        {children}
      </Link>
    </DM.Item>
  );
}
