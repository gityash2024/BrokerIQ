'use client';
import { Building, Heart, Search, Send, MessagesSquare, UserCircle, ShieldCheck, ClipboardList, CalendarCheck, LayoutDashboard, Bell } from 'lucide-react';
import { RequireAuth } from '@/components/site/require-auth';
import { PanelShell } from '@/components/panel/shell';
const groups = [
  {
    items: [
      { href: '/user/account', label: 'My overview', icon: LayoutDashboard, exact: true },
      { href: '/user/account/saved', label: 'Saved properties', icon: Heart },
      { href: '/user/account/searches', label: 'Search alerts', icon: Search },
      { href: '/user/account/requirements', label: 'My requirements', icon: ClipboardList },
      { href: '/user/account/enquiries', label: 'Enquiries', icon: Send },
      { href: '/user/account/messages', label: 'Messages', icon: MessagesSquare },
      { href: '/user/account/visits', label: 'Site visits', icon: CalendarCheck },
    ],
  },
  { title: 'Owner', items: [{ href: '/user/account/listings', label: 'My listings', icon: Building }] },
  {
    title: 'Account',
    items: [
      { href: '/user/account/notifications', label: 'Notifications', icon: Bell },
      { href: '/user/account/profile', label: 'Profile', icon: UserCircle },
      { href: '/user/account/privacy', label: 'Privacy & data', icon: ShieldCheck },
    ],
  },
];
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={['USER']}>
      <PanelShell groups={groups} title="My account" notificationsHref="/user/account/notifications">
        {children}
      </PanelShell>
    </RequireAuth>
  );
}
