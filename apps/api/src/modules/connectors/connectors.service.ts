import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { Prisma, type ConnectorType } from '@prisma/client';
import { brokerageText, FURNISHING_LABELS, formatINR, INTEGRATIONS, PROPERTY_TYPE_LABELS, renderSteps } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { UsageService } from '../../core/usage/usage.service';
import { LeadsService } from '../leads/leads.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { GRAPH } from '../integrations/integration-tester.service';
import { extractRequirementHints, mapGenericPayload, parsePortalEmail, sourceFromLabel } from './portal-parsers';
import {
  fetchHousingLeads,
  housingBedrooms,
  housingLeadDate,
  housingLeadDetail,
  housingLeadRef,
  HOUSING_MAX_PER_PAGE,
  type HousingCreds,
  type HousingLead,
} from './portals/housing.client';
import { sha256 } from '../../common/utils';
import { env } from '../../config/env';

const ORG_KEY_TO_TYPE: Record<string, ConnectorType> = {
  email_inbox: 'EMAIL_INBOX',
  meta_leads: 'META_LEAD_ADS',
  whatsapp: 'WHATSAPP',
  housing_api: 'HOUSING_API',
  exotel: 'EXOTEL',
  meta_pages: 'META_PAGES',
};
/** Lead connectors that count towards the plan's `connectors` limit. */
const LIMITED_TYPES: ConnectorType[] = ['EMAIL_INBOX', 'META_LEAD_ADS', 'HOUSING_API'];
const HOUSING_FIRST_SYNC_DAYS = 7;
const HOUSING_OVERLAP_SEC = 600;

@Injectable()
export class ConnectorsService implements OnModuleInit {
  private readonly logger = new Logger(ConnectorsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly jobs: JobsService,
    private readonly usage: UsageService,
    private readonly leads: LeadsService,
    private readonly wa: WhatsAppService,
  ) {}

  onModuleInit() {
    this.jobs.register('connector.email.poll', async (p) => void (await this.pollInbox(p.orgId)));
    this.jobs.register('connector.meta.lead', (p) => this.fetchMetaLead(p.orgId, p.leadgenId, p.formId, p.platform));
    this.jobs.register('connector.housing.poll', async (p) => void (await this.pollHousing(p.orgId)));
  }

  metaVerifyToken(webhookKey: string) {
    return sha256(`meta:${webhookKey}`).slice(0, 24);
  }

