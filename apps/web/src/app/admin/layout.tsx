'use client';
import { useQuery } from '@tanstack/react-query';
import { Building2, LayoutDashboard, SlidersHorizontal, Users, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { PanelShell, type NavGroup } from '@/components/panel/shell';
import { RequireAuth } from '@/components/site/require-auth';
import { useConfig } from '@/lib/config';
import { ADMIN_BUSINESS_RESOURCES, moduleAllowed, type AdminBusinessResource } from '@brokeriq/shared';
import { adminToolGroups } from '@/components/admin/admin-tools';

const recordSections: { label: string; resources: AdminBusinessResource[] }[] = [
  { label: 'Leads & visits', resources: ['leads', 'requirements', 'followups', 'visits'] },
  { label: 'Property & imports', resources: ['inventory', 'listings', 'imports', 'sources'] },
  { label: 'Inbox & compliance', resources: ['conversations', 'messages', 'kyc', 'shifts'] },
  { label: 'Invoices & operations', resources: ['invoices', 'automations', 'runs', 'webhooks', 'jobs', 'ai'] },
];

function Inner({ children }: { children: React.ReactNode }) {
  const { modules } = useConfig();
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
          href: '/admin/team',
          label: 'Team & Agents',
          icon: Users,
          iconGradient: 'from-sky-600 to-indigo-600',
          iconShadow: 'shadow-sky-500/25',
          children: [
            {
              href: '/admin/team',
              label: 'Team Members',
              exact: true,
              icon: Users,
            },
            {
              href: '/admin/team/leaderboard',
              label: 'Leaderboard',
              icon: Users,
            },
            {
              href: '/admin/team/time-logging',
              label: 'Time Logging',
              icon: Clock,
            },
          ],
        },
        { href: '/admin/system', label: 'System', icon: SlidersHorizontal },
      ],
    },
    {
      title: 'Business records',
      items: recordSections.map(({ label, resources }) => ({
        href: '/admin/business?resource=' + resources[0],
        label,
        icon: Building2,
        children: resources.map((resource) => ({
          href: '/admin/business?resource=' + resource,
          label: ADMIN_BUSINESS_RESOURCES[resource],
          activeQuery: { key: 'resource', value: resource, defaultValue: 'leads' },
        })),
      })),
    },
    {
      title: 'Administration',
      items: adminToolGroups.flatMap((group) => {
        const children = group.tools
          .filter((tool) => !tool.module || moduleAllowed(modules, tool.module, 'SUPER_ADMIN'))
          .map((tool) => ({
            href: tool.href,
            label: tool.title,
            exact: tool.href === '/admin/inventory',
            badge: tool.href === '/admin/settings/integrations' ? missing || null : null,
          }));
        if (!children.length) return [];
        return [{ href: children[0].href, label: group.title, icon: group.icon, children }];
      }),
    },
  ];
  return (
    <PanelShell groups={groups} title="Super Admin" accent="dark" notificationsHref="/admin/notifications">
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
