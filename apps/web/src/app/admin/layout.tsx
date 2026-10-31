'use client';
import { useQuery } from '@tanstack/react-query';
import { Building2, KeyRound, LayoutDashboard, SlidersHorizontal, ToggleRight } from 'lucide-react';
import { api } from '@/lib/api';
import { PanelShell, type NavGroup } from '@/components/panel/shell';
import { RequireAuth } from '@/components/site/require-auth';
import { useAuth } from '@/lib/auth';

function Inner({ children }: { children: React.ReactNode }) {
  const role = useAuth().user?.role;
  const dash = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api<any>('/admin/dashboard'), refetchInterval: 120_000 });
  const missing = (dash.data?.integrations ?? []).filter((i: any) => !i.configured).length;
  const groups: NavGroup[] = [
    {
      items: [
        {
          href: '/admin',
          label: 'Overview',
          icon: LayoutDashboard,
          iconGradient: 'from-blue-600 to-indigo-600',
          iconShadow: 'shadow-blue-500/25',
          exact: true,
        },
        {
          href: '/admin/brokers',
          label: 'Broker firms',
          icon: Building2,
          iconGradient: 'from-emerald-600 to-teal-700',
          iconShadow: 'shadow-emerald-500/25',
        },
        {
          href: '/admin/modules',
          label: 'Modules & permissions',
          icon: ToggleRight,
          iconGradient: 'from-violet-600 to-purple-700',
          iconShadow: 'shadow-violet-500/25',
        },
        {
          href: '/admin/settings/integrations',
          label: 'Integrations',
          icon: KeyRound,
          iconGradient: 'from-amber-500 to-orange-600',
          iconShadow: 'shadow-amber-500/25',
          badge: missing || null,
        },
        {
          href: '/admin/system',
          label: 'System',
          icon: SlidersHorizontal,
          iconGradient: 'from-slate-700 to-zinc-900',
          iconShadow: 'shadow-slate-500/25',
        },
      ],
    },
  ];
  return (
    <PanelShell groups={groups} title={role === 'SUPER_ADMIN' ? 'Super Admin' : 'BrokerIQ team'} accent="dark" notificationsHref="/admin/notifications">
      {children}
    </PanelShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={['SUPER_ADMIN']}>
      <Inner>{children}</Inner>
    </RequireAuth>
  );
}