  // ------------------------------------------------------------------ overview for broker "Connectors" page
  async overview(orgId: string, isAdmin: boolean) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const states = await this.prisma.connectorState.findMany({ where: { organizationId: orgId } });
    const api = env().PUBLIC_API_URL.replace(/\/$/, '');
    const defs = INTEGRATIONS.filter((d) => d.scope === 'organization');
    const connectors = await Promise.all(
      defs.map(async (d) => {
        const state = states.find((s) => s.type === ORG_KEY_TO_TYPE[d.key]);
        const extra: Record<string, string> = {};
        if (isAdmin && d.key === 'whatsapp')
          Object.assign(extra, { webhookUrl: `${api}/api/webhooks/whatsapp/${org.webhookKey}`, verifyToken: this.wa.orgVerifyToken(org.webhookKey) });
        if (isAdmin && d.key === 'meta_leads')
          Object.assign(extra, { webhookUrl: `${api}/api/webhooks/meta-leads/${org.webhookKey}`, verifyToken: this.metaVerifyToken(org.webhookKey) });
        if (isAdmin && d.key === 'exotel') Object.assign(extra, { connectUrl: `${api}/api/webhooks/exotel/${org.webhookKey}/connect` });
        return {
          ...d,
          steps: renderSteps(d, api),
          config: isAdmin ? await this.settings.view(d.key, orgId) : { configured: await this.settings.isConfigured(d.key, orgId) },
          state: state ?? null,
          extra,
        };
      }),
    );
    const webhookState = states.find((s) => s.type === 'WEBHOOK');
    return {
      connectors,
      webhook: {
        url: isAdmin ? `${api}/api/webhooks/leads/${org.webhookKey}` : null,
        state: webhookState ?? null,
        samplePayload: {
          name: 'Rahul Sharma',
          phone: '+919876543210',
          email: 'rahul@example.com',
          source: 'housing',
          property: '3 BHK, Sector 65',
          message: 'Site visit this weekend?',
        },
      },
      platformWhatsappFallback: !(await this.settings.isConfigured('whatsapp', orgId)) && (await this.settings.isConfigured('whatsapp_platform')),
      portalStats: await this.portalStats(orgId),
    };
  }

  /** Per-source lead counts (today / 7 days) and median first-response time — the portal hub strip. */
  async portalStats(orgId: string) {
    const now = Date.now();
    const weekAgo = new Date(now - 7 * 86400_000);
    const IST = 330 * 60_000;
    const todayStart = new Date(Math.floor((now + IST) / 86400_000) * 86400_000 - IST);
    const leads = await this.prisma.lead.findMany({
      where: { organizationId: orgId, createdAt: { gte: weekAgo }, deletedAt: null },
      select: { source: true, createdAt: true, firstResponseAt: true },
      take: 5000,
    });
    const by = new Map<string, { source: string; today: number; week: number; responses: number[] }>();
    for (const l of leads) {
      const row = by.get(l.source) ?? { source: l.source, today: 0, week: 0, responses: [] };
      row.week++;
      if (l.createdAt >= todayStart) row.today++;
      if (l.firstResponseAt) row.responses.push((l.firstResponseAt.getTime() - l.createdAt.getTime()) / 60_000);
      by.set(l.source, row);
    }
    return [...by.values()]
      .map(({ responses, ...r }) => {
        const sorted = responses.filter((m) => m >= 0).sort((a, b) => a - b);
        return { ...r, medianResponseMin: sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)]) : null };
      })
      .sort((a, b) => b.week - a.week);
  }

  async saveConnector(orgId: string, key: string, body: { enabled?: boolean; fields: Record<string, unknown> }, userId: string) {
    if (!ORG_KEY_TO_TYPE[key]) throw new BadRequestException('Unknown connector');
    const wasConfigured = await this.settings.isConfigured(key, orgId);
    if (!wasConfigured) {
      const active = await this.prisma.connectorState.count({ where: { organizationId: orgId, status: { not: 'DISABLED' }, type: { in: LIMITED_TYPES } } });
      if (key !== 'whatsapp') await this.usage.assert(orgId, 'connectors', active);
    }
    const view = await this.settings.save(key, body, { orgId, userId });
    await this.prisma.connectorState.upsert({
      where: { organizationId_type: { organizationId: orgId, type: ORG_KEY_TO_TYPE[key] } },
      create: { organizationId: orgId, type: ORG_KEY_TO_TYPE[key], status: body.enabled === false ? 'DISABLED' : 'ACTIVE' },
      update: { status: body.enabled === false ? 'DISABLED' : 'ACTIVE', lastError: null },
    });
    if (key === 'meta_leads' && view.configured) await this.subscribeMetaPage(orgId).catch((e) => this.setError(orgId, 'META_LEAD_ADS', (e as Error).message));
    if (key === 'email_inbox' && view.configured) await this.jobs.enqueue('connector.email.poll', { orgId }, { key: `email-poll:${orgId}` });
    if (key === 'housing_api' && view.configured && body.enabled !== false)
      await this.jobs.enqueue('connector.housing.poll', { orgId }, { key: `housing-poll:${orgId}` });
    return view;
  }

  async removeConnector(orgId: string, key: string) {
    await this.settings.remove(key, orgId);
    if (ORG_KEY_TO_TYPE[key]) await this.prisma.connectorState.deleteMany({ where: { organizationId: orgId, type: ORG_KEY_TO_TYPE[key] } });
  }

  private async setError(orgId: string, type: ConnectorType, message: string) {
    await this.prisma.connectorState.upsert({
      where: { organizationId_type: { organizationId: orgId, type } },
      create: { organizationId: orgId, type, status: 'ERROR', lastError: message.slice(0, 500) },
      update: { status: 'ERROR', lastError: message.slice(0, 500) },
    });
  }

  private async markSync(orgId: string, type: ConnectorType, imported: number, cursor?: unknown) {
    await this.prisma.connectorState.upsert({
      where: { organizationId_type: { organizationId: orgId, type } },
      create: { organizationId: orgId, type, status: 'ACTIVE', lastSyncAt: new Date(), leadsImported: imported, cursor: cursor as Prisma.InputJsonValue },
      update: {
        status: 'ACTIVE',
        lastSyncAt: new Date(),
        lastError: null,
        leadsImported: { increment: imported },
        ...(cursor !== undefined ? { cursor: cursor as Prisma.InputJsonValue } : {}),
      },
    });
  }

  // ------------------------------------------------------------------ email inbox (Housing / 99acres / MagicBricks / NoBroker)
  @Cron('0 */2 * * * *')
  async scheduleInboxPolls() {
    if (!env().JOBS_ENABLED) return;
    const states = await this.prisma.connectorState.findMany({
      where: { type: 'EMAIL_INBOX', status: { in: ['ACTIVE', 'ERROR'] } },
      select: { organizationId: true },
    });
    for (const s of states)
      await this.jobs.enqueue('connector.email.poll', { orgId: s.organizationId }, { key: `email-poll:${s.organizationId}`, maxAttempts: 1 });
  }

  async pollInbox(orgId: string): Promise<{ imported: number; scanned: number }> {
    const cfg = await this.settings.resolve('email_inbox', orgId);
    if (!cfg) return { imported: 0, scanned: 0 };
    const state = await this.prisma.connectorState.findUnique({ where: { organizationId_type: { organizationId: orgId, type: 'EMAIL_INBOX' } } });
    const cursor = (state?.cursor as { lastUid?: number; uidValidity?: string } | null) ?? {};
    const portals = String(cfg.portals ?? 'HOUSING,ACRES99,MAGICBRICKS,NOBROKER')
      .split(',')
      .map((s) => s.trim().toUpperCase());
    const client = new ImapFlow({
      host: String(cfg.host),
      port: Number(cfg.port),
      secure: cfg.secure !== false,
      auth: { user: String(cfg.user), pass: String(cfg.pass) },
      logger: false,
    });
    let imported = 0;
    let scanned = 0;
    let lastUid = cursor.lastUid ?? 0;
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const mailbox = client.mailbox as any;
        const uidValidity = String(mailbox?.uidValidity ?? '');
        if (cursor.uidValidity && cursor.uidValidity !== uidValidity) lastUid = 0;
        const range = lastUid ? `${lastUid + 1}:*` : undefined;
        const uids: number[] = range
          ? (await client.search({ uid: range }, { uid: true })) || []
          : (await client.search({ since: new Date(Date.now() - 3 * 86400_000) }, { uid: true })) || [];
        for (const uid of uids.filter((u) => u > lastUid).slice(0, 200)) {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          lastUid = Math.max(lastUid, uid);
          if (!msg || !msg.source) continue;
          scanned++;
          const parsed = await simpleParser(msg.source as Buffer);
          const from = parsed.from?.text ?? '';
          const subject = parsed.subject ?? '';
          const lead = parsePortalEmail({ from, subject, text: parsed.text, html: typeof parsed.html === 'string' ? parsed.html : null });
          if (!lead.source || !portals.includes(lead.source) || !lead.phone || lead.confidence < 65) continue;
          const hints = extractRequirementHints(`${subject}\n${lead.property ?? ''}\n${(parsed.text ?? '').slice(0, 3000)}`);
          const localityId = hints.localityText ? await this.matchLocalityId(hints.localityText) : null;
          const hasHints = hints.bedrooms.length || hints.maxBudget || localityId;
          await this.leads.ingest({
            requirement: hasHints
              ? { bedrooms: hints.bedrooms, minBudget: hints.minBudget, maxBudget: hints.maxBudget, localityIds: localityId ? [localityId] : [] }
              : undefined,
            orgId,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            source: lead.source,
            sourceRef: parsed.messageId ?? `uid:${uid}`,
            sourceDetail: lead.property ?? subject.slice(0, 160),
            message: lead.message,
            rawPayload: { from, subject, date: parsed.date, text: (parsed.text ?? '').slice(0, 5000) },
          });
          imported++;
        }
        await this.markSync(orgId, 'EMAIL_INBOX', imported, { lastUid, uidValidity });
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (e) {
      await this.setError(orgId, 'EMAIL_INBOX', (e as Error).message);
      await client.logout().catch(() => undefined);
      await this.prisma.integrationLog.create({
        data: { organizationId: orgId, integration: 'email_inbox', action: 'poll', success: false, message: (e as Error).message.slice(0, 500) },
      });
      return { imported, scanned };
    }
    if (imported)
      await this.prisma.integrationLog.create({
        data: { organizationId: orgId, integration: 'email_inbox', action: 'poll', success: true, message: `${imported} leads imported` },
      });
    return { imported, scanned };
  }

  // ------------------------------------------------------------------ portal pack (copy-ready listing for Housing / 99acres / MagicBricks)
  /** Portals have no public listing API, so brokers post manually — this gives them everything ready to paste. */
  async portalPack(orgId: string, listingId: string) {
    const l = await this.prisma.listing.findFirst({
      where: { id: listingId, organizationId: orgId, deletedAt: null },
      include: { locality: { select: { name: true } }, media: { where: { kind: 'PHOTO' }, orderBy: { sortOrder: 'asc' }, select: { url: true } } },
    });
    if (!l) throw new NotFoundException('Listing नहीं मिली');
    const brokerage = brokerageText(l.brokerageType, l.brokerageAmount, l.price);
    const facts = [
      ['Property type', PROPERTY_TYPE_LABELS[l.propertyType]],
      ['BHK', l.bedrooms ? `${l.bedrooms} BHK` : null],
      ['Bathrooms', l.bathrooms],
      ['Furnishing', l.furnishing ? FURNISHING_LABELS[l.furnishing] : null],
      ['Super area', l.superArea ? `${l.superArea} sqft` : null],
      ['Carpet area', l.carpetArea ? `${l.carpetArea} sqft` : null],
      ['Floor', l.floor != null ? `${l.floor}${l.totalFloors ? ` of ${l.totalFloors}` : ''}` : null],
      ['Monthly rent', formatINR(l.price)],
      ['Security deposit', l.securityDeposit ? formatINR(l.securityDeposit) : null],
      ['Maintenance', l.maintenance ? `${formatINR(l.maintenance)}/month` : null],
      ['Brokerage', brokerage],
      ['Available from', l.availableFrom ? l.availableFrom.toISOString().slice(0, 10) : 'Immediately'],
      ['Society', l.societyName],
      ['Locality', `${l.locality.name}, Gurgaon`],
      ['Amenities', l.amenities.length ? l.amenities.join(', ') : null],
    ].filter(([, v]) => v != null && v !== '') as [string, string | number][];
    const text = [l.title, '', l.description ?? '', '', ...facts.map(([k, v]) => `${k}: ${v}`)].join('\n').trim();
    return {
      title: l.title,
      description: l.description ?? '',
      facts: facts.map(([label, value]) => ({ label, value: String(value) })),
      text,
      photos: l.media.map((m) => m.url),
      portals: [
        { key: 'HOUSING', name: 'Housing.com', url: 'https://housing.com' },
        { key: 'ACRES99', name: '99acres', url: 'https://www.99acres.com' },
        { key: 'MAGICBRICKS', name: 'MagicBricks', url: 'https://www.magicbricks.com' },
      ],
    };
  }

  // ------------------------------------------------------------------ Housing.com CRM Lead API (pull)
  @Cron('0 */5 * * * *')
  async scheduleHousingPolls() {
    if (!env().JOBS_ENABLED) return;
    const states = await this.prisma.connectorState.findMany({
      where: { type: 'HOUSING_API', status: { in: ['ACTIVE', 'ERROR'] } },
      select: { organizationId: true },
    });
    for (const s of states)
      await this.jobs.enqueue('connector.housing.poll', { orgId: s.organizationId }, { key: `housing-poll:${s.organizationId}`, maxAttempts: 1 });
  }

  /** Pulls new Housing leads since the last sync (with overlap; duplicates are skipped via ExternalLeadRef). */
  async pollHousing(orgId: string): Promise<{ imported: number; fetched: number; skipped: number }> {
    const cfg = (await this.settings.resolve('housing_api', orgId)) as HousingCreds | null;
    if (!cfg?.profileId || !cfg.encryptionKey) return { imported: 0, fetched: 0, skipped: 0 };
    const state = await this.prisma.connectorState.findUnique({ where: { organizationId_type: { organizationId: orgId, type: 'HOUSING_API' } } });
    if (state?.status === 'DISABLED') return { imported: 0, fetched: 0, skipped: 0 };
    const nowSec = Math.floor(Date.now() / 1000);
    const lastEnd = Number((state?.cursor as { lastEnd?: number } | null)?.lastEnd ?? 0);
    const start = lastEnd > 0 ? lastEnd - HOUSING_OVERLAP_SEC : nowSec - HOUSING_FIRST_SYNC_DAYS * 86400;
    let fetched = 0;
    let imported = 0;
    let skipped = 0;
    try {
      const leads = await this.fetchHousingWindow(cfg, start, nowSec);
      fetched = leads.length;
      for (const l of leads.sort((a, b) => Number(a.lead_date ?? 0) - Number(b.lead_date ?? 0))) {
        const r = await this.ingestHousingLead(orgId, l);
        if (r === 'imported') imported++;
        else skipped++;
      }
      await this.markSync(orgId, 'HOUSING_API', imported, { lastEnd: nowSec });
    } catch (e) {
      await this.setError(orgId, 'HOUSING_API', (e as Error).message);
      await this.prisma.integrationLog.create({
        data: { organizationId: orgId, integration: 'housing_api', action: 'poll', success: false, message: (e as Error).message.slice(0, 500) },
      });
      return { imported, fetched, skipped };
    }
    if (imported)
      await this.prisma.integrationLog.create({
        data: { organizationId: orgId, integration: 'housing_api', action: 'poll', success: true, message: `${imported} leads imported` },
      });
    return { imported, fetched, skipped };
  }

  /** Housing returns at most per_page rows; when a window is full, split it in halves. */
  private async fetchHousingWindow(cfg: HousingCreds, start: number, end: number, depth = 0): Promise<HousingLead[]> {
    const rows = await fetchHousingLeads(cfg, start, end);
    if (rows.length < HOUSING_MAX_PER_PAGE || depth >= 6 || end - start < 120) return rows;
    const mid = Math.floor((start + end) / 2);
    return [...(await this.fetchHousingWindow(cfg, start, mid, depth + 1)), ...(await this.fetchHousingWindow(cfg, mid + 1, end, depth + 1))];
  }

  private async ingestHousingLead(orgId: string, l: HousingLead): Promise<'imported' | 'duplicate' | 'invalid'> {
    const phone = String(l.lead_phone ?? '').trim();
    if (phone.replace(/\D/g, '').length < 10) return 'invalid';
    const ref = housingLeadRef(l);
    try {
      await this.prisma.externalLeadRef.create({ data: { organizationId: orgId, provider: 'housing', ref } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'duplicate';
      throw e;
    }
    const localityId = l.locality ? await this.matchLocalityId(String(l.locality)) : null;
    const bedrooms = housingBedrooms(l);
    const service = String(l.service_type ?? '').toLowerCase();
    const when = housingLeadDate(l);
    const { lead } = await this.leads.ingest({
      orgId,
      name: l.lead_name ?? null,
      phone,
      email: l.lead_email || null,
      source: 'HOUSING',
      sourceRef: `housing:${ref}`,
      sourceDetail: housingLeadDetail(l),
      message: when ? `Housing पर enquiry: ${when.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` : null,
      rawPayload: l,
      requirement:
        localityId || bedrooms.length || service
          ? { purpose: service === 'rent' ? 'RENT' : undefined, localityIds: localityId ? [localityId] : [], bedrooms, propertyTypes: l.pg_name ? ['PG'] : [] }
          : undefined,
    });
    await this.prisma.externalLeadRef.updateMany({ where: { organizationId: orgId, provider: 'housing', ref }, data: { leadId: lead.id } });
    return 'imported';
  }

  /** Best-effort match of a portal locality name ("Sector 54", "Golf Course Road") to our master data. */
  async matchLocalityId(name: string): Promise<string | null> {
    const q = name.trim();
    if (!q) return null;
    const exact = await this.prisma.locality.findFirst({
      where: { OR: [{ name: { equals: q, mode: 'insensitive' } }, { slug: q.toLowerCase().replace(/[^a-z0-9]+/g, '-') }] },
      select: { id: true },
    });
    if (exact) return exact.id;
    try {
      const rows = await this.prisma.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Locality" WHERE similarity(name, ${q}) > 0.45 ORDER BY similarity(name, ${q}) DESC LIMIT 1`;
      return rows[0]?.id ?? null;
    } catch {
      const like = await this.prisma.locality.findFirst({ where: { name: { contains: q, mode: 'insensitive' } }, select: { id: true } });
      return like?.id ?? null;
    }
  }

  // ------------------------------------------------------------------ generic webhook
  async ingestWebhook(key: string, body: Record<string, any>, query: Record<string, string>) {
    const org = await this.prisma.organization.findUnique({ where: { webhookKey: key } });
    if (!org) throw new NotFoundException('Invalid webhook URL');
    const event = await this.prisma.webhookEvent.create({
      data: { provider: 'lead_webhook', organizationId: org.id, payload: { body, query } as Prisma.InputJsonValue },
    });
    const m = mapGenericPayload({ ...query, ...body });
    if (!m.phone) {
      await this.prisma.webhookEvent.update({ where: { id: event.id }, data: { status: 'FAILED', error: 'phone missing' } });
      throw new BadRequestException('phone field ज़रूरी है (phone / mobile / phone_number)');
    }
    const source = sourceFromLabel(m.source) ?? 'WEBHOOK';
    const { lead, isNew } = await this.leads.ingest({
      orgId: org.id,
      name: m.name,
      phone: m.phone,
      email: m.email,
      source,
      sourceRef: m.externalId ?? event.id,
      sourceDetail: m.property ?? (m.source ? `via ${m.source}` : 'Webhook'),
      message: m.message,
      rawPayload: body,
    });
    await this.prisma.webhookEvent.update({ where: { id: event.id }, data: { status: 'PROCESSED', processedAt: new Date() } });
    await this.markSync(org.id, 'WEBHOOK', isNew ? 1 : 0);
    return { ok: true, leadId: lead.id, duplicate: !isNew };
  }

  // ------------------------------------------------------------------ Facebook / Instagram lead ads
  async subscribeMetaPage(orgId: string) {
    const cfg = await this.settings.require('meta_leads', orgId);
    const res = await fetch(
      `${GRAPH}/${cfg.pageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${encodeURIComponent(String(cfg.pageAccessToken))}`,
      { method: 'POST' },
    );
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data?.error?.message ?? 'Page subscribe failed');
  }

  async metaVerifyTarget(key: string) {
    const org = await this.prisma.organization.findUnique({ where: { webhookKey: key } });
    if (!org) throw new NotFoundException();
    return { org, verifyToken: this.metaVerifyToken(org.webhookKey), cfg: await this.settings.resolve('meta_leads', org.id) };
  }

  async handleMetaWebhook(key: string, body: any) {
    const { org } = await this.metaVerifyTarget(key);
    await this.prisma.webhookEvent.create({ data: { provider: 'meta_leads', organizationId: org.id, payload: body as Prisma.InputJsonValue } });
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change.field !== 'leadgen' || !change.value?.leadgen_id) continue;
        await this.jobs.enqueue(
          'connector.meta.lead',
          { orgId: org.id, leadgenId: change.value.leadgen_id, formId: change.value.form_id, platform: change.value.platform ?? null },
          { key: `meta-lead:${change.value.leadgen_id}` },
        );
      }
    }
  }

  async fetchMetaLead(orgId: string, leadgenId: string, formId?: string, platform?: string | null) {
    const cfg = await this.settings.require('meta_leads', orgId);
    const res = await fetch(
      `${GRAPH}/${leadgenId}?fields=field_data,created_time,ad_name,campaign_name,form_id,platform&access_token=${encodeURIComponent(String(cfg.pageAccessToken))}`,
    );
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      await this.setError(orgId, 'META_LEAD_ADS', data?.error?.message ?? `Meta ${res.status}`);
      throw new Error(data?.error?.message ?? `Meta ${res.status}`);
    }
    const m = mapGenericPayload(data);
    if (!m.phone) return;
    const isInsta = (platform ?? data.platform ?? '').toLowerCase().startsWith('ig') || (platform ?? '').toLowerCase().includes('instagram');
    const { isNew } = await this.leads.ingest({
      orgId,
      name: m.name,
      phone: m.phone,
      email: m.email,
      source: isInsta ? 'INSTAGRAM' : 'FACEBOOK',
      sourceRef: leadgenId,
      sourceDetail: [data.campaign_name, data.ad_name].filter(Boolean).join(' · ') || `Lead form ${formId ?? ''}`.trim(),
      message: m.message,
      rawPayload: data,
    });
    await this.markSync(orgId, 'META_LEAD_ADS', isNew ? 1 : 0);
  }
}
