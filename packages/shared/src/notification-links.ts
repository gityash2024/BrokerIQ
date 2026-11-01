import { type ModulePolicies } from './modules';
import { brokerWorkspaceGroups, nativeDashboardPath, workspaceHrefAllowed } from './workspace-navigation';

const publicOrigin = 'https://brokeriq.mymultimeds.com';
const id = '[A-Za-z0-9_-]+';

/** Reject protocol-relative URLs, encoded separators/control characters and unexpected schemes. */
export function notificationPath(value: string | null | undefined, origin = publicOrigin): string | null {
  if (!value || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value) || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return null;
  try {
    if (value.startsWith('//')) return null;
    const url = new URL(value, origin);
    if (url.username || url.password || ![new URL(origin).origin, publicOrigin].includes(url.origin)) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

/** Native OS intents also use brokeriq://host/path, whereas Expo routes use /host/path. */
export function normalizeNativeIntent(value: string): string {
  try {
    if (value.startsWith('brokeriq:')) {
      const url = new URL(value);
      if (url.protocol !== 'brokeriq:' || url.username || url.password) return '/';
      if (url.hostname === 'expo-sharing' && (!url.pathname || url.pathname === '/')) return '/handle-share';
      value = '/' + [url.hostname, url.pathname.replace(/^\//, '')].filter(Boolean).join('/') + url.search;
    }
    const path = notificationPath(value);
    if (!path) return '/';
    if (path === '/') return '/';
    if (path === '/expo-sharing') return '/handle-share';
    if (/^\/notification(?:\?|$)/.test(path)) return path.replace('/notification', '/notifications');
    if (/^\/user\/property\/[A-Za-z0-9_-]+(?:\?|$)/.test(path)) return path.replace('/user/property/', '/property/');
    if (path === '/user' || path === '/user/') return '/(user)/home';
    if (/^\/user\/search(?:\?|$)/.test(path)) return path.replace('/user/search', '/(user)/search');
    if (path === '/broker' || path === '/broker/') return '/(broker)/dashboard';
    if (
      /^\/broker(?:\?|$)/.test(path) ||
      /^\/broker\/(?:leads|inventory|inbox|kyc|settings|publications|team|listings|imports|follow-ups|visits|pipeline|deals|invoices|activity|performance)(?:\/|\?|$)/.test(
        path,
      )
    )
      return notificationDestination(path, 'BROKER_ADMIN', true) ?? '/notifications';
    if (/^\/(?:\((?:broker|user)\)\/)?(?:home|search|saved|messages|profile|dashboard|inventory|leads|inbox|kyc|automations)(?:\?|$)/.test(path)) return path;
    if (/^\/(?:property|locality|broker|lead|inventory|chat|wa|import-review|project)\/[A-Za-z0-9_-]+(?:\?|$)/.test(path)) return path;
    const screens = new Set([
      'login',
      'onboarding',
      'data-consent',
      'handle-share',
      'broker-onboarding',
      'broker-settings',
      'agent-kyc',
      'add-lead',
      'requirements',
      'requirement-edit',
      'follow-ups',
      'visits',
      'notifications',
      'capture',
      'scanner',
      'listing-scanner',
      'drafts',
      'feedback',
      'enquiries',
      'my-visits',
      'my-listings',
      'post-property',
      'publish-rental',
      'inventory-edit',
      'publication-reviews',
      'time-logging',
      'team',
      'performance',
      'leaderboard',
      'connectors',
      'pipeline',
      'area-directory',
      'edit-profile',
      'privacy',
      'invite',
      'product-tools',
      'dashboard-records',
      'deals',
      'invoices',
      'tokens',
      'network',
      'owners',
      'analytics',
      'billing',
      'flatmates',
      'my-rent',
    ]);
    return screens.has(path.slice(1).split('?')[0]) ? path : '/';
  } catch {
    return '/';
  }
}

export function notificationInbox(role: string, native = false) {
  return native
    ? '/notifications'
    : role === 'SUPER_ADMIN'
      ? '/admin/notifications'
      : ['BROKER_ADMIN', 'BROKER_AGENT'].includes(role)
        ? '/broker/notifications'
        : '/user/account/notifications';
}

/** A discovery guard only: every target API must still authorize the current record owner. */
export function notificationDestination(
  value: string | null | undefined,
  role: string,
  native: boolean,
  policies?: ModulePolicies,
  origin = publicOrigin,
): string | null {
  let path = notificationPath(value, origin);
  if (!path) return null;
  // A legacy producer used a native inventory URL in website notifications.
  const legacyInventory = path.match(new RegExp(`^/inventory/(${id})$`));
  if (legacyInventory) path = `/broker/inventory?item=${legacyInventory[1]}`;
  if (!workspaceHrefAllowed(policies, role, path)) return null;
  const [base, query] = path.split('?');
  const suffix = query ? '?' + query : '';
  const match = (pattern: string) => base.match(new RegExp(pattern))?.[1];
  const known =
    /^\/(?:broker(?:\/(?:inventory|imports|leads|pipeline|follow-ups|visits|inbox|kyc|settings|team|publications|listings|deals|invoices|tokens|network|owners|analytics|billing|activity|performance)(?:\/[A-Za-z0-9_-]+)*)?|admin\/(?:notifications|moderation|kyc|feedback|services|locality-reviews|enquiries|support)|(?:user\/)?account(?:\/(?:notifications|messages|profile|enquiries|listings|visits|rent|flatmates|invite|saved|searches|activity))?|(?:user\/)?property\/[A-Za-z0-9_-]+|feedback(?:\/[A-Za-z0-9_-]+)?)$/.test(
      base,
    );
  if (!known) return null;
  if (!native) return path;
  const inventory = new URLSearchParams(query).get('item');
  if (base === '/broker/inventory' && inventory && new RegExp(`^${id}$`).test(inventory)) return '/inventory/' + inventory;
  // Specific workspace routes precede /leads/:id (requirements is not a lead id).
  const dashboard = nativeDashboardPath(path);
  if (dashboard) return dashboard;
  if (base === '/broker/inventory') return '/(broker)/inventory' + suffix;
  const lead = match(`^/broker/leads/(${id})$`);
  if (lead) return '/lead/' + lead + suffix;
  const property = match(`^/(?:user/)?property/(${id})$`);
  if (property) return '/property/' + property + suffix;
  if (base === '/broker/inbox' || base === '/account/messages' || base === '/user/account/messages') {
    const params = new URLSearchParams(query);
    const conversation = params.get('c');
    if (conversation && new RegExp(`^${id}$`).test(conversation))
      return (base.includes('/broker/') && params.get('channel') !== 'CHAT' ? '/wa/' : '/chat/') + conversation;
    return base.includes('/broker/') ? '/(broker)/inbox' : '/(user)/messages';
  }
  const workspace = brokerWorkspaceGroups(policies, role)
    .flatMap((g) => g.links)
    .find((l) => l.href === base);
  if (workspace?.nativeHref) return workspace.nativeHref + suffix;
  const routes: Record<string, string> = {
    '/broker': '/(broker)/dashboard',
    '/broker/settings': '/broker-settings',
    '/broker/tokens': '/tokens',
    '/account/profile': '/edit-profile',
    '/user/account/profile': '/edit-profile',
    '/account/enquiries': '/enquiries',
    '/user/account/enquiries': '/enquiries',
    '/account/listings': '/my-listings',
    '/user/account/listings': '/my-listings',
    '/account/visits': '/my-visits',
    '/user/account/visits': '/my-visits',
    '/account/rent': '/my-rent',
    '/account/flatmates': '/flatmates',
    '/account/invite': '/invite',
    '/broker/network': '/network',
    '/broker/owners': '/owners',
    '/broker/analytics': '/analytics',
    '/broker/billing': '/billing',
    '/feedback': '/feedback',
  };
  if (routes[base]) return routes[base] + suffix;
  const feedback = match(`^/feedback/(${id})$`);
  if (feedback) return '/feedback?record=' + feedback;
  // Unsupported native destinations remain reviewable in the inbox, never an unmatched route.
  return null;
}
