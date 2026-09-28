import type { Role } from '@prisma/client';
import { formatPriceShort, moveInCost, rentAffordability } from '@brokeriq/shared';

/**
 * AI-assistant tools. Each one maps to an existing API endpoint and is executed **as the
 * signed-in user** (their own bearer token), so RBAC, org scoping, validation and the
 * approval workflow are exactly what the app enforces — the assistant can never do more
 * than the user could do themselves. `write` tools always need an explicit confirmation.
 * Consented location/contacts data is deliberately not exposed to any tool.
 */
export type Call = { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; body?: unknown };
export interface ToolCtx {
  call: (c: Call) => Promise<any>;
  me: () => Promise<any>;
}
export interface Tool {
  name: string;
  description: string;
  roles: Role[];
  write?: boolean;
  parameters: Record<string, unknown>;
  /** Short human summary shown on the confirmation card. */
  summary?: (a: any) => string;
  run: (a: any, ctx: ToolCtx) => Promise<unknown>;
}

const ALL: Role[] = ['USER', 'BROKER_ADMIN', 'BROKER_AGENT', 'SUPER_ADMIN'];
const BROKERS: Role[] = ['BROKER_ADMIN', 'BROKER_AGENT'];
const LISTERS: Role[] = ['USER', 'BROKER_ADMIN', 'BROKER_AGENT'];
const id = (v: unknown) => encodeURIComponent(String(v ?? '').slice(0, 80));
const qs = (o: Record<string, unknown>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });
const num = (description: string) => ({ type: 'number', description });

/** Compact listing shape for the model and the UI cards. */
export const slimListing = (l: any) => ({
  id: l.id,
  slug: l.slug,
  title: l.title,
  rent: l.price,
  rentText: l.price ? `${formatPriceShort(l.price)}/month` : null,
  locality: l.locality?.name,
  bedrooms: l.bedrooms,
  furnishing: l.furnishing,
  deposit: l.securityDeposit,
  brokerage: l.brokerageType,
  status: l.status,
  url: l.slug ? `/property/${l.slug}` : undefined,
});
const slimLead = (l: any) => ({ id: l.id, name: l.name, phone: l.phone, stage: l.stage, temperature: l.temperature, source: l.source, nextFollowUpAt: l.nextFollowUpAt, assignedTo: l.assignedTo?.name, url: `/broker/leads/${l.id}` });

