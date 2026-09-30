import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CallOutcome, LeadSource } from '@prisma/client';
import { LEAD_SOURCES, normalizeIndianPhone } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { LeadsService } from '../leads/leads.service';
import { requireOrg } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';
import { env } from '../../config/env';

export interface ExotelCreds {
  accountSid: string;
  apiKey: string;
  apiToken: string;
  subdomain?: string;
  exoPhone: string;
  record?: boolean;
  sourceMap?: string;
}

export const exotelBase = (v: Pick<ExotelCreds, 'subdomain' | 'accountSid'>) =>
  `https://${(v.subdomain || 'api.exotel.com').replace(/^https?:\/\//, '')}/v1/Accounts/${v.accountSid}`;
export const exotelAuth = (v: Pick<ExotelCreds, 'apiKey' | 'apiToken'>) => 'Basic ' + Buffer.from(`${v.apiKey}:${v.apiToken}`).toString('base64');

/** "08047112345=HOUSING" lines → ExoPhone digits → lead source. */
export function parseSourceMap(text?: string | null): Record<string, LeadSource> {
  const out: Record<string, LeadSource> = {};
  for (const line of (text ?? '').split(/[\n,;]+/)) {
    const [num, src] = line.split('=').map((s) => s?.trim());
    const key = (num ?? '').replace(/\D/g, '').slice(-10);
    const source = (src ?? '').toUpperCase() as LeadSource;
    if (key.length === 10 && (LEAD_SOURCES as readonly string[]).includes(source)) out[key] = source;
  }
  return out;
}

/** Exotel terminal status → our call outcome. */
export function outcomeFor(status?: string | null, durationSec?: number | null): CallOutcome | null {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed' && (durationSec ?? 0) > 0) return 'CONNECTED';
  if (s === 'busy') return 'BUSY';
  if (s === 'no-answer' || s === 'completed') return 'NO_ANSWER';
  if (s === 'failed') return 'SWITCHED_OFF';
  return null;
}

/**
 * Exotel click-to-call (agent's phone rings first, then the lead), status callbacks into the lead
 * timeline, private recording playback, and incoming calls on the firm's ExoPhone → leads.
 */
