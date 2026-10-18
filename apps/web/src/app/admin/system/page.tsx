'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Activity, ArrowUpRight, Building2, Database, FileText, Search, Settings2, ShieldCheck, Clock3 } from 'lucide-react';
import { defaultModulePolicies, moduleAllowed } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { PageHeader } from '@/components/panel/shell';
import { Input } from '@/components/ui/field';

type Tool = { title: string; href: string; description: string; module?: string };
const groups: { title: string; icon: typeof Activity; tools: Tool[] }[] = [
  {
    title: 'Platform operations',
    icon: Activity,
    tools: [
      { title: 'Health & background jobs', href: '/admin/health', description: 'Runtime, database, recovery and provider readiness' },
      { title: 'Audit log', href: '/admin/audit', description: 'Recorded administrative actions and changes' },
      { title: 'App & release settings', href: '/admin/settings/app', description: 'Android release, branding and platform configuration' },
      { title: 'Modules & permissions', href: '/admin/modules', description: 'Availability and role access across every portal' },
      { title: 'Integrations', href: '/admin/settings/integrations', description: 'Encrypted credentials and connection verification' },
      { title: 'Legacy feature switches', href: '/admin/settings/flags', description: 'Preserved feature-level controls' },
      { title: 'Notifications', href: '/admin/notifications', description: 'System alerts and activity requiring attention' },
    ],
  },
  {
    title: 'People & workspaces',
    icon: Building2,
    tools: [
      { title: 'Broker firms', href: '/admin/brokers', description: 'Firm access, verification and workspace administration' },
      { title: 'Broker invitations', href: '/admin/broker-invites', description: 'Invitation status and controlled broker onboarding' },
      { title: 'Customer & team accounts', href: '/admin/users', description: 'Registered accounts, roles and access controls' },
      { title: 'User data requests', href: '/admin/user-data', description: 'Consented records and privacy request management' },
    ],
  },
  {
    title: 'Property intelligence',
    icon: Database,
    tools: [
      { title: 'Private inventory & source review', href: '/admin/inventory', description: 'Firm records, imports and extraction review' },
      { title: 'Area Directory', href: '/admin/inventory/directory', description: 'Official project records, detailed facts and source geometry' },
      { title: 'Public listings', href: '/admin/listings', description: 'Published and submitted consumer listings' },
      { title: 'Moderation queue', href: '/admin/moderation', description: 'Approve or reject submitted listings with recorded reasons' },
      { title: 'Enquiries', href: '/admin/enquiries', description: 'Customer enquiries and routing information' },
      { title: 'Developers', href: '/admin/builders', description: 'Verified developer master data' },
      { title: 'Projects', href: '/admin/projects', description: 'Managed project master data and linked listings' },
      { title: 'Localities', href: '/admin/localities', description: 'Gurugram locality guides and search taxonomy' },
      { title: 'Amenities', href: '/admin/amenities', description: 'Property amenities and filter vocabulary' },
    ],
  },
  {
    title: 'Trust & communication',
    icon: ShieldCheck,
    tools: [
      { title: 'Identity verification', href: '/admin/kyc', description: 'KYC submissions and verification decisions' },
      { title: 'Chat reports', href: '/admin/chat-reports', description: 'Reported conversations and moderation actions' },
      { title: 'Blocklist', href: '/admin/blocklist', description: 'Platform abuse prevention controls' },
      { title: 'Feedback', href: '/admin/feedback', description: 'Reported issues and product feedback' },
      { title: 'Support', href: '/admin/support', description: 'Customer support requests and resolution' },
      { title: 'Visit verification', href: '/admin/visit-verification', description: 'Visit records requiring verification' },
      { title: 'Locality reviews', href: '/admin/locality-reviews', description: 'Source and resident review moderation' },
      { title: 'Message templates', href: '/admin/templates', description: 'Configured reusable communication templates' },
    ],
  },
  {
    title: 'Content & discovery',
    icon: FileText,
    tools: [
      { title: 'Content centre', href: '/admin/content', description: 'Search metadata and published content controls' },
      { title: 'Homepage', href: '/admin/homepage', description: 'Configured sections and marketplace presentation' },
      { title: 'Pages & legal', href: '/admin/pages', description: 'Published help, policies and static pages' },
      { title: 'FAQs', href: '/admin/faqs', description: 'Help content for common product questions' },
      { title: 'Blog', href: '/admin/blog', description: 'Editorial content management' },
    ],
  },
  {
    title: 'Additional product controls',
    icon: Settings2,
    tools: [
      { title: 'Broadcasts', href: '/admin/broadcasts', description: 'Bulk campaign controls', module: 'campaigns' },
      { title: 'Plans', href: '/admin/plans', description: 'Subscription plan configuration', module: 'billing' },
      { title: 'Subscriptions', href: '/admin/subscriptions', description: 'Plan assignment and subscription records', module: 'billing' },
      { title: 'Payments', href: '/admin/payments', description: 'Recorded payment administration', module: 'billing' },
      { title: 'Coupons', href: '/admin/coupons', description: 'Promotion configuration', module: 'billing' },
      { title: 'Reports', href: '/admin/reports', description: 'Additional analytics and exports', module: 'reports' },
      { title: 'Move-in services', href: '/admin/services', description: 'Service catalogue administration', module: 'move_in_services' },
    ],
  },
];
export default function SystemPage() {
  const [search, setSearch] = useState('');
  const { modules } = useConfig();
  const policies = { ...defaultModulePolicies(), ...modules };
  const filtered = groups
    .map((group) => ({
      ...group,
      tools: group.tools.filter(
        (tool) =>
          (!tool.module || policies[tool.module]?.state !== 'HIDDEN') &&
          `${tool.title} ${tool.description} ${group.title}`.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((group) => group.tools.length);
  return (
    <div className="space-y-6">
      <PageHeader
        title="System workspace"
        subtitle="Every administrative tool, organized around the work. Core navigation stays focused; supporting controls remain discoverable here."
      />
      <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <Input
            aria-label="Search administrative tools"
            icon={<Search className="size-4" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools, source review, users…"
          />
        </div>
        <p className="text-xs text-muted">{filtered.reduce((count, group) => count + group.tools.length, 0)} tools · Permission-aware access</p>
      </div>
      {filtered.map((group) => (
        <section key={group.title}>
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
            <group.icon className="size-5 text-brand-600" />
            {group.title}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.tools.map((tool) => {
              const available = !tool.module || moduleAllowed(policies, tool.module, 'SUPER_ADMIN');
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-bold">{tool.title}</h3>
                    {available ? <ArrowUpRight className="size-4 shrink-0 text-brand-600" /> : <Clock3 className="size-4 shrink-0 text-muted" />}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted">{tool.description}</p>
                  {!available && (
                    <span className="mt-3 inline-block rounded-md bg-surface-2 px-2 py-1 text-[10px] font-semibold text-muted">
                      {policies[tool.module!]?.state === 'COMING_SOON' ? 'Coming soon · Disabled' : 'Access restricted'}
                    </span>
                  )}
                </>
              );
              return available ? (
                <Link key={tool.href} href={tool.href} className="card p-5 transition hover:border-brand-300 hover:shadow-[var(--shadow-lift)]">
                  {content}
                </Link>
              ) : (
                <article key={tool.href} aria-disabled="true" className="rounded-2xl border border-dashed border-line bg-surface/60 p-5">
                  {content}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {!filtered.length && <p className="card p-12 text-center text-sm text-muted">No tools match this search.</p>}
    </div>
  );
}
