'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, Building2, Target, MessageSquareText, ShieldCheck, Users, Workflow, ScanLine, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/realtime';
import { PanelShell, type NavGroup } from '@/components/panel/shell';
import { RequireAuth } from '@/components/site/require-auth';
import { QuickLeadSearch } from '@/components/broker/quick-search';
import { brokerWorkspaceGroups, delegatedModulePolicies } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { AgentLocationTracker } from '@/components/broker/agent-location-tracker';

function Inner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const config = useConfig();
  const delegated = user?.role === 'SUB_BROKER_ADMIN';
  const policies = delegated ? delegatedModulePolicies(config.modules, user.delegatedPermissions ?? []) : config.modules;
  const dash = useQuery({
    queryKey: ['broker-dashboard'],
    queryFn: () => api<any>('/broker/dashboard'),
    refetchInterval: 60_000,
    enabled: !delegated && pathname !== '/broker/onboarding',
  });

  useRealtime('wa:message', () => { if (!delegated) void dash.refetch(); });
  useRealtime('chat:message', () => { if (!delegated) void dash.refetch(); });
  useRealtime('wa:read', () => { if (!delegated) void dash.refetch(); });
  useRealtime('chat:read', () => { if (!delegated) void dash.refetch(); });
  useRealtime('wa:conversation_deleted', () => { if (!delegated) void dash.refetch(); });
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
    enabled: !delegated || !!user.delegatedPermissions?.includes('kyc:view'),
    refetchInterval: 60_000,
  });

  if (pathname === '/broker/onboarding') return <>{children}</>;
  const k = dash.data?.kpis;
  const kycStatus = kyc.data?.status;
  const icons = {
    today: CalendarCheck2,
    inventory: Building2,
    leads: Target,
    inbox: MessageSquareText,
    capture: ScanLine,
    kyc: ShieldCheck,
    team: Users,
    automation: Workflow,
    deals: Layers,
  };
  const groups: NavGroup[] = [
    {
      items: brokerWorkspaceGroups(policies, delegated ? 'BROKER_ADMIN' : user?.role ?? '').map((group) => ({
        ...group,
        links: group.links.filter((link) => !delegated || (
          (link.href !== '/broker/connectors' || user.delegatedPermissions?.includes('automation:connection_status')) &&
          (link.href !== '/broker/publications' || user.delegatedPermissions?.includes('inventory:approve'))
        )),
      })).filter((group) => group.links.length).map((group) => ({
        href: group.links[0].href,
        label: group.label,
        exact: group.key === 'today',
        icon: icons[group.key as keyof typeof icons] ?? Layers,
        badge:
          group.key === 'leads'
            ? k?.newToday
            : group.key === 'inbox'
              ? k?.unreadMessages
              : group.key === 'kyc'
                ? kycStatus === 'VERIFIED'
                  ? 'Verified'
                  : kycStatus === 'PENDING'
                    ? 'Under Review'
                    : kycStatus === 'REJECTED'
                      ? 'Rejected'
                      : 'Required'
                : null,
        children: group.links.length > 1 ? group.links.map((link) => ({ href: link.href, label: link.label, exact: true })) : undefined,
      })),
    },
  ];
  return (
    <PanelShell groups={groups} title="Broker" notificationsHref="/broker/notifications" headerExtra={!delegated || user.delegatedPermissions?.some((grant) => grant === 'leads:view' || grant === 'inventory:view') ? <QuickLeadSearch /> : undefined}>
      <AgentLocationTracker />
      <div className="protected-view">{delegated && pathname === '/broker' && !user.delegatedPermissions?.includes('today:view')
        ? <div className="card p-6"><h1 className="text-xl font-semibold">Sub-Broker Admin</h1><p>Open an assigned module from the sidebar.</p></div>
        : children}</div>
    </PanelShell>
  );
}

export default function BrokerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT']}>
      <Inner>{children}</Inner>
    </RequireAuth>
  );
}
