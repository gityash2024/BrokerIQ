'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Bell, Building2, CalendarCheck, CircleDollarSign, Handshake, Inbox, KanbanSquare, LayoutDashboard, ListChecks, MessageSquareHeart, MessagesSquare, Plug, Plus, ScanLine, Settings, Star, Users, Workflow, ShieldCheck, UserPlus, Network, KeyRound, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PrivacyConsentCard } from '@/components/privacy/privacy';
import { PanelShell, type NavGroup } from '@/components/panel/shell';
import { RequireAuth } from '@/components/site/require-auth';
import { Button } from '@/components/ui/button';
import { QuickLeadSearch } from '@/components/broker/quick-search';
import { AddLeadDialog } from '@/components/broker/add-lead';

function Inner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const admin = user?.role === 'BROKER_ADMIN' || user?.role === 'SUPER_ADMIN';
  const dash = useQuery({ queryKey: ['broker-dashboard'], queryFn: () => api<any>('/broker/dashboard'), refetchInterval: 60_000, enabled: pathname !== '/broker/onboarding' });
  useEffect(() => {
    if (user?.role === 'BROKER_ADMIN' && user.organization && !user.organization.onboarded && pathname !== '/broker/onboarding') router.replace('/broker/onboarding');
  }, [user, pathname, router]);
  if (pathname === '/broker/onboarding') return <>{children}</>;
  const k = dash.data?.kpis;
  const groups: NavGroup[] = [
    {
      items: [
        { href: '/broker', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { href: '/broker/leads', label: 'Leads', icon: Inbox, badge: k?.newToday || null },
        { href: '/broker/pipeline', label: 'Pipeline', icon: KanbanSquare },
        { href: '/broker/follow-ups', label: 'Follow-ups', icon: ListChecks, badge: k?.overdue || null },
        { href: '/broker/visits', label: 'Site visits', icon: CalendarCheck },
        { href: '/broker/inbox', label: 'WhatsApp & chat', icon: MessagesSquare, badge: k?.unreadMessages || null },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { href: '/broker/listings', label: 'Listings', icon: Building2 },
        { href: '/broker/scanner', label: 'AI book scanner', icon: ScanLine },
        { href: '/broker/deals', label: 'Deals & commission', icon: Handshake },
        { href: '/broker/invoices', label: 'Invoices', icon: FileText },
        { href: '/broker/owners', label: 'Owners & leases', icon: KeyRound },
        { href: '/broker/network', label: 'Co-broking network', icon: Network },
      ],
    },
    {
      title: 'Growth',
      items: [
        ...(admin ? [{ href: '/broker/automations', label: 'Automations', icon: Workflow }, { href: '/broker/connectors', label: 'Lead connectors', icon: Plug }] : []),
        { href: '/broker/analytics', label: 'Analytics', icon: BarChart3 },
        ...(admin ? [{ href: '/broker/reviews', label: 'Reviews', icon: Star }] : []),
      ],
    },
    {
      title: 'Firm',
      items: [
        { href: '/broker/team', label: 'Team', icon: Users },
        { href: '/broker/invite-brokers', label: 'Brokers को invite करें', icon: UserPlus },
        ...(admin ? [{ href: '/broker/billing', label: 'Plan & billing', icon: CircleDollarSign }, { href: '/broker/settings', label: 'Settings', icon: Settings }] : []),
        { href: '/broker/notifications', label: 'Notifications', icon: Bell },
        { href: '/broker/privacy', label: 'Privacy & data sharing', icon: ShieldCheck },
        { href: '/broker/feedback', label: 'Feedback', icon: MessageSquareHeart },
      ],
    },
  ];
  return (
    <PanelShell
      groups={groups}
      title="Broker"
      notificationsHref="/broker/notifications"
      headerExtra={
        <div className="flex items-center gap-2">
          <QuickLeadSearch />
          <Button size="sm" onClick={() => setAddOpen(true)} className="hidden sm:inline-flex">
            <Plus className="size-4" /> Lead
          </Button>
        </div>
      }
    >
      {children}
      <AddLeadDialog open={addOpen} onOpenChange={setAddOpen} />
      <PrivacyConsentCard />
    </PanelShell>
  );
}

export default function BrokerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={['BROKER_ADMIN', 'BROKER_AGENT']}>
      <Inner>{children}</Inner>
    </RequireAuth>
  );
}
