'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, Building2, Target, MessageSquareText, ShieldCheck, Users, Workflow, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PanelShell, type NavGroup } from '@/components/panel/shell';
import { RequireAuth } from '@/components/site/require-auth';
import { Button } from '@/components/ui/button';
import { QuickLeadSearch } from '@/components/broker/quick-search';
import { AddLeadDialog } from '@/components/broker/add-lead';
import { AgentLocationTracker } from '@/components/broker/agent-location-tracker';

function Inner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const dash = useQuery({
    queryKey: ['broker-dashboard'],
    queryFn: () => api<any>('/broker/dashboard'),
    refetchInterval: 60_000,
    enabled: pathname !== '/broker/onboarding',
  });
  useEffect(() => {
    if (user?.role === 'BROKER_ADMIN' && user.organization && !user.organization.onboarded && pathname !== '/broker/onboarding')
      router.replace('/broker/onboarding');
  }, [user, pathname, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const kyc = useQuery({
    queryKey: ['agent-kyc-mine-status'],
    queryFn: () => api<any>('/broker/team/agent-kyc/mine'),
    refetchInterval: 60_000,
  });

  if (pathname === '/broker/onboarding') return <>{children}</>;
  const k = dash.data?.kpis;
  const kycStatus = kyc.data?.status;
  const groups: NavGroup[] = [
    {
      items: [
        {
          href: '/broker',
          label: 'Today • आज का काम',
          icon: CalendarCheck2,
          iconGradient: 'from-amber-500 to-orange-500',
          iconShadow: 'shadow-amber-500/25',
          exact: true,
        },
        {
          href: '/broker/inventory',
          label: 'Inventory',
          icon: Building2,
          iconGradient: 'from-blue-600 to-cyan-500',
          iconShadow: 'shadow-blue-500/25',
        },
        {
          href: '/broker/leads',
          label: 'Leads',
          icon: Target,
          iconGradient: 'from-violet-600 to-fuchsia-600',
          iconShadow: 'shadow-violet-500/25',
          badge: k?.newToday || null,
        },
        {
          href: '/broker/inbox',
          label: 'Inbox',
          icon: MessageSquareText,
          iconGradient: 'from-emerald-500 to-teal-600',
          iconShadow: 'shadow-emerald-500/25',
          badge: k?.unreadMessages || null,
        },
        {
          href: '/broker/kyc',
          label: 'KYC',
          icon: ShieldCheck,
          iconGradient: 'from-indigo-600 to-blue-600',
          iconShadow: 'shadow-indigo-500/25',
          badge: kycStatus === 'VERIFIED' ? 'Verified' : kycStatus === 'PENDING' ? 'Under Review' : kycStatus === 'REJECTED' ? 'Rejected' : 'Required',
        },
        ...(user?.role === 'BROKER_ADMIN' || user?.role === 'SUPER_ADMIN'
          ? [
              {
                href: '/broker/team',
                label: 'Team & Agents',
                icon: Users,
                iconGradient: 'from-sky-600 to-indigo-600',
                iconShadow: 'shadow-sky-500/25',
              },
            ]
          : []),
        ...(user?.role === 'BROKER_ADMIN' || user?.role === 'SUPER_ADMIN'
          ? [
              {
                href: '/broker/automations',
                label: 'Automation',
                icon: Workflow,
                iconGradient: 'from-pink-600 to-rose-600',
                iconShadow: 'shadow-pink-500/25',
              },
            ]
          : []),
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
      <AgentLocationTracker />
      <div className="protected-view">{children}</div>
      <AddLeadDialog open={addOpen} onOpenChange={setAddOpen} />
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
