'use client';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BadgeCheck,
  BadgeIndianRupee,
  Bell,
  BookOpen,
  Building,
  Building2,
  CircleHelp,
  CreditCard,
  FileText,
  Flag,
  Gauge,
  HardHat,
  Home,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  MessageSquareHeart,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TicketPercent,
  ToggleRight,
  Users, Contact } from 'lucide-react';
import { api } from '@/lib/api';
import { PanelShell, type NavGroup } from '@/components/panel/shell';
import { RequireAuth } from '@/components/site/require-auth';

function Inner({ children }: { children: React.ReactNode }) {
  const dash = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api<any>('/admin/dashboard'), refetchInterval: 120_000 });
  const k = dash.data?.kpis;
  const missing = (dash.data?.integrations ?? []).filter((i: any) => !i.configured).length;
  const groups: NavGroup[] = [
    {
      items: [
        { href: '/admin', label: 'Command center', icon: LayoutDashboard, exact: true },
        { href: '/admin/health', label: 'System health', icon: Activity },
      ],
    },
    {
      title: 'Trust & safety',
      items: [
        { href: '/admin/moderation', label: 'Moderation queue', icon: ListChecks, badge: k?.pendingListings || null },
        { href: '/admin/kyc', label: 'KYC & verification', icon: BadgeCheck, badge: k?.kycPending || null },
        { href: '/admin/reports', label: 'Reported listings', icon: ShieldAlert, badge: k?.reportsOpen || null },
        { href: '/admin/listings', label: 'All listings', icon: Home },
      ],
    },
    {
      title: 'People',
      items: [
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/user-data', label: 'User data (consented)', icon: Contact },
        { href: '/admin/brokers', label: 'Broker firms', icon: Building2 },
        { href: '/admin/support', label: 'Support inbox', icon: LifeBuoy, badge: k?.openTickets || null },
        { href: '/admin/feedback', label: 'Feedback & roadmap', icon: MessageSquareHeart },
        { href: '/admin/broadcasts', label: 'Broadcasts', icon: Megaphone },
      ],
    },
    {
      title: 'Revenue',
      items: [
        { href: '/admin/plans', label: 'Plans & pricing', icon: Sparkles },
        { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
        { href: '/admin/payments', label: 'Payments', icon: BadgeIndianRupee },
        { href: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
        { href: '/admin/broker-invites', label: 'Broker invites', icon: TicketPercent },
      ],
    },
    {
      title: 'Content (CMS)',
      items: [
        { href: '/admin/homepage', label: 'Homepage builder', icon: Gauge },
        { href: '/admin/pages', label: 'Pages', icon: FileText },
        { href: '/admin/blog', label: 'Blog', icon: BookOpen },
        { href: '/admin/faqs', label: 'FAQs', icon: CircleHelp },
        { href: '/admin/templates', label: 'Message templates', icon: Mail },
      ],
    },
    {
      title: 'Master data',
      items: [
        { href: '/admin/localities', label: 'Localities', icon: MapPin },
        { href: '/admin/projects', label: 'Projects', icon: Building },
        { href: '/admin/builders', label: 'Builders', icon: HardHat },
        { href: '/admin/amenities', label: 'Amenities', icon: Flag },
      ],
    },
    {
      title: 'Settings',
      items: [
        { href: '/admin/settings/integrations', label: 'Credentials center', icon: KeyRound, badge: missing || null },
        { href: '/admin/settings/app', label: 'App config', icon: SlidersHorizontal },
        { href: '/admin/settings/flags', label: 'Feature flags', icon: ToggleRight },
        { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
        { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      ],
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
