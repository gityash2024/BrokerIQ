import { z } from 'zod';
import { GROWTH_FEATURES } from './features';

export const moduleStateSchema = z.enum(['ACTIVE', 'COMING_SOON', 'HIDDEN']);
export const modulePolicySchema = z.object({
  state: moduleStateSchema,
  roles: z.array(z.enum(['SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT', 'USER', 'MODERATOR', 'SUPPORT'])).max(6),
});
export type ModulePolicy = z.infer<typeof modulePolicySchema>;
export type ModulePolicies = Record<string, ModulePolicy>;
export interface PlatformModule {
  key: string;
  name: string;
  description: string;
  href?: string;
  routes: string[];
  api: string[];
  jobs: string[];
  defaultState: ModulePolicy['state'];
}
const core = (key: string, name: string, description: string, href: string, routes: string[], api: string[], jobs: string[] = []): PlatformModule => ({
  key,
  name,
  description,
  href,
  routes,
  api,
  jobs,
  defaultState: 'ACTIVE',
});
const future = (key: string, name: string, routes: string[], api: string[], jobs: string[] = []): PlatformModule => ({
  key,
  name,
  description: 'Upcoming feature • आने वाली सुविधा',
  routes,
  api,
  jobs,
  defaultState: 'COMING_SOON',
});
const featurePaths: Record<string, [string[], string[]]> = {
  tenant_requirements: [['/requirements'], ['/requirements']],
  slot_booking: [['/visit-slots'], ['/broker/visit-slots']],
  visit_tokens: [['/broker/tokens', '/tokens'], ['/broker/tokens']],
  locality_reviews: [['/locality-reviews'], ['/localities']],
  flatmates: [['/flatmates'], ['/flatmates']],
  rent_agreement: [['/broker/agreements', '/agreements'], ['/agreements']],
  move_in_services: [['/services'], ['/services']],
  whatsapp_bot: [[], ['/wabot']],
  photo_branding: [['/photo-branding'], ['/broker/branding']],
  visiting_card: [['/visiting-card'], ['/public/card']],
  comparison_pdf: [['/comparisons'], ['/broker/comparisons', '/public/comparisons']],
  broker_reports: [
    ['/broker/reports', '/reports'],
    ['/broker/reports', '/public/reports'],
  ],
  owner_reports: [[], ['/public/owner-report']],
  rent_tracker: [['/my-rent'], ['/me/rent']],
  inspections: [['/inspection'], ['/public/inspections']],
  fair_rent: [[], ['/public/fair-rent']],
  video_visits: [[], ['/video-visits']],
  agreement_esign: [[], ['/public/sign']],
  compare_shortlist: [['/compare'], ['/public/compare', '/public/shortlist', '/me/shortlist']],
  web_push: [[], ['/public/webpush-key']],
  referrals: [['/invite'], ['/me/referral']],
};