export const TOOLS: Tool[] = [
  // ------------------------------------------------------------------ marketplace (everyone)
  {
    name: 'search_rentals',
    description: 'Search live rent listings in Gurgaon. Use locality slugs from list_localities when the user names an area.',
    roles: ALL,
    parameters: obj({
      q: str('free text: sector, society or project name'),
      localities: str('comma separated locality slugs, e.g. "sector-65-gurgaon"'),
      bedrooms: str('comma separated BHK, e.g. "2,3" or "4+"'),
      maxRent: num('maximum monthly rent in INR'),
      minRent: num('minimum monthly rent in INR'),
      furnishing: str('UNFURNISHED | SEMI_FURNISHED | FULLY_FURNISHED'),
      types: str('comma separated: APARTMENT, BUILDER_FLOOR, INDEPENDENT_HOUSE, VILLA, STUDIO, PG, OFFICE, SHOP …'),
    }),
    run: async (a, { call }) => {
      const r = await call({ method: 'GET', path: `/listings${qs({ q: a.q, localities: a.localities, bedrooms: a.bedrooms, maxPrice: a.maxRent, minPrice: a.minRent, furnishing: a.furnishing, types: a.types, pageSize: 8 })}` });
      return { total: r.total, listings: (r.items ?? []).map(slimListing) };
    },
  },
  {
    name: 'list_localities',
    description: 'Find Gurgaon localities/sectors (name → slug, average 2 BHK rent, live rentals).',
    roles: ALL,
    parameters: obj({ q: str('part of the locality / sector name') }),
    run: async (a, { call }) => {
      const all = (await call({ method: 'GET', path: '/public/localities' })) as any[];
      const q = String(a.q ?? '').toLowerCase();
      return all
        .filter((l) => !q || l.name.toLowerCase().includes(q) || (l.zone ?? '').toLowerCase().includes(q))
        .slice(0, 12)
        .map((l) => ({ name: l.name, slug: l.slug, zone: l.zone, avgRent2Bhk: l.avgRent, liveRentals: l.listingsRent }));
    },
  },
  {
    name: 'get_listing',
    description: 'Full details of one listing (by slug or id).',
    roles: ALL,
    parameters: obj({ slugOrId: str('listing slug or id') }, ['slugOrId']),
    run: async (a, { call }) => {
      const l = await call({ method: 'GET', path: `/listings/${id(a.slugOrId)}` });
      return { ...slimListing(l), description: l.description?.slice(0, 600), maintenance: l.maintenance, area: l.superArea ?? l.carpetArea, floor: l.floor, amenities: l.amenities, broker: l.organization?.name };
    },
  },
  {
    name: 'rent_budget',
    description: 'How much monthly rent the user can afford for a take-home income.',
    roles: ALL,
    parameters: obj({ income: num('monthly take-home income INR'), existingEmis: num('existing EMIs per month INR') }, ['income']),
    run: async (a) => rentAffordability(Number(a.income), Number(a.existingEmis ?? 0)),
  },
  {
    name: 'move_in_cost',
    description: 'Upfront cash needed to move into a rental (advance + deposit + brokerage + maintenance).',
    roles: ALL,
    parameters: obj({ rent: num('monthly rent'), depositMonths: num('deposit in months of rent'), brokerage: str('NONE | DAYS_15 | MONTH_1 | FIXED'), brokerageFixed: num('fixed brokerage INR'), maintenance: num('monthly maintenance') }, ['rent']),
    run: async (a) => moveInCost({ rent: Number(a.rent), depositMonths: Number(a.depositMonths ?? 2), brokerage: a.brokerage ?? 'MONTH_1', brokerageFixed: a.brokerageFixed, maintenance: a.maintenance }),
  },
  {
    name: 'my_notifications',
    description: "The user's latest notifications.",
    roles: ALL,
    parameters: obj({}),
    run: async (_a, { call }) => {
      const r = await call({ method: 'GET', path: '/me/notifications' });
      return { unread: r.unreadCount, items: (r.items ?? []).slice(0, 10).map((n: any) => ({ title: n.title, body: n.body, at: n.createdAt, read: !!n.readAt })) };
    },
  },
  // ------------------------------------------------------------------ renters / owners
  {
    name: 'my_saved_listings',
    description: 'Listings the user has saved (shortlist).',
    roles: ['USER'],
    parameters: obj({}),
    run: async (_a, { call }) => ((await call({ method: 'GET', path: '/listings/saved' })) as any[]).slice(0, 12).map((s: any) => slimListing(s.listing ?? s)),
  },
  {
    name: 'save_listing',
    description: 'Save (shortlist) or unsave a listing for the user.',
    roles: ['USER'],
    write: true,
    parameters: obj({ listingId: str('listing id'), save: { type: 'boolean', description: 'true = save, false = remove' } }, ['listingId']),
    summary: (a) => (a.save === false ? 'Listing को saved से हटाना' : 'Listing को saved में जोड़ना'),
    run: async (a, { call }) => call({ method: a.save === false ? 'DELETE' : 'POST', path: `/listings/${id(a.listingId)}/save` }),
  },
  {
    name: 'send_enquiry',
    description: "Send an enquiry / site-visit request to the listing's broker or owner on the user's behalf.",
    roles: ['USER'],
    write: true,
    parameters: obj({ listingId: str('listing id'), message: str('message to the broker/owner'), wantsVisit: { type: 'boolean', description: 'user wants a site visit' } }, ['listingId']),
    summary: (a) => `Enquiry भेजना${a.wantsVisit ? ' (site visit के साथ)' : ''}: "${String(a.message ?? '').slice(0, 80)}"`,
    run: async (a, { call, me }) => {
      const u = await me();
      if (!u.phone) throw new Error('Enquiry के लिए profile में mobile नंबर जोड़ें');
      return call({ method: 'POST', path: '/enquiries', body: { listingId: a.listingId, name: u.name, phone: u.phone, email: u.email, message: a.message ?? 'Interested in this property.', wantsVisit: !!a.wantsVisit } });
    },
  },
  {
    name: 'my_enquiries',
    description: 'Enquiries the user has sent.',
    roles: ['USER'],
    parameters: obj({}),
    run: async (_a, { call }) => ((await call({ method: 'GET', path: '/enquiries/sent' })) as any[]).slice(0, 10).map((e: any) => ({ id: e.id, listing: e.listing?.title, status: e.status, at: e.createdAt })),
  },
  {
    name: 'my_listings',
    description: "The user's / firm's own listings with status (DRAFT, PENDING_REVIEW, ACTIVE, REJECTED …).",
    roles: LISTERS,
    parameters: obj({ status: str('optional status filter'), search: str('optional text') }),
    run: async (a, { call }) => {
      const r = await call({ method: 'GET', path: `/listings/mine${qs({ status: a.status, search: a.search, pageSize: 15 })}` });
      return { total: r.total, statusCounts: r.statusCounts, listings: (r.items ?? []).map((l: any) => ({ ...slimListing(l), rejectionReason: l.rejectionReason })) };
    },
  },
  {
    name: 'create_rent_listing',
    description: 'Create a rent listing. submit=true sends it for admin approval (it goes live only after approval); submit=false keeps it as a draft. Ask for locality, property type and rent if missing.',
    roles: LISTERS,
    write: true,
    parameters: obj(
      {
        propertyType: str('APARTMENT | BUILDER_FLOOR | INDEPENDENT_HOUSE | VILLA | STUDIO | SERVICE_APARTMENT | PG | OFFICE | COWORKING | SHOP | SHOWROOM | WAREHOUSE'),
        localityId: str('locality id — look it up with list_localities first (use its slug to search if unsure)'),
        localitySlug: str('locality slug if the id is unknown'),
        rent: num('monthly rent INR'),
        bedrooms: num('BHK'),
        furnishing: str('UNFURNISHED | SEMI_FURNISHED | FULLY_FURNISHED'),
        securityDeposit: num('deposit INR'),
        brokerageType: str('NONE | DAYS_15 | MONTH_1 | FIXED'),
        superArea: num('area in sq.ft'),
        title: str('optional title'),
        description: str('optional description'),
        submit: { type: 'boolean', description: 'true = send for admin approval, false = save draft' },
      },
      ['propertyType', 'rent'],
    ),
    summary: (a) => `${a.bedrooms ? `${a.bedrooms} BHK ` : ''}${String(a.propertyType ?? '').replace(/_/g, ' ').toLowerCase()} — ${a.rent ? formatPriceShort(Number(a.rent)) : '?'}/month · ${a.submit === false ? 'draft' : 'admin approval के लिए'}`,
    run: async (a, { call }) => {
      let localityId = a.localityId;
      if (!localityId && a.localitySlug) {
        const loc = ((await call({ method: 'GET', path: '/public/localities' })) as any[]).find((l) => l.slug === a.localitySlug);
        localityId = loc?.id;
      }
      if (!localityId) throw new Error('Locality बताइए');
      const l = await call({
        method: 'POST',
        path: '/listings',
        body: { purpose: 'RENT', propertyType: a.propertyType, localityId, price: Number(a.rent), bedrooms: a.bedrooms ?? null, furnishing: a.furnishing ?? null, securityDeposit: a.securityDeposit ?? null, brokerageType: a.brokerageType ?? null, superArea: a.superArea ?? null, title: a.title, description: a.description ?? null, photos: [], submit: a.submit !== false },
      });
      return { id: l.id, status: l.status, title: l.title, note: l.status === 'PENDING_REVIEW' ? 'Admin approval के बाद live होगी; photos app/website से जोड़ें' : 'Draft saved' };
    },
  },
  // ------------------------------------------------------------------ brokers (CRM)
  {
    name: 'broker_dashboard',
    description: "Broker's KPIs: new leads today, overdue follow-ups, unassigned leads, pipeline, commission.",
    roles: BROKERS,
    parameters: obj({}),
    run: async (_a, { call }) => {
      const d = await call({ method: 'GET', path: '/broker/dashboard' });
      return { kpis: d.kpis, pipeline: d.pipeline, recentLeads: (d.recentLeads ?? []).slice(0, 5).map(slimLead) };
    },
  },
  {
    name: 'search_leads',
    description: 'Find CRM leads by name/phone, stage or view.',
    roles: BROKERS,
    parameters: obj({ q: str('name or phone'), stage: str('NEW | CONTACTED | INTERESTED | SITE_VISIT | NEGOTIATION | WON | LOST'), view: str('new | due_today | overdue | unassigned | mine | hot') }),
    run: async (a, { call }) => {
      const r = await call({ method: 'GET', path: `/leads${qs({ q: a.q, stage: a.stage, view: a.view, pageSize: 10 })}` });
      return { total: r.total, leads: (r.items ?? []).map(slimLead) };
    },
  },
  {
    name: 'get_lead',
    description: 'Details of one lead: requirement, timeline, follow-ups.',
    roles: BROKERS,
    parameters: obj({ id: str('lead id') }, ['id']),
    run: async (a, { call }) => {
      const l = await call({ method: 'GET', path: `/leads/${id(a.id)}` });
      return { ...slimLead(l), email: l.email, requirement: l.requirement, notes: l.notes, activities: (l.activities ?? []).slice(0, 8).map((x: any) => ({ type: x.type, content: x.content?.slice(0, 200), at: x.createdAt })), followUps: (l.followUps ?? []).slice(0, 5) };
    },
  },
  {
    name: 'lead_matches',
    description: 'Rent listings that match a lead’s requirement.',
    roles: BROKERS,
    parameters: obj({ id: str('lead id') }, ['id']),
    run: async (a, { call }) => ((await call({ method: 'GET', path: `/leads/${id(a.id)}/matches` })) as any[]).slice(0, 8).map(slimListing),
  },
  {
    name: 'create_lead',
    description: 'Add a new lead to the CRM.',
    roles: BROKERS,
    write: true,
    parameters: obj({ name: str('lead name'), phone: str('10-digit mobile'), notes: str('notes'), temperature: str('HOT | WARM | COLD'), bedrooms: num('required BHK'), maxRent: num('max monthly rent'), localities: str('comma separated locality ids') }, ['name', 'phone']),
    summary: (a) => `नई lead: ${a.name} (${a.phone})`,
    run: async (a, { call }) =>
      call({
        method: 'POST',
        path: '/leads',
        body: { name: a.name, phone: a.phone, notes: a.notes ?? null, temperature: a.temperature ?? null, source: 'MANUAL', requirement: { purpose: 'RENT', bedrooms: a.bedrooms ? [Number(a.bedrooms)] : [], maxBudget: a.maxRent ?? null, localityIds: a.localities ? String(a.localities).split(',') : [], propertyTypes: [] } },
      }).then(slimLead),
  },
  {
    name: 'change_lead_stage',
    description: 'Move a lead to another pipeline stage.',
    roles: BROKERS,
    write: true,
    parameters: obj({ id: str('lead id'), stage: str('NEW | CONTACTED | INTERESTED | SITE_VISIT | NEGOTIATION | WON | LOST'), lostReason: str('reason when LOST') }, ['id', 'stage']),
    summary: (a) => `Lead का stage → ${a.stage}`,
    run: async (a, { call }) => call({ method: 'PATCH', path: `/leads/${id(a.id)}/stage`, body: { stage: a.stage, lostReason: a.lostReason ?? null } }).then(slimLead),
  },
  {
    name: 'add_lead_note',
    description: 'Add a note or call log to a lead’s timeline.',
    roles: BROKERS,
    write: true,
    parameters: obj({ id: str('lead id'), content: str('note text'), type: str('NOTE | CALL') }, ['id', 'content']),
    summary: (a) => `Lead पर note: "${String(a.content).slice(0, 80)}"`,
    run: async (a, { call }) => call({ method: 'POST', path: `/leads/${id(a.id)}/activities`, body: { type: a.type === 'CALL' ? 'CALL' : 'NOTE', content: a.content } }),
  },
  {
    name: 'schedule_follow_up',
    description: 'Schedule a follow-up reminder for a lead (dueAt ISO date-time, Asia/Kolkata).',
    roles: BROKERS,
    write: true,
    parameters: obj({ leadId: str('lead id'), dueAt: str('ISO date-time, e.g. 2026-10-02T11:00:00+05:30'), type: str('CALL | WHATSAPP | MEETING | EMAIL'), note: str('note') }, ['leadId', 'dueAt']),
    summary: (a) => `Follow-up: ${new Date(a.dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}${a.note ? ` — ${a.note}` : ''}`,
    run: async (a, { call }) => call({ method: 'POST', path: '/follow-ups', body: { leadId: a.leadId, dueAt: a.dueAt, type: a.type ?? 'CALL', note: a.note ?? null } }),
  },
  {
    name: 'schedule_site_visit',
    description: 'Schedule a site visit for a lead (optionally for a listing).',
    roles: BROKERS,
    write: true,
    parameters: obj({ leadId: str('lead id'), scheduledAt: str('ISO date-time +05:30'), listingId: str('optional listing id'), note: str('note') }, ['leadId', 'scheduledAt']),
    summary: (a) => `Site visit: ${new Date(a.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}`,
    run: async (a, { call }) => call({ method: 'POST', path: '/visits', body: { leadId: a.leadId, scheduledAt: a.scheduledAt, listingId: a.listingId ?? null, note: a.note ?? null } }),
  },
  {
    name: 'todays_agenda',
    description: "Today's pending follow-ups and site visits.",
    roles: BROKERS,
    parameters: obj({}),
    run: async (_a, { call }) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 86_400_000);
      const [f, v] = await Promise.all([call({ method: 'GET', path: '/follow-ups?view=today' }), call({ method: 'GET', path: `/visits${qs({ from: start.toISOString(), to: end.toISOString() })}` })]);
      return {
        followUps: (f as any[]).slice(0, 15).map((x) => ({ id: x.id, lead: x.lead?.name, leadId: x.lead?.id, dueAt: x.dueAt, type: x.type, note: x.note })),
        visits: (v as any[]).slice(0, 15).map((x) => ({ id: x.id, lead: x.lead?.name, at: x.scheduledAt, listing: x.listing?.title, status: x.status })),
      };
    },
  },
  {
    name: 'submit_listing_for_approval',
    description: 'Send one of your draft/rejected listings to admin for approval.',
    roles: LISTERS,
    write: true,
    parameters: obj({ id: str('listing id') }, ['id']),
    summary: () => 'Listing को admin approval के लिए भेजना',
    run: async (a, { call }) => call({ method: 'PATCH', path: `/listings/${id(a.id)}`, body: { submit: true } }).then((l: any) => ({ id: l.id, status: l.status })),
  },
  {
    name: 'assign_lead',
    description: 'Assign a lead to a team member (firm admins only). Use team_members to find ids.',
    roles: ['BROKER_ADMIN'],
    write: true,
    parameters: obj({ id: str('lead id'), assignedToId: str('team member user id') }, ['id', 'assignedToId']),
    summary: () => 'Lead को team member को assign करना',
    run: async (a, { call }) => call({ method: 'PATCH', path: `/leads/${id(a.id)}/assign`, body: { assignedToId: a.assignedToId } }).then(slimLead),
  },
  {
    name: 'team_members',
    description: 'Team members of the firm (ids, names, roles).',
    roles: ['BROKER_ADMIN'],
    parameters: obj({}),
    run: async (_a, { call }) => {
      const t = await call({ method: 'GET', path: '/broker/team' });
      return (t.members ?? t ?? []).map((m: any) => ({ id: m.id, name: m.name, role: m.role }));
    },
  },
  // ------------------------------------------------------------------ super admin
  {
    name: 'admin_overview',
    description: 'Platform KPIs for the Super Admin.',
    roles: ['SUPER_ADMIN'],
    parameters: obj({}),
    run: async (_a, { call }) => {
      const d = await call({ method: 'GET', path: '/admin/dashboard' });
      return { kpis: d.kpis };
    },
  },
  {
    name: 'moderation_queue',
    description: 'Listings waiting for approval.',
    roles: ['SUPER_ADMIN'],
    parameters: obj({}),
    run: async (_a, { call }) => {
      const r = await call({ method: 'GET', path: '/admin/moderation/listings' });
      return (r.items ?? r ?? []).slice(0, 15).map((l: any) => ({ ...slimListing(l), flags: l.moderationFlags, postedBy: l.postedBy?.name ?? l.organization?.name }));
    },
  },
  {
    name: 'moderate_listing',
    description: 'Approve or reject a pending listing (reject needs a reason).',
    roles: ['SUPER_ADMIN'],
    write: true,
    parameters: obj({ id: str('listing id'), action: str('approve | reject'), reason: str('reason for rejection') }, ['id', 'action']),
    summary: (a) => (a.action === 'reject' ? `Listing reject: ${a.reason ?? ''}` : 'Listing approve करके live करना'),
    run: async (a, { call }) => call({ method: 'POST', path: `/admin/moderation/listings/${id(a.id)}`, body: { action: a.action === 'reject' ? 'reject' : 'approve', reason: a.reason } }),
  },
  {
    name: 'search_users',
    description: 'Find platform users (Super Admin).',
    roles: ['SUPER_ADMIN'],
    parameters: obj({ q: str('name, email or phone'), role: str('USER | BROKER_ADMIN | BROKER_AGENT') }),
    run: async (a, { call }) => {
      const r = await call({ method: 'GET', path: `/admin/users${qs({ q: a.q, role: a.role })}` });
      return { total: r.total, users: (r.items ?? []).slice(0, 10).map((u: any) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status })) };
    },
  },
  {
    name: 'pending_kyc',
    description: 'KYC documents waiting for verification (Super Admin).',
    roles: ['SUPER_ADMIN'],
    parameters: obj({}),
    run: async (_a, { call }) => {
      const r = await call({ method: 'GET', path: '/admin/kyc?status=PENDING' });
      return (r.items ?? r ?? []).slice(0, 10).map((k: any) => ({ id: k.id, type: k.docType, user: k.user?.name ?? k.organization?.name, at: k.createdAt }));
    },
  },
];

export const toolsFor = (role: Role) => TOOLS.filter((t) => t.roles.includes(role));
export const toOpenAi = (tools: Tool[]) => tools.map((t) => ({ type: 'function', function: { name: t.name, description: `${t.description}${t.write ? ' (asks the user to confirm before it runs)' : ''}`, parameters: t.parameters } }));
