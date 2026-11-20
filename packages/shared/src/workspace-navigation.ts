import { hasDelegatedAccess } from './delegated-access';
import { catalogModules, defaultModulePolicies, moduleAllowed, moduleForPath, type ModulePolicies } from './modules';

/** Discovery/drill-down guard; server authorization remains authoritative. */
export function workspaceHrefAllowed(policies: ModulePolicies | undefined, role: string, href: string) {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  const path = href.split('?')[0];
  if (path.startsWith('/admin')) return role === 'SUPER_ADMIN';
  if (path.startsWith('/broker')) {
    if (!['BROKER_ADMIN', 'BROKER_AGENT'].includes(role)) return false;
    if (role === 'BROKER_AGENT' && (path === '/broker/publications' || (/^\/broker\/team(\/|$)/.test(path) && !path.startsWith('/broker/team/time-logging'))))
      return false;
  }
  const key = moduleForPath(path);
  return key === null || moduleAllowed(policies, key, role);
}

/** Unknown destinations stay inert rather than opening an unrelated customer screen. */
export function nativeDashboardPath(web: string) {
  const [path, query] = web.split('?');
  if (path === '/broker/activity' || path === '/user/account/activity')
    return '/dashboard-records?' + (path.startsWith('/user/') ? 'view=user&' : '') + (query ?? '');
  const routes: Record<string, string> = {
    '/broker/inventory': '/(broker)/inventory',
    '/broker/imports': '/capture',
    '/broker/leads': '/(broker)/leads',
    '/broker/leads/requirements': '/requirements',
    '/broker/follow-ups': '/follow-ups',
    '/broker/visits': '/visits',
    '/broker/deals': '/deals',
    '/broker/invoices': '/invoices',
    '/broker/team/time-logging': '/time-logging',
    '/user/account/saved': '/(user)/saved',
    '/user/account/searches': '/(user)/saved',
    '/user/account/enquiries': '/enquiries',
    '/user/account/visits': '/my-visits',
  };
  return routes[path] ? routes[path] + (query ? '?' + query : '') : null;
}

export interface WorkspaceLink {
  label: string;
  href: string;
  nativeHref?: string;
  module: string;
  adminOnly?: boolean;
}
export interface WorkspaceGroup {
  key: string;
  label: string;
  links: WorkspaceLink[];
}

