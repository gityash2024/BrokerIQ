import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { canonicalInventorySector, normalizeIndianPhone } from '@brokeriq/shared';
import { z } from 'zod';
import { env } from '../../config/env';
import type { RequestUser } from '../../common/decorators';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import { requireOrg } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { CryptoService } from '../../core/settings/crypto.service';
import { AiService } from '../../core/ai/ai.service';
import { AuthService } from '../auth/auth.service';
import { connectSettings, type ConnectCapture, type ConnectRecording, type ConnectRegistration, type ConnectSettings } from './connect.schemas';
import { transcribeConnectRecording } from './connect-transcription';

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const privateMessage = /\b(?:otp|password|passcode|one.time (?:code|password)|verification code|bank account|credited|debited)\b/i;
const redact = (text: string) => text.replace(/(?:\+?91[\s.-]*)?[6-9](?:[\s.-]*\d){9}\b/g, '[contact]')
  .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[contact]');
const eventProjection = {
  id: true, kind: true, status: true, capturedAt: true, updatedAt: true, leadId: true, callId: true, lastError: true, recordingType: true,
} as const;
const insights = z.object({
  summary: z.string().min(1).max(1400),
  intent: z.enum(['OFFER', 'DEMAND', 'OTHER']),
  confidence: z.number().int().min(0).max(100),
  opportunity: z.string().max(200).optional(),
  purpose: z.enum(['RENT', 'SALE']).optional(),
  sector: z.string().max(80).optional(),
  locality: z.string().max(120).optional(),
  address: z.string().max(200).optional(),
  bedrooms: z.number().int().min(1).max(50).optional(),
  budget: z.number().nonnegative().max(10_000_000_000).optional(),
  floor: z.string().max(80).optional(),
  furnishing: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).optional(),
  availability: z.string().max(80).optional(),
  timeline: z.string().max(120).optional(),
  financing: z.string().max(120).optional(),
  negotiation: z.string().max(250).optional(),
  objections: z.array(z.string().max(200)).max(8).default([]),
  commitments: z.array(z.string().max(200)).max(8).default([]),
  preferences: z.array(z.string().max(200)).max(8).default([]),
  nextSteps: z.array(z.string().max(200)).max(8).default([]),
  evidence: z.string().max(500).optional(),
});
type Insight = z.infer<typeof insights>;

@Injectable()
export class ConnectService {
  constructor(private readonly db: PrismaService, private readonly jobs: JobsService, private readonly storage: LocalStorageService,
    private readonly crypto: CryptoService, private readonly ai: AiService, private readonly auth: AuthService) {
    jobs.register('connect.process', (job) => this.process(job.id));
    jobs.register('connect.purge', (job) => this.purgeRecording(job.id, job.orgId));
  }

  async profile(user: RequestUser) {
    const options = env();
    const devices = await this.db.connectDevice.findMany({ where: { userId: user.id, organizationId: user.orgId ?? '', revokedAt: null },
      select: { id: true, label: true, version: true, lastSeenAt: true, consentAt: true, sessionId: true }, orderBy: { lastSeenAt: 'desc' } });
    const sessions = devices.length ? await this.db.refreshToken.findMany({ where: { id: { in: devices.map(({ sessionId }) => sessionId) },
      userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } }) : [];
    const connected = devices.filter(({ sessionId }) => sessions.some(({ id }) => id === sessionId)).map(({ sessionId: _session, ...device }) => device);
    return { downloadUrl: options.CONNECT_APK_URL ?? null, latestVersion: options.CONNECT_APK_VERSION,
      enabled: options.CONNECT_ENABLED, devices: connected };
  }