/** One registry drives web/native navigation, HTTP authorization and worker execution. */
export const PLATFORM_MODULES: PlatformModule[] = [
  core(
    'consumer',
    'User marketplace • ग्राहक पोर्टल',
    'Rental discovery, owner listings and customer journeys',
    '/user',
    ['/user', '/account', '/rent', '/commercial', '/property', '/localities', '/locality', '/post-property', '/brokers'],
    [
      '/listings',
      '/enquiries',
      '/chat',
      '/me/dashboard',
      '/me/saved-searches',
      '/me/enquiries',
      '/public/homepage',
      '/public/stats',
      '/public/suggest',
      '/public/seo',
      '/public/seo-combos',
      '/public/contact',
      '/brokers',
    ],
  ),
  core(
    'today',
    'Today • आज का काम',
    'Follow-ups, visits and next actions',
    '/broker',
    ['/broker/dashboard', '/broker/activity'],
    ['/broker/dashboard', '/broker/today'],
  ),
  core(
    'directory',
    'Area Directory • क्षेत्र निर्देशिका',
    'Gurugram societies, apartments and commercial projects; map and list',
    '/broker/inventory/directory',
    ['/broker/inventory/directory'],
    ['/area-directory'],
  ),
  core(
    'inventory',
    'Inventory • इन्वेंटरी',
    'Property ledger, units, contacts and source review',
    '/broker/inventory',
    ['/broker/inventory', '/broker/scanner', '/broker/listings'],
    ['/inventory', '/listings', '/ai/scan'],
    ['import.pdf'],
  ),
  core(
    'leads',
    'Leads & Requirements • लीड्स',
    'Requirements, pipeline, matches, follow-ups and visits',
    '/broker/leads',
    ['/broker/leads', '/broker/pipeline', '/broker/follow-ups', '/broker/visits'],
    ['/leads', '/follow-ups', '/visits', '/requirements/broker', '/broker-requirements'],
    ['lead.score'],
  ),
  core(
    'inbox',
    'Inbox • इनबॉक्स',
    'WhatsApp and shared text, images or chat exports',
    '/broker/inbox',
    ['/broker/inbox', '/broker/imports'],
    ['/whatsapp', '/broker/whatsapp', '/webhooks/whatsapp', '/chat', '/imports'],
    ['import.extract', 'whatsapp.event'],
  ),
  core(
    'automation',
    'Automation & Housing • ऑटोमेशन',
    'Portal lead sync, rules and execution history',
    '/broker/automations',
    ['/broker/automations', '/broker/connectors'],
    ['/automations', '/broker/connectors', '/broker/portal-pack', '/broker/integrations', '/webhooks/leads', '/webhooks/meta-leads'],
    ['automation.action', 'connector.'],
  ),
  future(
    'deals',
    'Deals & invoices',
    ['/broker/deals', '/broker/invoices', '/invoices'],
    ['/deals', '/invoices', '/broker/invoices', '/broker/payment-settings', '/public/invoices'],
  ),
  future('team', 'Team & agents', ['/broker/team', '/broker/invite-brokers'], ['/broker/team']),
  future('billing', 'Billing & subscriptions', ['/broker/billing', '/boost'], ['/billing', '/subscriptions', '/payments', '/boosts']),
  future(
    'reports',
    'Analytics & reports',
    ['/broker/analytics', '/broker/reports'],
    ['/broker/analytics', '/broker/reports', '/broker/weekly-report', '/broker/rank'],
  ),
  future('owners', 'Owners & leases', ['/broker/owners', '/owners'], ['/owners', '/leases', '/broker/owners', '/broker/tenancies', '/broker/rent-payments']),
  future('assistant', 'AI assistant', ['/assistant'], ['/assistant', '/ai']),
  future(
    'marketplace',
    'Future marketplace extensions',
    [
      '/account',
      '/buy',
      '/rent',
      '/plots',
      '/commercial',
      '/compare',
      '/tools',
      '/projects',
      '/localities',
      '/property',
      '/for-brokers',
      '/post-property',
      '/search',
    ],
    ['/public', '/brokers', '/enquiries', '/requirements', '/services', '/community', '/trust', '/rentals', '/referrals', '/growth', '/kyc'],
  ),
  future('campaigns', 'Campaigns', ['/broker/campaigns', '/campaigns'], ['/campaigns', '/broker/campaigns'], ['campaign.batch']),
  future('cobroking', 'Co-broking network', ['/broker/network', '/network'], ['/cobroking']),
  future('social_autopost', 'Social publishing', ['/social'], ['/social'], ['social.post']),
  future('legacy', 'Other future workflows', [], []),
  ...GROWTH_FEATURES.filter((f) => !['campaigns', 'cobroking', 'social_autopost'].includes(f.key)).map((f): PlatformModule => ({
    key: f.key,
    name: f.name,
    description: f.description,
    routes: featurePaths[f.key]?.[0] ?? [],
    api: featurePaths[f.key]?.[1] ?? [],
    jobs: [],
    defaultState: ['tenant_requirements', 'slot_booking'].includes(f.key) ? 'ACTIVE' : 'COMING_SOON',
  })),
];

export const defaultModulePolicies = (): ModulePolicies =>
  Object.fromEntries(
    PLATFORM_MODULES.map((m) => [
      m.key,
      {
        state: m.defaultState,
        roles: [
          'SUPER_ADMIN',
          'BROKER_ADMIN',
          ...(['consumer', 'tenant_requirements', 'slot_booking'].includes(m.key) ? ['USER' as const] : []),
        ] as ModulePolicy['roles'],
      },
    ]),
  );