/** Navigation is derived from authorization; it never enables a module or an action. */
export function brokerWorkspaceGroups(policies: ModulePolicies | undefined, role: string, discover = false): WorkspaceGroup[] {
  if (!['BROKER_ADMIN', 'BROKER_AGENT'].includes(role)) return [];
  const groups: WorkspaceGroup[] = [
    { key: 'today', label: "Today's Focus", links: [{ label: "Today's Focus", href: '/broker', nativeHref: '/dashboard', module: 'today' }] },
    {
      key: 'inventory',
      label: 'Inventory',
      links: [
        { label: 'Available Inventory', href: '/broker/inventory', nativeHref: '/inventory', module: 'inventory' },
        { label: 'Survey', href: '/broker/inventory?survey=1', nativeHref: '/(broker)/inventory?survey=1', module: 'inventory' },
        { label: 'All Inventory', href: '/broker/inventory/data', nativeHref: '/inventory?view=ledger', module: 'inventory' },
        { label: 'Publication Review', href: '/broker/publications', nativeHref: '/publication-reviews', module: 'inventory', adminOnly: true },
        { label: 'Publish Listing', href: '/broker/listings', nativeHref: '/inventory-listings', module: 'consumer' },
        { label: 'Scan / WhatsApp Import', href: '/broker/imports?target=INVENTORY', nativeHref: '/capture?target=INVENTORY', module: 'inbox' },
      ],
    },
    {
      key: 'leads',
      label: 'Leads',
      links: [
        { label: 'Contacts & leads', href: '/broker/leads', nativeHref: '/leads', module: 'leads' },
        { label: 'Requirements', href: '/broker/leads/requirements', nativeHref: '/requirements', module: 'leads' },
        { label: 'Pipeline', href: '/broker/pipeline', nativeHref: '/pipeline', module: 'leads' },
        { label: 'Follow-ups', href: '/broker/follow-ups', nativeHref: '/follow-ups', module: 'leads' },
        { label: 'Site visits', href: '/broker/visits', nativeHref: '/visits', module: 'leads' },
        { label: 'Property Maps', href: '/broker/visits/maps', nativeHref: '/visits-maps', module: 'leads' },
      ],
    },
    { key: 'inbox', label: 'Inbox', links: [{ label: 'Conversations', href: '/broker/inbox', nativeHref: '/inbox', module: 'inbox' }] },
    {
      key: 'capture',
      label: 'Capture & imports',
      links: [
        { label: 'Scan property or requirement', href: '/broker/scanner?target=REQUIREMENT', nativeHref: '/scanner?target=REQUIREMENT', module: 'inventory' },
        { label: 'WhatsApp export & paste', href: '/broker/imports?target=REQUIREMENT', nativeHref: '/capture?target=REQUIREMENT', module: 'inbox' },
        { label: 'Source review', href: '/broker/imports', nativeHref: '/capture', module: 'inbox' },
        { label: 'Public listing drafts', href: '/broker/scanner/listing-drafts', nativeHref: '/listing-scanner', module: 'inventory', adminOnly: true },
      ],
    },
    { key: 'kyc', label: 'KYC', links: [{ label: 'KYC', href: '/broker/kyc', nativeHref: '/(broker)/kyc', module: 'kyc' }] },
    {
      key: 'team',
      label: role === 'BROKER_AGENT' ? 'My work' : 'Team & Agents',
      links: [
        { label: 'Team Members', href: '/broker/team', nativeHref: '/team', module: 'team', adminOnly: true },
        { label: 'Time Logging', href: '/broker/team/time-logging', nativeHref: '/time-logging', module: 'time_logging' },
        { label: 'Leaderboard', href: '/broker/team/leaderboard', nativeHref: '/leaderboard', module: 'team', adminOnly: true },
        ...(role === 'BROKER_AGENT' ? [{ label: 'My performance', href: '/broker/performance', nativeHref: '/performance', module: 'today' }] : []),
      ],
    },
    {
      key: 'automation',
      label: 'Automation',
      links: [
        { label: 'Rules & execution history', href: '/broker/automations', nativeHref: '/automations', module: 'automation', adminOnly: true },
        { label: 'Housing & connectors', href: '/broker/connectors', nativeHref: '/connectors', module: 'automation', adminOnly: true },
      ],
    },
    {
      key: 'deals',
      label: 'Deals & invoices',
      links: [
        { label: 'Deals', href: '/broker/deals', nativeHref: '/deals', module: 'deals', adminOnly: true },
        { label: 'Invoices', href: '/broker/invoices', nativeHref: '/invoices', module: 'deals', adminOnly: true },
      ],
    },
  ];
  const visible = groups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        (link) =>
          (!link.adminOnly || discover || role === 'BROKER_ADMIN') &&
          (moduleAllowed(policies, link.module, role) || (discover && moduleAllowed(policies, link.module, 'BROKER_ADMIN'))),
      ),
    }))
    .filter((group) => group.links.length);
  const represented = new Set(visible.flatMap((group) => group.links.map((link) => link.module)));
  const additional = catalogModules(policies, role).filter(
    (item) => item.state === 'ACTIVE' && !represented.has(item.key) && item.key !== 'directory' && item.href?.startsWith('/broker/'),
  );
  if (additional.length)
    visible.push({ key: 'tools', label: 'Other tools', links: additional.map((item) => ({ label: item.name, href: item.href!, module: item.key })) });
  return visible;
}

export function brokerUpcomingModules(policies: ModulePolicies | undefined, role: string) {
  if (!['BROKER_ADMIN', 'BROKER_AGENT'].includes(role)) return [];
  const defaults = defaultModulePolicies();
  return catalogModules(policies, role).filter(
    (item) => item.state === 'COMING_SOON' && (policies?.[item.key] ?? defaults[item.key]).roles.includes(role as 'BROKER_ADMIN' | 'BROKER_AGENT'),
  );
}

/** Discoverable controls retain their authorization and give a visible access explanation. */
export function workspaceLinkAccess(
  user: { role: string; delegatedPermissions?: readonly string[] } | null | undefined,
  policies: ModulePolicies | undefined,
  link: WorkspaceLink,
): string | undefined {
  if (!user) return 'Sign in to use this workflow.';
  const role = user.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : user.role;
  if (!moduleAllowed(policies, link.module, role)) return 'This workflow is not enabled for your account. Contact your Broker Admin.';
  if (link.adminOnly && user.role === 'BROKER_AGENT') return 'Broker Admin access is required for this workflow.';
  if (link.href === '/broker/kyc') return undefined;
  if (!hasDelegatedAccess(user, link.module, 'view')) return 'Ask your Broker Admin for access to this workflow.';
  const action = link.href === '/broker/publications' ? 'approve' : link.href === '/broker/connectors' ? 'connection_status' : undefined;
  if (action && !hasDelegatedAccess(user, link.module, action)) return 'Ask your Broker Admin for permission to use this workflow.';
  if (link.href === '/broker/imports?target=INVENTORY' && (!hasDelegatedAccess(user, 'inventory', 'create') || !hasDelegatedAccess(user, 'inbox', 'create')))
    return 'Inventory create and capture access are required for this workflow.';
  return undefined;
}