  private assertCaptureAllowed(user: RequestUser) {
    if (!env().CONNECT_ENABLED) throw new IntegrationNotConfiguredException('brokeriq_connect', 'Enable BrokerIQ Connect for this environment before linking a device');
    if (!['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role)) throw new ForbiddenException();
    return requireOrg(user);
  }

  async register(user: RequestUser, sessionId: string, input: ConnectRegistration) {
    const organizationId = this.assertCaptureAllowed(user);
    const current = await this.db.connectDevice.findUnique({ where: { sessionId } });
    if (current && (current.userId !== user.id || current.organizationId !== organizationId || current.installId !== input.installId || current.revokedAt)) {
      throw new ForbiddenException('Sign in again to link this device');
    }
    const data = { ...input, lastSeenAt: new Date() };
    const saved = await this.db.connectDevice.upsert({ where: { sessionId }, create: { ...data, organizationId, userId: user.id, sessionId }, update: data });
    return { id: saved.id, settings: connectSettings.parse(saved.settings), latestVersion: env().CONNECT_APK_VERSION };
  }

  async settings(user: RequestUser, sessionId: string, input: ConnectSettings) {
    const device = await this.device(user, sessionId);
    const settings = input.consent ? input : connectSettings.parse({});
    await this.db.$transaction(async (tx) => {
      await tx.connectDevice.update({ where: { id: device.id }, data: { settings, consentAt: settings.consent ? device.consentAt ?? new Date() : null, lastSeenAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: user.id, organizationId: device.organizationId, entity: 'ConnectDevice', entityId: device.id,
        action: 'connect.consent', meta: { enabled: settings.consent, groupCount: settings.groups.length, calls: settings.calls, recordings: settings.recordings, whatsapp: settings.whatsapp } } });
    });
    return settings;
  }

  async revoke(user: RequestUser, id: string) {
    const row = await this.db.connectDevice.findFirst({ where: { id, userId: user.id, organizationId: requireOrg(user), revokedAt: null } });
    if (!row) throw new NotFoundException('Linked device not found');
    await this.db.connectDevice.update({ where: { id }, data: { revokedAt: new Date() } });
    await this.auth.revokeSession(user.id, row.sessionId);
    return { ok: true };
  }

  private async device(user: RequestUser, sessionId: string) {
    const organizationId = this.assertCaptureAllowed(user);
    const device = await this.db.connectDevice.findFirst({ where: { sessionId, userId: user.id, organizationId, revokedAt: null } });
    if (!device) throw new ForbiddenException('Link and authorize the device first');
    return device;
  }

  private leadScope(user: RequestUser): Prisma.LeadWhereInput {
    if (user.delegatedActor && !user.delegatedPermissions?.includes('leads:view')) throw new ForbiddenException('Lead viewing access is required');
    return { organizationId: requireOrg(user), deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) };
  }

  async directory(user: RequestUser, sessionId: string, after?: string) {
    const device = await this.device(user, sessionId);
    const settings = connectSettings.parse(device.settings);
    if (!settings.consent || !settings.calls) throw new ForbiddenException('Authorize call capture to download the lead directory');
    const entries = await this.db.lead.findMany({ where: { ...this.leadScope(user), ...(after ? { id: { gt: after } } : {}) },
      take: 501, orderBy: { id: 'asc' }, select: { id: true, name: true, phone: true, alternatePhone: true } });
    return { items: entries.slice(0, 500), next: entries.length > 500 ? entries[499].id : null };
  }

  async capture(user: RequestUser, sessionId: string, input: ConnectCapture) {
    const device = await this.device(user, sessionId);
    const settings = connectSettings.parse(device.settings);
    const now = new Date();
    const at = new Date(input.capturedAt);
    if (!settings.consent || !device.consentAt || at < device.consentAt || at.valueOf() - now.valueOf() > 5 * 60_000) {
      throw new ForbiddenException('Capture requires active permission and a new event');
    }
    const organizationId = device.organizationId;
    const payload = input.kind === 'WHATSAPP' ? { ...input, text: input.text.trim(), senderPhone: normalizeIndianPhone(input.senderPhone) ?? undefined } : input;
    const fingerprint = sha(input.kind === 'WHATSAPP'
      ? ['whatsapp', input.group, at.valueOf(), input.text.trim()].join('|')
      : ['call', user.id, input.leadId, input.direction, at.valueOf()].join('|'));
    if (input.kind === 'WHATSAPP' && (!settings.whatsapp || !settings.groups.includes(input.group) || privateMessage.test(input.text))) {
      throw new ForbiddenException('This notification is outside the approved capture settings');
    }
    if (input.kind === 'CALL' && !settings.calls) throw new ForbiddenException('Call capture is disabled');
    const event = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'connect:' + organizationId + ':' + fingerprint}))`);
      const prior = await tx.connectEvent.findUnique({ where: { organizationId_fingerprint: { organizationId, fingerprint } } });
      if (prior) return prior;
      let callId: string | undefined;
      if (input.kind === 'CALL') {
        const lead = await tx.lead.findFirst({ where: { id: input.leadId, ...this.leadScope(user) }, select: { id: true, phone: true, alternatePhone: true } });
        const phone = normalizeIndianPhone(input.number);
        if (!lead || !phone || ![lead.phone, lead.alternatePhone].map(normalizeIndianPhone).includes(phone)) {
          throw new ForbiddenException('Call does not match an authorized lead');
        }
        const call = await tx.call.create({ data: { organizationId, leadId: lead.id, agentId: user.id,
          direction: input.direction === 'INBOUND' ? 'inbound' : 'outbound', source: 'BROKERIQ_CONNECT', startedAt: at,
          status: input.outcome.toLowerCase(), durationSec: input.durationSec,
          ...(input.direction === 'INBOUND' ? { fromNumber: phone } : { toNumber: phone }),
        }, select: { id: true } });
        callId = call.id;
        await tx.activity.create({ data: { organizationId, leadId: lead.id, userId: user.id, type: 'CALL',
          content: 'BrokerIQ Connect · ' + (input.direction === 'INBOUND' ? 'Incoming SIM call' : 'Outgoing SIM call'), durationSec: input.durationSec,
          meta: { callId, source: 'BROKERIQ_CONNECT', outcome: input.outcome } } });
      }
      await tx.connectDevice.update({ where: { id: device.id }, data: { lastSeenAt: now } });
      return tx.connectEvent.create({ data: { deviceId: device.id, userId: user.id, organizationId, fingerprint, kind: input.kind,
        capturedAt: at, leadId: input.kind === 'CALL' ? input.leadId : undefined, callId,
        encryptedInput: input.kind === 'WHATSAPP' ? this.crypto.encrypt(JSON.stringify(payload)) : null,
        status: input.kind === 'WHATSAPP' && settings.analysis ? 'PENDING' : 'SAVED',
      } });
    });
    if (event.status === 'PENDING') await this.queueEvent(event);
    return { id: event.id, status: event.status, ...(event.userId === user.id ? { callId: event.callId } : {}) };
  }

  async recording(user: RequestUser, sessionId: string, input: ConnectRecording) {
    const device = await this.device(user, sessionId);
    const settings = connectSettings.parse(device.settings);
    if (!settings.consent || !settings.recordings || !device.consentAt) throw new ForbiddenException('Recording consent is required');
    const call = await this.db.call.findFirst({ where: { id: input.callId, organizationId: device.organizationId, source: 'BROKERIQ_CONNECT',
      agentId: user.id, lead: { is: this.leadScope(user) } }, select: { leadId: true, id: true } });
    if (!call) throw new ForbiddenException('Choose a recording for an authorized call');
    const bytes = Buffer.from(input.base64, 'base64');
    const mp4 = bytes.subarray(4, 8).toString('ascii') === 'ftyp';
    const wav = bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE';
    const mpeg = bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0);
    if (bytes.length < 16 || bytes.length > 12 * 1024 * 1024 || !(input.mime === 'audio/mp4' ? mp4 : input.mime.includes('wav') ? wav : mpeg)) {
      throw new BadRequestException('Choose a valid M4A, MP3, AAC or WAV recording up to 12 MB');
    }
    const fingerprint = sha('audio:' + sha(bytes));
    const event = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'connect:' + device.organizationId + ':' + fingerprint}))`);
      const prior = await tx.connectEvent.findUnique({ where: { organizationId_fingerprint: { organizationId: device.organizationId, fingerprint } } });
      if (prior) {
        if (prior.callId !== call.id || prior.userId !== user.id) throw new BadRequestException('Recording is already associated with another call');
        return prior;
      }
      const recordingKey = await this.storage.putSource(bytes, input.mime, device.organizationId);
      return tx.connectEvent.create({ data: { deviceId: device.id, userId: user.id, organizationId: device.organizationId,
        fingerprint, kind: 'RECORDING', leadId: call.leadId, callId: call.id, capturedAt: new Date(input.capturedAt),
        recordingKey, recordingType: input.mime, status: settings.analysis ? 'PENDING' : 'SAVED' } });
    }, { timeout: 30_000 });
    if (event.status === 'PENDING') await this.queueEvent(event);
    return { id: event.id, status: event.status };
  }

  private queueEvent(event: { id: string; organizationId: string }, retry = false) {
    return this.jobs.enqueue('connect.process', { id: event.id, orgId: event.organizationId }, { key: 'connect:' + event.id, repeat: retry });
  }

  private eventScope(user: RequestUser, leadId?: string): Prisma.ConnectEventWhereInput {
    return { organizationId: requireOrg(user), leadId, status: { not: 'DELETED' }, ...(user.role === 'BROKER_AGENT' ? { userId: user.id } : {}) };
  }

  async activity(user: RequestUser, leadId?: string) {
    if (leadId && !(await this.db.lead.findFirst({ where: { id: leadId, ...this.leadScope(user) }, select: { id: true } }))) throw new NotFoundException('Lead not found');
    const rows = await this.db.connectEvent.findMany({ where: this.eventScope(user, leadId), select: eventProjection, take: 100, orderBy: { capturedAt: 'desc' } });
    return { items: rows.map(({ recordingType, ...row }) => ({ ...row, recording: !!recordingType })) };
  }

  private async event(user: RequestUser, id: string) {
    const event = await this.db.connectEvent.findFirst({ where: { id, ...this.eventScope(user) } });
    if (!event || (event.leadId && !(await this.db.lead.findFirst({ where: { id: event.leadId, ...this.leadScope(user) }, select: { id: true } })))) {
      throw new NotFoundException('Connect activity not found');
    }
    return event;
  }

  async detail(user: RequestUser, id: string) {
    const row = await this.event(user, id);
    return { id: row.id, kind: row.kind, status: row.status, capturedAt: row.capturedAt, lastError: row.lastError, recording: !!row.recordingKey,
      details: row.encryptedResult ? JSON.parse(this.crypto.decrypt(row.encryptedResult)) : null };
  }

  async playback(user: RequestUser, id: string) {
    const row = await this.event(user, id);
    if (!row.recordingKey) throw new NotFoundException('Recording unavailable');
    return this.storage.read(row.recordingKey);
  }

  async remove(user: RequestUser, id: string) {
    const event = await this.db.connectEvent.findFirst({ where: { id, organizationId: requireOrg(user) } });
    if (!event) throw new NotFoundException('Connect activity not found');
    if (event.status !== 'DELETED') await this.event(user, id);
    await this.db.$transaction(async (tx) => {
      const removed = await tx.connectEvent.updateMany({ where: { id, organizationId: event.organizationId, status: { not: 'DELETED' } },
        data: { status: 'DELETED', encryptedInput: null, encryptedResult: null, lastError: null } });
      if (removed.count) await tx.auditLog.create({ data: { actorId: user.id, actorRole: user.delegatedActor ? 'SUB_BROKER_ADMIN' : user.role,
        organizationId: event.organizationId, action: 'connect.event.delete', entity: 'ConnectEvent', entityId: id } });
    });
    if (event.recordingKey) await this.jobs.enqueue('connect.purge', { id, orgId: event.organizationId }, { key: 'connect-purge:' + id, repeat: true });
    return { ok: true };
  }

  private async purgeRecording(id: string, organizationId: string) {
    const row = await this.db.connectEvent.findFirst({ where: { id, organizationId, status: 'DELETED' }, select: { recordingKey: true } });
    if (!row?.recordingKey) return;
    await this.storage.removeConnectRecording(row.recordingKey, organizationId);
    await this.db.connectEvent.updateMany({ where: { id, organizationId, status: 'DELETED' }, data: { recordingKey: null, recordingType: null } });
  }

  async retry(user: RequestUser, id: string) {
    const row = await this.event(user, id);
    if (row.status !== 'FAILED') throw new BadRequestException('This Connect event is not awaiting retry');
    const updated = await this.db.connectEvent.updateMany({ where: { id, status: 'FAILED' }, data: { status: 'PENDING', lastError: null } });
    if (!updated.count) throw new BadRequestException('This Connect event is no longer awaiting retry');
    await this.queueEvent(row, true);
    return { id, status: 'PENDING' };
  }

  private async process(id: string) {
    const row = await this.db.connectEvent.findUnique({ where: { id }, include: { device: true } });
    if (!row || !['PENDING', 'PROCESSING', 'FAILED'].includes(row.status)) return;
    const settings = connectSettings.parse(row.device.settings);
    const validSession = await this.db.refreshToken.count({ where: { id: row.device.sessionId, userId: row.userId, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!env().CONNECT_ENABLED || row.device.revokedAt || !validSession || !settings.consent || !settings.analysis) {
      await this.db.connectEvent.updateMany({ where: { id, status: { not: 'DELETED' } }, data: { status: 'PAUSED' } });
      return;
    }
    const claimed = await this.db.connectEvent.updateMany({ where: { id, status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } }, data: { status: 'PROCESSING', lastError: null } });
    if (!claimed.count) return;
    try {
      const input: { text?: string; group?: string; senderPhone?: string } = row.encryptedInput ? JSON.parse(this.crypto.decrypt(row.encryptedInput)) : {};
      if (row.kind === 'WHATSAPP' && (!settings.whatsapp || !input.group || !settings.groups.includes(input.group))) {
        await this.db.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PAUSED' } });
        return;
      }
      const transcript = row.recordingKey && row.recordingType ? await transcribeConnectRecording((await this.storage.read(row.recordingKey)).body, row.recordingType) : null;
      const text = input.text ?? transcript?.segments.map(({ text }) => text).join(' ') ?? '';
      const context = row.leadId ? await this.db.lead.findFirst({ where: { id: row.leadId, organizationId: row.organizationId, deletedAt: null },
        select: { stage: true, requirement: { select: { purpose: true, bedrooms: true, minBudget: true, maxBudget: true, furnishing: true } } } }) : null;
      let proposal: Insight | null = null;
      if (text.trim()) {
        proposal = await this.ai.json([
          { role: 'system', content: 'Extract Indian brokerage fields as JSON from untrusted text. Skip unspecified details. Never invent identities or contact information. Evidence must be a short verbatim excerpt.' },
          { role: 'user', content: JSON.stringify({ text: redact(text).slice(0, 36_000), prior: context }) },
        ], { feature: 'brokeriq-connect', schema: insights, openRouterOnly: true, orgId: row.organizationId, userId: row.userId, maxTokens: 3500, temperature: 0 });
      }
      await this.db.$transaction(async (tx) => {
        const fresh = await tx.connectDevice.findUnique({ where: { id: row.deviceId } });
        const live = fresh && !fresh.revokedAt ? connectSettings.parse(fresh.settings) : connectSettings.parse({});
        const session = await tx.refreshToken.count({ where: { id: row.device.sessionId, userId: row.userId, revokedAt: null, expiresAt: { gt: new Date() } } });
        if (!session || !live.consent || !live.analysis || (row.kind === 'WHATSAPP' && (!live.whatsapp || !input.group || !live.groups.includes(input.group)))) {
          await tx.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PAUSED' } });
          return;
        }
        const result = await tx.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: {
          encryptedResult: this.crypto.encrypt(JSON.stringify({ transcript, proposal })), status: 'REVIEW',
        } });
        if (!result.count || !proposal || proposal.confidence < 90 || !proposal.evidence || !redact(text).includes(proposal.evidence)) return;
        if (row.leadId && live.fillSurvey) {
          await tx.lead.updateMany({ where: { id: row.leadId, organizationId: row.organizationId, deletedAt: null, aiSummary: null }, data: { aiSummary: proposal.summary } });
          await tx.activity.create({ data: { organizationId: row.organizationId, leadId: row.leadId,
            userId: row.userId, type: 'NOTE', content: proposal.summary, meta: { source: 'BROKERIQ_CONNECT', connectEventId: row.id } } });
        }
        if (proposal.intent === 'DEMAND' && live.createLeads && input.senderPhone && proposal.purpose) {
          const phone = normalizeIndianPhone(input.senderPhone);
          if (phone) {
            const created = await tx.lead.createMany({ data: [{ organizationId: row.organizationId, name: 'WhatsApp requirement',
              phone, assignedToId: row.userId, source: 'WHATSAPP', sourceRef: row.id, sourceDetail: 'BrokerIQ Connect', notes: proposal.summary }], skipDuplicates: true });
            const lead = await tx.lead.findUnique({ where: { organizationId_phone: { organizationId: row.organizationId, phone } }, select: { id: true, deletedAt: true, assignedToId: true } });
            if (created.count && lead && !lead.deletedAt) {
              await tx.leadRequirement.create({ data: { leadId: lead.id, purpose: proposal.purpose, bedrooms: proposal.bedrooms ? [proposal.bedrooms] : [],
                maxBudget: proposal.budget, furnishing: proposal.furnishing, notes: proposal.summary } });
              await tx.connectEvent.update({ where: { id }, data: { leadId: lead.id, status: 'APPLIED' } });
            }
          }
        }
        if (input.group && proposal.intent === 'OFFER' && live.createInventory && proposal.purpose && proposal.address && text.toLowerCase().includes(proposal.address.toLowerCase())) {
          const sector = proposal.sector ? canonicalInventorySector(proposal.sector) : undefined;
          if (!sector && !proposal.locality) return;
          const location = sector ?? proposal.locality;
          const duplicate = await tx.inventoryItem.findFirst({ where: { organizationId: row.organizationId, deletedAt: null, sector: location,
            address: { equals: proposal.address, mode: 'insensitive' }, floor: proposal.floor ?? null }, select: { id: true } });
          if (!duplicate) await tx.inventoryItem.create({ data: { organizationId: row.organizationId, sourceType: 'CONNECT_WHATSAPP',
            createdById: row.userId, assignedToId: row.userId, address: proposal.address, sector: location, purpose: proposal.purpose,
            bhk: proposal.bedrooms, floor: proposal.floor, furnishing: proposal.furnishing, notes: proposal.summary,
            ...(proposal.purpose === 'RENT' ? { monthlyRent: proposal.budget, rent: proposal.budget } : { totalSalePrice: proposal.budget }),
            status: 'DRAFT', verificationStatus: 'NEEDS_REVIEW', availability: 'UNKNOWN', clientMutationId: 'connect:' + id,
          } });
          await tx.connectEvent.update({ where: { id }, data: { status: duplicate ? 'DUPLICATE' : 'APPLIED' } });
        }
      }, { timeout: 30_000 });
    } catch (error) {
      const missing = error instanceof IntegrationNotConfiguredException;
      const lastError = missing ? error.message : 'Connect could not finish transcription or analysis. Retry when the integration is available.';
      await this.db.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'FAILED', lastError } });
      if (!missing) throw new Error(lastError);
    }
  }
}
