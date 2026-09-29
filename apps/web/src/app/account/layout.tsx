'use client';
import { Bell, Building, Heart, LayoutDashboard, MessageSquareHeart, MessagesSquare, Search, Send, UserCircle, ShieldCheck , ClipboardList, CalendarCheck } from 'lucide-react';
import { PrivacyConsentCard } from '@/components/privacy/privacy';
import { PanelShell } from '@/components/panel/shell';
import { RequireAuth } from '@/components/site/require-auth';
import { Button } from '@/components/ui/button';

const GROUPS = [
  {
    items: [
      { href: '/account', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/account/saved', label: 'Saved properties', icon: Heart },
      { href: '/account/searches', label: 'Saved searches & alerts', icon: Search },
      { href: '/account/requirements', label: 'मेरी ज़रूरतें', icon: ClipboardList },
      { href: '/account/visits', label: 'Visits & tokens', icon: CalendarCheck },
      { href: '/account/enquiries', label: 'Enquiries', icon: Send },
      { href: '/account/messages', label: 'Messages', icon: MessagesSquare },
    ],
  },
  {
    title: 'Owner',
    items: [{ href: '/account/listings', label: 'My listings', icon: Building }],
  },
  {
    title: 'Account',
    items: [
      { href: '/account/notifications', label: 'Notifications', icon: Bell },
      { href: '/account/feedback', label: 'My feedback', icon: MessageSquareHeart },
      { href: '/account/profile', label: 'Profile & KYC', icon: UserCircle },
      { href: '/account/privacy', label: 'Privacy & data sharing', icon: ShieldCheck },
    ],
  },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={['USER']}>
      <PanelShell
        groups={GROUPS}
        title="My account"
        notificationsHref="/account/notifications"
        headerExtra={
          <Button href="/post-property" size="sm" variant="accent" className="hidden sm:inline-flex">
            + Post property FREE
          </Button>
        }
        footer={
          <div className="mx-3 mb-3 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-800 p-4 text-white">
            <p className="text-sm font-bold">क्या आप broker हैं?</p>
            <p className="mt-1 text-xs text-white/75">सारी portal leads + WhatsApp automation</p>
            <Button href="/for-brokers" size="xs" variant="accent" className="mt-3">
              Broker बनें
            </Button>
          </div>
        }
      >
        {children}
        <PrivacyConsentCard />
      </PanelShell>
    </RequireAuth>
  );
}