@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly leads: LeadsService,
  ) {}

  private async creds(orgId: string) {
    return (await this.settings.require('exotel', orgId, 'Click-to-call के लिए Connectors में Exotel जोड़ें।')) as unknown as ExotelCreds;
  }

  private callbackBase(webhookKey: string) {
    return `${env().PUBLIC_API_URL.replace(/\/$/, '')}/api/webhooks/exotel/${webhookKey}`;
  }

  async clickToCall(user: RequestUser, leadId: string) {
    const orgId = requireOrg(user);
    const lead = await this.leads.getScoped(leadId, user);
    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } });
    if (!me?.phone) throw new BadRequestException('पहले Profile में अपना mobile number डालें — call पहले आपके phone पर आएगी।');
    const v = await this.creds(orgId);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { webhookKey: true } });
    const call = await this.prisma.call.create({
      data: {
        organizationId: orgId,
        leadId: lead.id,
        agentId: user.id,
        direction: 'outbound',
        fromNumber: me.phone,
        toNumber: lead.phone,
        exoPhone: v.exoPhone,
      },
    });
    const form = new URLSearchParams({
      From: me.phone,
      To: lead.phone,
      CallerId: v.exoPhone,
      Record: v.record ? 'true' : 'false',
      StatusCallback: `${this.callbackBase(org.webhookKey)}/status`,
      'StatusCallbackEvents[0]': 'terminal',
      CustomField: call.id,
    });
    const res = await fetch(`${exotelBase(v)}/Calls/connect.json`, {
      method: 'POST',
      headers: { Authorization: exotelAuth(v), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      await this.prisma.call.update({ where: { id: call.id }, data: { status: 'failed', endedAt: new Date() } });
      throw new BadRequestException(`Exotel: ${data?.RestException?.Message ?? `call नहीं लग सकी (${res.status})`}`);
    }
    const sid = data?.Call?.Sid ?? null;
    const updated = await this.prisma.call.update({ where: { id: call.id }, data: { externalSid: sid, status: String(data?.Call?.Status ?? 'in-progress') } });
    await this.prisma.activity.create({
      data: { organizationId: orgId, leadId: lead.id, userId: user.id, type: 'CALL', content: '📞 Click-to-call शुरू (Exotel)', meta: { callId: call.id } },
    });
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: new Date(), ...(lead.firstResponseAt ? {} : { firstResponseAt: new Date() }) },
    });
    return updated;
  }

  async list(user: RequestUser, leadId: string) {
    const lead = await this.leads.getScoped(leadId, user);
    return this.prisma.call.findMany({ where: { leadId: lead.id }, orderBy: { startedAt: 'desc' }, take: 50 });
  }

  /** Exotel StatusCallback (terminal): duration, recording and outcome go to the lead timeline. */
  async onStatus(webhookKey: string, body: Record<string, any>) {
    const org = await this.prisma.organization.findUnique({ where: { webhookKey }, select: { id: true } });
    if (!org) throw new NotFoundException();
    const sid = body.CallSid ?? body.Sid;
    const call =
      (body.CustomField ? await this.prisma.call.findFirst({ where: { id: String(body.CustomField), organizationId: org.id } }) : null) ??
      (sid ? await this.prisma.call.findFirst({ where: { externalSid: String(sid), organizationId: org.id } }) : null);
    if (!call) return { ok: true, ignored: true };
    const duration = Number(body.ConversationDuration ?? body.DialCallDuration ?? body.Duration ?? 0) || 0;
    const status = String(body.Status ?? body.CallStatus ?? call.status).toLowerCase();
    const recordingUrl = body.RecordingUrl ? String(body.RecordingUrl) : null;
    await this.prisma.call.update({
      where: { id: call.id },
      data: {
        status,
        durationSec: duration,
        recordingUrl: recordingUrl ?? call.recordingUrl,
        endedAt: new Date(),
        externalSid: call.externalSid ?? (sid ? String(sid) : null),
      },
    });
    if (call.leadId) {
      const outcome = outcomeFor(status, duration);
      await this.prisma.activity.create({
        data: {
          organizationId: org.id,
          leadId: call.leadId,
          userId: call.agentId,
          type: 'CALL',
          content: `${call.direction === 'inbound' ? '📲 Incoming call' : '📞 Call'} ${outcome === 'CONNECTED' ? `— ${Math.round(duration / 60) || 1} min बात हुई` : `— ${status}`}${recordingUrl ? ' · recording उपलब्ध' : ''}`,
          callOutcome: outcome,
          durationSec: duration || null,
          meta: { callId: call.id },
        },
      });
    }
    return { ok: true };
  }

  /**
   * Exotel "Connect" applet dynamic URL for incoming calls on the ExoPhone: creates/updates the lead
   * (source from the ExoPhone mapping) and returns the number(s) to dial as plain text.
   */
  async onIncoming(webhookKey: string, q: Record<string, any>) {
    const org = await this.prisma.organization.findUnique({ where: { webhookKey }, select: { id: true, phone: true } });
    if (!org) throw new NotFoundException();
    const from = normalizeIndianPhone(String(q.CallFrom ?? q.From ?? '')) ?? String(q.CallFrom ?? q.From ?? '');
    const to = String(q.CallTo ?? q.To ?? '')
      .replace(/\D/g, '')
      .slice(-10);
    const v = (await this.settings.resolve('exotel', org.id)) as unknown as ExotelCreds | null;
    const source = parseSourceMap(v?.sourceMap)[to] ?? 'CALL';
    let agentPhone: string | null = null;
    if (from.replace(/\D/g, '').length >= 10) {
      const { lead } = await this.leads.ingest({
        orgId: org.id,
        name: null,
        phone: from,
        source,
        sourceRef: q.CallSid ? `exotel:${q.CallSid}` : null,
        sourceDetail: `Incoming call on ${to || 'ExoPhone'}`,
      });
      let assignee = lead.assignedToId;
      if (!assignee) assignee = await this.leads.assignRoundRobin(lead.id, org.id).catch(() => null);
      if (assignee) agentPhone = (await this.prisma.user.findUnique({ where: { id: assignee }, select: { phone: true } }))?.phone ?? null;
      await this.prisma.call
        .create({
          data: {
            organizationId: org.id,
            leadId: lead.id,
            agentId: assignee ?? null,
            direction: 'inbound',
            fromNumber: from,
            toNumber: agentPhone,
            exoPhone: to,
            externalSid: q.CallSid ? String(q.CallSid) : null,
            source,
          },
        })
        .catch(() => undefined);
    }
    if (!agentPhone) {
      const admin = await this.prisma.user.findFirst({
        where: { organizationId: org.id, role: 'BROKER_ADMIN', status: 'ACTIVE', phone: { not: null } },
        select: { phone: true },
      });
      agentPhone = admin?.phone ?? org.phone ?? null;
    }
    return (agentPhone ?? '').replace(/^\+91/, '0');
  }

  /** Streams a call recording to members of the same firm only. */
  async recording(user: RequestUser, callId: string) {
    const orgId = requireOrg(user);
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call || call.organizationId !== orgId) throw new NotFoundException();
    if (user.role === 'BROKER_AGENT' && call.agentId !== user.id) throw new ForbiddenException();
    if (!call.recordingUrl) throw new NotFoundException('Recording नहीं है');
    const v = await this.creds(orgId);
    const res = await fetch(call.recordingUrl, { headers: { Authorization: exotelAuth(v) }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new BadRequestException(`Recording नहीं मिली (${res.status})`);
    return { buffer: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? 'audio/mpeg' };
  }
}