const prefixMatches = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/') || (prefix.endsWith('.') && path.startsWith(prefix));
export function moduleForPath(path: string, surface: 'web' | 'api' | 'job' = 'web'): string | null {
  const clean = path.split('?')[0].replace(/\/$/, '') || '/';
  if (surface === 'web' && /^\/user\/account\/(flatmates|rent|agreements|invite)(\/|$)/.test(clean))
    return ({ flatmates: 'flatmates', rent: 'rent_tracker', agreements: 'rent_agreement', invite: 'referrals' } as Record<string, string>)[clean.split('/')[3]];
  if (surface === 'web' && clean === '/broker') return 'today';
  if (
    surface === 'web' &&
    [
      '/login',
      '/register',
      '/signup',
      '/forgot-password',
      '/invite',
      '/broker/settings',
      '/broker/upcoming',
      '/broker/onboarding',
      '/broker/notifications',
      '/broker/privacy',
      '/broker/feedback',
    ].some((p) => prefixMatches(clean, p))
  )
    return null;
  if (surface === 'web' && (clean === '/' || prefixMatches(clean, '/admin'))) return null;
  if (
    surface === 'api' &&
    [
      '/auth',
      '/health',
      '/admin',
      '/media',
      '/invites',
      '/broker-invites/check',
      '/broker-invites/status',
      '/broker/profile',
      '/broker/onboarding',
      '/broker/business-hours',
      '/broker/webhook-key',
      '/public/config',
      '/public/taxonomies',
      '/public/localities',
      '/public/client-errors',
      '/public/pages',
      '/public/faqs',
      '/feedback',
    ].some((p) => prefixMatches(clean, p))
  )
    return null;
  if (
    surface === 'api' &&
    (clean === '/me' || ['/me/push-tokens', '/me/notifications', '/me/uploads', '/me/privacy', '/me/consent'].some((p) => prefixMatches(clean, p)))
  )
    return null;
  if (surface === 'api' && (clean === '/me/visits' || clean.startsWith('/me/visits/') || /^\/listings\/[^/]+\/(slots|book-visit)$/.test(clean)))
    return 'slot_booking';
  if (surface === 'api' && (clean === '/chat' || clean.startsWith('/chat/'))) return 'consumer';
  if (surface === 'api' && clean.startsWith('/listings/ai/')) return 'assistant';
  if (surface === 'api' && (clean === '/listings' || clean.startsWith('/listings/'))) return 'consumer';
  if (surface === 'web' && (clean === '/user' || clean.startsWith('/user/'))) return 'consumer';
  const field = surface === 'api' ? 'api' : surface === 'job' ? 'jobs' : 'routes';
  const candidates = PLATFORM_MODULES.flatMap((m) => m[field].filter((p) => prefixMatches(clean, p)).map((p) => ({ key: m.key, length: p.length })));
  return candidates.sort((a, b) => b.length - a.length)[0]?.key ?? 'legacy';
}
export function moduleAllowed(policies: ModulePolicies | undefined, key: string, role: string) {
  const policy = policies?.[key] ?? defaultModulePolicies()[key];
  return (
    !!policy && policy.state === 'ACTIVE' && policy.roles.includes((role === 'PUBLIC' && key === 'consumer' ? 'USER' : role) as ModulePolicy['roles'][number])
  );
}

/** Presentation only: upcoming roadmap items are visible to every role, never authorized by this list. */
export function catalogModules(policies: ModulePolicies | undefined, role: string) {
  const defaults = defaultModulePolicies();
  return PLATFORM_MODULES.filter((module) => module.key !== 'legacy').flatMap<PlatformModule & { state: 'COMING_SOON' | 'ACTIVE' }>((module) => {
    const policy = policies?.[module.key] ?? defaults[module.key];
    if (policy.state === 'COMING_SOON') return [{ ...module, state: 'COMING_SOON' as const }];
    return moduleAllowed(policies, module.key, role) ? [{ ...module, state: 'ACTIVE' as const }] : [];
  });
}
