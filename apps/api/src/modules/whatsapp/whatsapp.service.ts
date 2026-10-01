import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma, type MessageType } from '@prisma/client';
import { normalizeIndianPhone, phoneForWhatsApp } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService, type IntegrationValues } from '../../core/settings/settings.service';
import { RealtimeGateway } from '../../core/realtime/realtime.gateway';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { EventsService } from '../../core/events/events.service';
import { IntegrationFailedException, IntegrationNotConfiguredException } from '../../common/exceptions';
import { LeadsService } from '../leads/leads.service';
import { sha256 } from '../../common/utils';
import { GRAPH } from '../integrations/integration-tester.service';

export interface WaCreds {
  scope: 'organization' | 'platform';
  values: IntegrationValues;
}

const NOT_CONNECTED =
  'WhatsApp number connected नहीं है — Broker panel → Connectors → "My WhatsApp Business number" में जोड़ें। तब तक "WhatsApp पर खोलें" button से message भेजें।';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly events: EventsService,
    private readonly leads: LeadsService,
  ) {}

  /** Webhook verify token shown to the broker for their Meta app. */
  orgVerifyToken(webhookKey: string) {
    return sha256(`wa:${webhookKey}`).slice(0, 24);
  }

  async creds(orgId: string | null): Promise<WaCreds | null> {
    if (orgId) {
      const own = await this.settings.resolve('whatsapp', orgId);
      if (own) return { scope: 'organization', values: own };
    }
    const platform = await this.settings.resolve('whatsapp_platform');
    return platform ? { scope: 'platform', values: platform } : null;
  }

  async requireCreds(orgId: string | null) {
    const c = await this.creds(orgId);
    if (!c) throw new IntegrationNotConfiguredException('whatsapp', NOT_CONNECTED);
    return c;
  }

  // ------------------------------------------------------------------ conversations
  async conversationFor(orgId: string | null, phone: string, opts: { name?: string | null; leadId?: string | null } = {}) {
    const contactKey = phoneForWhatsApp(phone);
    const patch = { ...(opts.leadId ? { leadId: opts.leadId } : {}), ...(opts.name ? { contactName: opts.name } : {}) };
    if (!orgId) {
      const found = await this.prisma.conversation.findFirst({ where: { organizationId: null, channel: 'WHATSAPP', contactKey } });
      if (found) return Object.keys(patch).length ? this.prisma.conversation.update({ where: { id: found.id }, data: patch }) : found;
      return this.prisma.conversation.create({ data: { channel: 'WHATSAPP', contactKey, contactPhone: `+${contactKey}`, contactName: opts.name } });
    }
    return this.prisma.conversation.upsert({
      where: { organizationId_channel_contactKey: { organizationId: orgId, channel: 'WHATSAPP', contactKey } },
      create: { organizationId: orgId, channel: 'WHATSAPP', contactKey, contactPhone: `+${contactKey}`, contactName: opts.name, leadId: opts.leadId },
      update: patch,
    });
  }

  private async graphSend(values: IntegrationValues, payload: Record<string, unknown>) {
    const res = await fetch(`${GRAPH}/${values.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${values.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.error?.code;
      const msg =
        code === 131047 || code === 131026
          ? '24 घंटे की window बंद है — lead ने पिछले 24 घंटे में message नहीं किया। Approved template भेजें।'
          : (data?.error?.error_data?.details ?? data?.error?.message ?? `Meta API ${res.status}`);
      throw new IntegrationFailedException('whatsapp', msg);
    }
    return data?.messages?.[0]?.id as string | undefined;
  }

  /** Core send used by inbox, automations and share buttons. Stores the message and emits realtime updates. */
  async send(
    orgId: string | null,
    to: string,
    msg:
      | { type: 'text'; text: string }
      | { type: 'template'; name: string; language: string; params: string[] }
      | { type: 'image' | 'document'; url: string; caption?: string },
    opts: {
      leadId?: string | null;
      userId?: string | null;
      contactName?: string | null;
      meta?: Record<string, unknown>;
      /** Never fall back to the platform number (broadcasts: the cost must be the firm's own) */
      ownNumberOnly?: boolean;
      /** What the firm's inbox shows instead of the real text (OTPs must not be readable by the broker) */
      storedBody?: string;
    } = {},
  ) {
    const phone = normalizeIndianPhone(to) ?? to;
    const creds = await this.requireCreds(orgId);
    if (opts.ownNumberOnly && creds.scope !== 'organization') throw new IntegrationNotConfiguredException('whatsapp', NOT_CONNECTED);
    const conv = await this.conversationFor(orgId, phone, { leadId: opts.leadId, name: opts.contactName });
    const body =
      opts.storedBody ??
      (msg.type === 'text'
        ? msg.text
        : msg.type === 'template'
          ? `[Template] ${msg.name}${msg.params.length ? `: ${msg.params.join(' | ')}` : ''}`
          : (msg.caption ?? ''));
    const type: MessageType = msg.type === 'text' ? 'TEXT' : msg.type === 'template' ? 'TEMPLATE' : msg.type === 'image' ? 'IMAGE' : 'DOCUMENT';
    const record = await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: 'OUTBOUND',
        type,
        body,
        mediaUrl: 'url' in msg ? msg.url : null,
        templateName: msg.type === 'template' ? msg.name : null,
        senderUserId: opts.userId ?? null,
        status: 'QUEUED',
        meta: { scope: creds.scope, ...(opts.meta ?? {}) } as Prisma.InputJsonValue,
      },
    });
    const payload: Record<string, unknown> = { to: phoneForWhatsApp(phone) };
    if (msg.type === 'text') Object.assign(payload, { type: 'text', text: { body: msg.text, preview_url: true } });
    else if (msg.type === 'template')
      Object.assign(payload, {
        type: 'template',
        template: {
          name: msg.name,
          language: { code: msg.language },
          ...(msg.params.length ? { components: [{ type: 'body', parameters: msg.params.map((p) => ({ type: 'text', text: p })) }] } : {}),
        },
      });
    else Object.assign(payload, { type: msg.type, [msg.type]: { link: msg.url, ...(msg.caption ? { caption: msg.caption } : {}) } });

    try {
      const externalId = await this.graphSend(creds.values, payload);
      const saved = await this.prisma.message.update({ where: { id: record.id }, data: { status: 'SENT', externalId } });
      await this.touchConversation(conv.id, body, false);
      if (opts.leadId && conv.organizationId) {
        await this.prisma.activity.create({
          data: {
            organizationId: conv.organizationId,
            leadId: opts.leadId,
            userId: opts.userId ?? null,
            type: 'WHATSAPP',
            content: `📤 ${body.slice(0, 500)}`,
          },
        });
        await this.prisma.lead.update({ where: { id: opts.leadId }, data: { lastActivityAt: new Date() } });
        await this.prisma.lead.updateMany({ where: { id: opts.leadId, firstResponseAt: null }, data: { firstResponseAt: new Date() } });
      }
      this.emit(conv.organizationId, 'wa:message', { conversationId: conv.id, message: saved });
      return saved;
    } catch (e) {
      const failed = await this.prisma.message.update({ where: { id: record.id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 500) } });
      this.emit(conv.organizationId, 'wa:message', { conversationId: conv.id, message: failed });
      throw e;
    }
  }

  private async touchConversation(id: string, preview: string, inbound: boolean) {
    await this.prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), lastPreview: preview.slice(0, 140), ...(inbound ? { lastInboundAt: new Date(), unreadCount: { increment: 1 } } : {}) },
    });
  }

  private emit(orgId: string | null, event: string, data: unknown) {
    if (orgId) this.realtime.toOrg(orgId, event, data);
    else this.realtime.toAdmins(event, data);
  }

  // ------------------------------------------------------------------ webhook
  verifySignature(appSecret: string | undefined, rawBody: Buffer | undefined, header: string | undefined) {
    if (!appSecret) return true; // signature check only when app secret configured
    if (!rawBody || !header?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(header.slice(7));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async resolveWebhookTarget(key: string): Promise<{ orgId: string | null; values: IntegrationValues | null; verifyToken: string | null }> {
    if (key === 'platform') {
      const v = await this.settings.resolve('whatsapp_platform');
      return { orgId: null, values: v, verifyToken: v ? String(v.verifyToken) : null };
    }
    const org = await this.prisma.organization.findUnique({ where: { webhookKey: key } });
    if (!org) throw new NotFoundException();
    return { orgId: org.id, values: await this.settings.resolve('whatsapp', org.id), verifyToken: this.orgVerifyToken(org.webhookKey) };
  }

  async handleWebhook(key: string, body: any) {
    const target = await this.resolveWebhookTarget(key);
    await this.prisma.webhookEvent.create({
      data: { provider: 'whatsapp', organizationId: target.orgId, payload: body as Prisma.InputJsonValue, status: 'PROCESSED', processedAt: new Date() },
    });
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const contacts: any[] = value.contacts ?? [];
        for (const m of value.messages ?? []) await this.onInbound(target.orgId, m, contacts.find((c) => c.wa_id === m.from)?.profile?.name);
        for (const s of value.statuses ?? []) await this.onStatus(s);
      }
    }
  }

  private async onInbound(orgId: string | null, m: any, profileName?: string) {
    if (await this.prisma.message.findUnique({ where: { externalId: m.id } })) return;
    const phone = `+${m.from}`;
    let text = '';
    let type: MessageType = 'TEXT';
    let mediaUrl: string | null = null;
    switch (m.type) {
      case 'text':
        text = m.text?.body ?? '';
        break;
      case 'button':
        text = m.button?.text ?? '';
        break;
      case 'interactive':
        text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '';
        break;
      case 'location':
        type = 'LOCATION';
        text = `📍 ${m.location?.name ?? ''} ${m.location?.latitude},${m.location?.longitude}`;
        break;
      case 'image':
      case 'document':
      case 'video':
      case 'audio':
        type = m.type.toUpperCase();
        text = m[m.type]?.caption ?? `[${m.type}]`;
        mediaUrl = m[m.type]?.id ? `wa-media:${m[m.type].id}` : null;
        break;
      default:
        text = `[${m.type}]`;
    }

    let leadId: string | null = null;
    if (orgId) {
      const existing = await this.prisma.lead.findUnique({
        where: { organizationId_phone: { organizationId: orgId, phone: normalizeIndianPhone(phone) ?? phone } },
      });
      if (existing) leadId = existing.id;
      else {
        const { lead } = await this.leads.ingest({
          orgId,
          name: profileName ?? null,
          phone,
          source: 'WHATSAPP',
          sourceRef: m.id,
          sourceDetail: 'Incoming WhatsApp message',
          message: text,
        });
        leadId = lead.id;
      }
    }
    const conv = await this.conversationFor(orgId, phone, { name: profileName, leadId });
    const saved = await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: 'INBOUND',
        type,
        body: text,
        mediaUrl,
        status: 'RECEIVED',
        externalId: m.id,
        meta: { raw: m } as Prisma.InputJsonValue,
      },
    });
    await this.touchConversation(conv.id, text, true);
    if (leadId && orgId) {
      await this.prisma.activity.create({ data: { organizationId: orgId, leadId, type: 'WHATSAPP', content: `📥 ${text.slice(0, 500)}` } });
      const lead = await this.prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } });
      const title = `💬 ${profileName ?? lead.name}: ${text.slice(0, 60)}`;
      if (lead.assignedToId) await this.notifications.notify(lead.assignedToId, { kind: 'NEW_MESSAGE', title, link: `/broker/inbox?c=${conv.id}` });
      else await this.notifications.notifyOrg(orgId, { kind: 'NEW_MESSAGE', title, link: `/broker/inbox?c=${conv.id}` }, { adminsOnly: true });
    }
    this.emit(orgId, 'wa:message', { conversationId: conv.id, message: saved });
    this.events.emit('message.inbound', { conversationId: conv.id, orgId, leadId });
    if (orgId && leadId) await this.handleOptOut(orgId, leadId, phone, text).catch((e) => this.logger.warn(`opt-out: ${(e as Error).message}`));
  }

  /** "STOP" stops campaign messages to this lead; "START" turns them back on. Confirmation is free (inside the 24h window). */
  private async handleOptOut(orgId: string, leadId: string, phone: string, text: string) {
    const word = text
      .trim()
      .toLowerCase()
      .replace(/[.!]+$/, '');
    const stop = ['stop', 'unsubscribe', 'stop all', 'band', 'बंद', 'बंद करो'].includes(word);
    const start = ['start', 'शुरू', 'shuru'].includes(word);
    if (!stop && !start) return;
    await this.prisma.lead.update({ where: { id: leadId }, data: { optedOutAt: stop ? new Date() : null } });
    await this.prisma.activity.create({
      data: {
        organizationId: orgId,
        leadId,
        type: 'SYSTEM',
        content: stop ? '🔕 Lead ने campaign messages बंद करवाए (STOP)' : '🔔 Lead ने messages फिर शुरू किए (START)',
      },
    });
    const reply = stop
      ? 'ठीक है, अब आपको हमारे offers/updates नहीं भेजे जाएँगे। दोबारा शुरू करने के लिए START लिखें।'
      : 'ठीक है, आपको फिर से नई properties और updates भेजे जाएँगे। बंद करने के लिए STOP लिखें।';
    await this.send(orgId, phone, { type: 'text', text: reply }, { leadId, ownNumberOnly: true }).catch(() => undefined);
  }

  private async onStatus(s: any) {
    const map: Record<string, any> = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' };
    const status = map[s.status];
    if (!status || !s.id) return;
    const msg = await this.prisma.message.findUnique({ where: { externalId: s.id }, include: { conversation: true } });
    if (!msg) return;
    const order = ['QUEUED', 'SENT', 'DELIVERED', 'READ'];
    if (status !== 'FAILED' && order.indexOf(status) <= order.indexOf(msg.status)) return;
    const updated = await this.prisma.message.update({
      where: { id: msg.id },
      data: { status, error: s.errors?.[0]?.title ?? (status === 'FAILED' ? 'Failed' : null) },
    });
    this.emit(msg.conversation.organizationId, 'wa:status', { conversationId: msg.conversationId, messageId: msg.id, status: updated.status });
  }

  // ------------------------------------------------------------------ templates
  async syncTemplates(orgId: string) {
    const c = await this.requireCreds(orgId);
    if (c.scope !== 'organization') throw new ForbiddenException('Templates sync के लिए अपना WhatsApp number connect करें');
    const res = await fetch(`${GRAPH}/${c.values.businessAccountId}/message_templates?limit=200&fields=name,language,status,category,components`, {
      headers: { Authorization: `Bearer ${c.values.accessToken}` },
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new IntegrationFailedException('whatsapp', data?.error?.message ?? `Meta ${res.status}`);
    for (const t of data.data ?? []) {
      const bodyText = (t.components ?? []).find((c: any) => c.type === 'BODY')?.text ?? null;
      await this.prisma.whatsAppTemplate.upsert({
        where: { organizationId_name_language: { organizationId: orgId, name: t.name, language: t.language } },
        create: {
          organizationId: orgId,
          name: t.name,
          language: t.language,
          status: t.status,
          category: t.category,
          body: bodyText,
          components: t.components,
          externalId: t.id,
        },
        update: { status: t.status, category: t.category, body: bodyText, components: t.components, externalId: t.id },
      });
    }
    return this.prisma.whatsAppTemplate.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } });
  }
}
