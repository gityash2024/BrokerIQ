import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { Prisma, type ConnectorType } from '@prisma/client';
import { INTEGRATIONS, renderSteps } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { UsageService } from '../../core/usage/usage.service';
import { LeadsService } from '../leads/leads.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { GRAPH } from '../integrations/integration-tester.service';
import { mapGenericPayload, parsePortalEmail, sourceFromLabel } from './portal-parsers';
import { sha256 } from '../../common/utils';
import { env } from '../../config/env';

const ORG_KEY_TO_TYPE: Record<string, ConnectorType> = { email_inbox: 'EMAIL_INBOX', meta_leads: 'META_LEAD_ADS', whatsapp: 'WHATSAPP' };

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
        if (isAdmin && d.key === 'whatsapp') Object.assign(extra, { webhookUrl: `${api}/api/webhooks/whatsapp/${org.webhookKey}`, verifyToken: this.wa.orgVerifyToken(org.webhookKey) });
        if (isAdmin && d.key === 'meta_leads') Object.assign(extra, { webhookUrl: `${api}/api/webhooks/meta-leads/${org.webhookKey}`, verifyToken: this.metaVerifyToken(org.webhookKey) });
        return { ...d, steps: renderSteps(d, api), config: isAdmin ? await this.settings.view(d.key, orgId) : { configured: await this.settings.isConfigured(d.key, orgId) }, state: state ?? null, extra };
      }),
    );
    const webhookState = states.find((s) => s.type === 'WEBHOOK');
    return {
      connectors,
      webhook: {
        url: isAdmin ? `${api}/api/webhooks/leads/${org.webhookKey}` : null,
        state: webhookState ?? null,
        samplePayload: { name: 'Rahul Sharma', phone: '+919876543210', email: 'rahul@example.com', source: 'housing', property: '3 BHK, Sector 65', message: 'Site visit this weekend?' },
      },
      platformWhatsappFallback: !(await this.settings.isConfigured('whatsapp', orgId)) && (await this.settings.isConfigured('whatsapp_platform')),
    };
  }

  async saveConnector(orgId: string, key: string, body: { enabled?: boolean; fields: Record<string, unknown> }, userId: string) {
    if (!ORG_KEY_TO_TYPE[key]) throw new BadRequestException('Unknown connector');
    const wasConfigured = await this.settings.isConfigured(key, orgId);
    if (!wasConfigured) {
      const active = await this.prisma.connectorState.count({ where: { organizationId: orgId, status: { not: 'DISABLED' }, type: { in: ['EMAIL_INBOX', 'META_LEAD_ADS'] } } });
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
      update: { status: 'ACTIVE', lastSyncAt: new Date(), lastError: null, leadsImported: { increment: imported }, ...(cursor !== undefined ? { cursor: cursor as Prisma.InputJsonValue } : {}) },
    });
  }

  // ------------------------------------------------------------------ email inbox (Housing / 99acres / MagicBricks / NoBroker)
  @Cron('0 */2 * * * *')
  async scheduleInboxPolls() {
    if (!env().JOBS_ENABLED) return;
    const states = await this.prisma.connectorState.findMany({ where: { type: 'EMAIL_INBOX', status: { in: ['ACTIVE', 'ERROR'] } }, select: { organizationId: true } });
    for (const s of states) await this.jobs.enqueue('connector.email.poll', { orgId: s.organizationId }, { key: `email-poll:${s.organizationId}`, maxAttempts: 1 });
  }

  async pollInbox(orgId: string): Promise<{ imported: number; scanned: number }> {
    const cfg = await this.settings.resolve('email_inbox', orgId);
    if (!cfg) return { imported: 0, scanned: 0 };
    const state = await this.prisma.connectorState.findUnique({ where: { organizationId_type: { organizationId: orgId, type: 'EMAIL_INBOX' } } });
    const cursor = (state?.cursor as { lastUid?: number; uidValidity?: string } | null) ?? {};
    const portals = String(cfg.portals ?? 'HOUSING,ACRES99,MAGICBRICKS,NOBROKER').split(',').map((s) => s.trim().toUpperCase());
    const client = new ImapFlow({ host: String(cfg.host), port: Number(cfg.port), secure: cfg.secure !== false, auth: { user: String(cfg.user), pass: String(cfg.pass) }, logger: false });
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
        const uids: number[] = range ? ((await client.search({ uid: range }, { uid: true })) || []) : ((await client.search({ since: new Date(Date.now() - 3 * 86400_000) }, { uid: true })) || []);
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
          await this.leads.ingest({
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
      await this.prisma.integrationLog.create({ data: { organizationId: orgId, integration: 'email_inbox', action: 'poll', success: false, message: (e as Error).message.slice(0, 500) } });
      return { imported, scanned };
    }
    if (imported) await this.prisma.integrationLog.create({ data: { organizationId: orgId, integration: 'email_inbox', action: 'poll', success: true, message: `${imported} leads imported` } });
    return { imported, scanned };
  }

  // ------------------------------------------------------------------ generic webhook
  async ingestWebhook(key: string, body: Record<string, any>, query: Record<string, string>) {
    const org = await this.prisma.organization.findUnique({ where: { webhookKey: key } });
    if (!org) throw new NotFoundException('Invalid webhook URL');
    const event = await this.prisma.webhookEvent.create({ data: { provider: 'lead_webhook', organizationId: org.id, payload: { body, query } as Prisma.InputJsonValue } });
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
    const res = await fetch(`${GRAPH}/${cfg.pageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${encodeURIComponent(String(cfg.pageAccessToken))}`, { method: 'POST' });
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
        await this.jobs.enqueue('connector.meta.lead', { orgId: org.id, leadgenId: change.value.leadgen_id, formId: change.value.form_id, platform: change.value.platform ?? null }, { key: `meta-lead:${change.value.leadgen_id}` });
      }
    }
  }

  async fetchMetaLead(orgId: string, leadgenId: string, formId?: string, platform?: string | null) {
    const cfg = await this.settings.require('meta_leads', orgId);
    const res = await fetch(`${GRAPH}/${leadgenId}?fields=field_data,created_time,ad_name,campaign_name,form_id,platform&access_token=${encodeURIComponent(String(cfg.pageAccessToken))}`);
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
