import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { canonicalInventorySector, connectSurveyValuesSchema, normalizeIndianPhone, hasDelegatedAccess, storedRolePermissions, type ConnectDestination, type ConnectSurveyField } from '@brokeriq/shared';
import { z } from 'zod';
import { env } from '../../config/env';
import type { RequestUser } from '../../common/decorators';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import { requireOrg } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { JobDeferred, JobsService } from '../../core/jobs/jobs.service';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { CryptoService } from '../../core/settings/crypto.service';
import { AiService, OpenRouterQuotaDeferred } from '../../core/ai/ai.service';
import { AuthService } from '../auth/auth.service';
import { connectFirmPolicy, connectSettings, type ConnectCapture, type ConnectFirmPolicy, type ConnectRecording, type ConnectRegistration, type ConnectSettings } from './connect.schemas';
import { transcribeConnectRecording } from './connect-transcription';
import { customSurveySuggestions } from './connect-survey';

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const privateMessage = /\b(?:otp|password|passcode|one.time (?:code|password)|verification code|security code|authentication code|do not share|bank account|credited|debited)\b/i;
const redact = (text: string) => text.replace(/(?:\+?91[\s.-]*)?[6-9](?:[\s.-]*\d){9}\b/g, '[contact]')
  .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[contact]');
const firmPolicyKey = 'connect.automatic_updates';
const canViewConnectTarget = (user: RequestUser, module: 'leads' | 'inventory') =>
  hasDelegatedAccess(user.delegatedActor ? { ...user, role: 'SUB_BROKER_ADMIN' } : user, module, 'view');
const apkTicket = z.object({
  purpose: z.literal('connect-apk'), sessionId: z.string().min(1), userId: z.string().min(1),
  version: z.number().int().positive(), expiresAt: z.number().int(),
});
const eventProjection = {
  id: true, userId: true, kind: true, status: true, capturedAt: true, updatedAt: true, leadId: true, callId: true, lastError: true, recordingType: true,
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
  audience: z.enum(['BUYER', 'TENANT', 'SELLER', 'LANDLORD', 'BROKER', 'UNKNOWN']).optional(),
  urgency: z.enum(['IMMEDIATE', 'SOON', 'FLEXIBLE']).optional(),
  recommendedAction: z.object({
    kind: z.enum(['FOLLOW_UP', 'SITE_VISIT']),
    note: z.string().min(1).max(250),
    evidence: z.string().min(6).max(300),
    at: z.iso.datetime({ offset: true }).optional(),
  }).optional(),
  evidence: z.string().max(500).optional(),
});
type Insight = z.infer<typeof insights>;
type Transcript = Awaited<ReturnType<typeof transcribeConnectRecording>>;


@Injectable()
export class ConnectService {
  constructor(private readonly db: PrismaService, private readonly jobs: JobsService, private readonly storage: LocalStorageService,
    private readonly crypto: CryptoService, private readonly ai: AiService, private readonly auth: AuthService) {
    jobs.register('connect.process', (job) => this.process(job.id));
    jobs.register('connect.purge', (job) => this.purgeRecording(job.id, job.orgId));
    jobs.register('connect.retention', (job) => this.expireCaptures(job.orgId, new Date(job.at)));
  }

  async profile(user: RequestUser, sessionId: string) {
    const options = env();
    const devices = await this.db.connectDevice.findMany({ where: { userId: user.id, organizationId: user.orgId ?? '', revokedAt: null },
      select: { id: true, label: true, version: true, lastSeenAt: true, consentAt: true, sessionId: true }, orderBy: { lastSeenAt: 'desc' } });
    const sessions = devices.length ? await this.db.refreshToken.findMany({ where: { id: { in: devices.map(({ sessionId }) => sessionId) },
      userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } }) : [];
    const connected = devices.filter(({ sessionId }) => sessions.some(({ id }) => id === sessionId)).map(({ sessionId: _session, ...device }) => device);
    const canManagePolicy = user.role === 'BROKER_ADMIN' && !user.delegatedActor && !!user.orgId;
    const policy = options.CONNECT_ENABLED && canManagePolicy ? await this.firmPolicy(this.db, user.orgId!) : undefined;
    const locallyHosted = await this.localApk();
    const ticket = locallyHosted && this.crypto.encrypt(JSON.stringify({ purpose: 'connect-apk', sessionId, userId: user.id,
      expiresAt: Date.now() + 5 * 60_000, version: options.CONNECT_APK_VERSION }));
    const downloadUrl = ticket ? options.PUBLIC_API_URL.replace(/\/$/, '') + '/api/media/connect-apk/' + encodeURIComponent(ticket) : options.CONNECT_APK_URL ?? null;
    return { downloadUrl, latestVersion: options.CONNECT_APK_VERSION,
      enabled: options.CONNECT_ENABLED, devices: connected, policy };
  }

  private async localApk() {
    const path = env().CONNECT_APK_PATH;
    if (!path) return null;
    const file = await stat(path).catch(() => null);
    return file?.isFile() && file.size > 0 ? path : null;
  }

  async downloadApk(ticket: string) {
    const unavailable = () => new NotFoundException('This Connect download link has expired. Open BrokerIQ Connect again to get a new link.');
    if (ticket.length > 1024 || ticket.split(':').length !== 4) throw unavailable();
    let access: z.infer<typeof apkTicket>;
    try { access = apkTicket.parse(JSON.parse(this.crypto.decrypt(ticket))); }
    catch { throw unavailable(); }
    if (access.expiresAt <= Date.now() || access.version !== env().CONNECT_APK_VERSION) throw unavailable();
    const session = await this.db.refreshToken.findFirst({
      where: { id: access.sessionId, userId: access.userId, expiresAt: { gt: new Date() }, revokedAt: null, user: { status: 'ACTIVE', deletedAt: null } },
      select: { sessionVersion: true, user: { select: { sessionVersion: true, role: true, organization: { select: { status: true } } } } },
    });
    if (!session || session.sessionVersion !== session.user.sessionVersion ||
      (session.user.role !== 'SUPER_ADMIN' && session.user.organization?.status === 'SUSPENDED')) throw unavailable();
    const path = await this.localApk();
    if (!path) throw unavailable();
    return path;
  }

  private async firmPolicy(tx: Prisma.TransactionClient, organizationId: string) {
    const setting = await tx.orgSetting.findUnique({ where: { organizationId_key: { organizationId, key: firmPolicyKey } }, select: { value: true } });
    return connectFirmPolicy.parse(setting?.value ?? {});
  }

  async updateFirmPolicy(user: RequestUser, input: Partial<ConnectFirmPolicy>) {
    if (user.role !== 'BROKER_ADMIN' || user.delegatedActor) throw new ForbiddenException('Only the firm Broker Admin can configure automatic Connect updates');
    const organizationId = this.assertCaptureAllowed(user);
    const where = { organizationId, key: firmPolicyKey };
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId + ':' + firmPolicyKey}))`;
      if (!(await tx.user.count({ where: { id: user.id, organizationId, role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null } }))) {
        throw new ForbiddenException('Firm membership changed');
      }
      const policy = { ...(await this.firmPolicy(tx, organizationId)), ...input };
      await tx.orgSetting.upsert({ where: { organizationId_key: where },
        create: { ...where, value: policy, updatedById: user.id }, update: { value: policy, updatedById: user.id } });
      await tx.auditLog.create({ data: { actorId: user.id, actorRole: user.role, organizationId,
        action: 'connect.firm_policy', entity: 'Organization', entityId: organizationId, meta: policy } });
      return policy;
    });
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
        action: 'connect.consent', meta: { enabled: settings.consent, groupCount: settings.groups.length, calls: settings.calls,
          recordings: settings.recordings, whatsapp: settings.whatsapp, allWhatsapp: settings.allWhatsapp,
          unmatchedCalls: settings.unmatchedCalls, smsNotifications: settings.smsNotifications } } });
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
    if (!canViewConnectTarget(user, 'leads')) throw new ForbiddenException('Lead viewing access is required');
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

  async deviceCalls(user: RequestUser, sessionId: string) {
    const device = await this.device(user, sessionId);
    const grants = connectSettings.parse(device.settings);
    if (!grants.consent || (!grants.calls && !grants.recordings)) return { items: [] };
    const calls = await this.db.call.findMany({
      where: { organizationId: device.organizationId, agentId: user.id, source: 'BROKERIQ_CONNECT', lead: { is: this.leadScope(user) } },
      select: { id: true, startedAt: true, direction: true, fromNumber: true, toNumber: true, durationSec: true,
        status: true, lead: { select: { name: true } } },
      take: 100, orderBy: { startedAt: 'desc' },
    });
    const events = await this.db.connectEvent.findMany({ where: { organizationId: device.organizationId, userId: user.id,
      callId: { in: calls.map(({ id }) => id) }, kind: 'CALL', status: { not: 'DELETED' } },
      select: { callId: true, deviceId: true, status: true, encryptedInput: true } });
    const byCall = new Map(events.map((event) => [event.callId, event]));
    return { items: calls.flatMap(({ fromNumber, toNumber, lead, ...call }) => {
      const event = byCall.get(call.id);
      if (!event) return [];
      const simLabel = event.encryptedInput ? (JSON.parse(this.crypto.decrypt(event.encryptedInput)) as { simLabel?: string }).simLabel : undefined;
      return [{ ...call, leadName: lead?.name, number: fromNumber ?? toNumber, simLabel,
        sameDevice: event.deviceId === device.id, processingStatus: event.status }];
    }) };
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
    const message = input.kind === 'WHATSAPP' || input.kind === 'SMS' ? input : null;
    const payload = message ? { ...message, senderPhone: normalizeIndianPhone(message.senderPhone) ?? undefined } : input;
    let fingerprint: string;
    if (input.kind === 'CALL') {
      if (!settings.calls) throw new ForbiddenException('Call capture is disabled');
      fingerprint = sha(['call', user.id, input.leadId, input.direction, at.valueOf()].join('|'));
    } else if (input.kind === 'UNMATCHED_CALL') {
      if (!settings.calls || !settings.unmatchedCalls) throw new ForbiddenException('Unmatched call capture is disabled');
      fingerprint = sha(['unmatched-call', user.id, input.number, input.direction, at.valueOf()].join('|'));
    } else {
      if (privateMessage.test(input.text) || !this.messageAllowed(settings, input.kind, input.group))
        throw new ForbiddenException('This notification is outside the approved capture settings');
      const scope = input.kind === 'SMS' || !settings.groups.includes(input.group) ? [user.id] : [];
      fingerprint = sha([input.kind.toLowerCase(), ...scope, input.group, at.valueOf(), input.text].join('|'));
    }
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
        encryptedInput: input.kind === 'CALL'
          ? (input.simLabel ? this.crypto.encrypt(JSON.stringify({ simLabel: input.simLabel })) : null)
          : this.crypto.encrypt(JSON.stringify(payload)),
        status: message && settings.analysis ? 'PENDING' : 'SAVED',
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

  private messageAllowed(settings: ConnectSettings, kind: string, group?: string) {
    if (kind === 'SMS') return settings.smsNotifications;
    if (kind === 'WHATSAPP') return settings.whatsapp && (settings.allWhatsapp || Boolean(group && settings.groups.includes(group)));
    return true;
  }

  private queueEvent(event: { id: string; organizationId: string }, retry = false) {
    return this.jobs.enqueue('connect.process', { id: event.id, orgId: event.organizationId }, { key: 'connect:' + event.id, repeat: retry });
  }

  private eventScope(user: RequestUser, leadId?: string): Prisma.ConnectEventWhereInput {
    return { organizationId: requireOrg(user), leadId, status: { not: 'DELETED' }, ...(user.role === 'BROKER_AGENT' ? { userId: user.id } : {}) };
  }

  async activity(user: RequestUser, leadId?: string, after?: string) {
    if (leadId && !(await this.db.lead.findFirst({ where: { id: leadId, ...this.leadScope(user) }, select: { id: true } }))) throw new NotFoundException('Lead not found');
    const scope = this.eventScope(user, leadId);
    const cursor = after ? await this.db.connectEvent.findFirst({ where: { ...scope, id: after }, select: { capturedAt: true, id: true } }) : null;
    if (after && !cursor) throw new NotFoundException('Connect activity page expired. Refresh the list.');
    const rows = await this.db.connectEvent.findMany({
      where: { ...scope, ...(cursor ? { OR: [{ capturedAt: { lt: cursor.capturedAt } }, { capturedAt: cursor.capturedAt, id: { lt: cursor.id } }] } : {}) },
      select: eventProjection, take: 101, orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
    });
    const batch = rows.slice(0, 100);
    const ids = [...new Set(batch.flatMap(({ leadId: id }) => id ? [id] : []))];
    const visible = new Set(ids.length && canViewConnectTarget(user, 'leads') ? (await this.db.lead.findMany({
      where: { id: { in: ids }, ...this.leadScope(user) }, select: { id: true },
    })).map(({ id }) => id) : []);
    return { nextCursor: rows.length > 100 ? batch.at(-1)?.id : undefined, items: batch.filter(({ leadId: id }) => !id || visible.has(id))
      .map(({ recordingType, ...row }) => ({ ...row, recording: Boolean(recordingType) })) };
  }

  private async event(user: RequestUser, id: string) {
    const event = await this.db.connectEvent.findFirst({ where: { id, ...this.eventScope(user) } });
    if (!event || (event.leadId && (!canViewConnectTarget(user, 'leads') ||
      !(await this.db.lead.findFirst({ where: { id: event.leadId, ...this.leadScope(user) }, select: { id: true } }))))) {
      throw new NotFoundException('Connect activity not found');
    }
    return event;
  }

  async detail(user: RequestUser, id: string) {
    const row = await this.event(user, id);
    const [owner, device, call, recordings] = await Promise.all([
      this.db.user.findFirst({ where: { id: row.userId, organizationId: row.organizationId }, select: { name: true } }),
      this.db.connectDevice.findFirst({ where: { id: row.deviceId, organizationId: row.organizationId }, select: { label: true } }),
      row.callId ? this.db.call.findFirst({ where: { id: row.callId, organizationId: row.organizationId }, select: {
        direction: true, status: true, durationSec: true, fromNumber: true, toNumber: true,
      } }) : null,
      row.kind === 'CALL' && row.callId ? this.db.connectEvent.findMany({
        where: { ...this.eventScope(user), callId: row.callId, kind: 'RECORDING', recordingKey: { not: null } },
        select: { id: true, capturedAt: true, status: true }, orderBy: { capturedAt: 'asc' },
      }) : [],
    ]);
    const stored: Record<string, unknown> = row.encryptedResult ? JSON.parse(this.crypto.decrypt(row.encryptedResult)) : {};
    const input: Record<string, unknown> = row.encryptedInput ? JSON.parse(this.crypto.decrypt(row.encryptedInput)) : {};
    const destinations = (Array.isArray(stored.destinations) ? stored.destinations as ConnectDestination[] : [])
      .filter((target) => target.module === 'Inventory' || target.module === 'Survey'
        ? canViewConnectTarget(user, 'inventory')
        : canViewConnectTarget(user, 'leads'));
    if (row.kind === 'CALL' && call && canViewConnectTarget(user, 'leads')) {
      destinations.unshift({ module: 'Calls', label: 'Call logged in the lead timeline', recordId: row.callId! });
    }
    const direction = call?.direction === 'inbound' ? 'INBOUND' : 'OUTBOUND';
    return { id: row.id, kind: row.kind, status: row.status, capturedAt: row.capturedAt, lastError: row.lastError,
      recording: Boolean(row.recordingKey), capturedBy: owner?.name ?? null, deviceLabel: device?.label ?? null, destinations, recordings,
      capturedMessage: typeof input.text === 'string' ? {
        text: input.text, senderPhone: typeof input.senderPhone === 'string' ? input.senderPhone : null,
        app: input.packageName === 'com.whatsapp.w4b' ? 'WhatsApp Business' : row.kind === 'WHATSAPP' ? 'WhatsApp' : 'SMS',
      } : null,
      details: {
        ...stored, destinations: undefined,
        survey: canViewConnectTarget(user, 'inventory') ? stored.survey : undefined,
        ...(call ? { call: { direction, outcome: call.status.toUpperCase(),
          number: direction === 'INBOUND' ? call.fromNumber : call.toNumber,
          durationSec: call.durationSec ?? undefined, simLabel: input.simLabel } } :
          row.kind === 'UNMATCHED_CALL' ? { call: input } : {}),
      },
    };
  }

  async playback(user: RequestUser, id: string) {
    const row = await this.event(user, id);
    if (!row.recordingKey) throw new NotFoundException('Recording unavailable');
    return this.storage.read(row.recordingKey);
  }

  async review(user: RequestUser, id: string, decision: 'REVIEWED' | 'DISMISSED') {
    const event = await this.event(user, id);
    if (event.status === decision) return { id, status: decision };
    return this.db.$transaction(async (tx) => {
      const changed = await tx.connectEvent.updateMany({ where: { id, organizationId: event.organizationId, status: 'REVIEW' }, data: { status: decision } });
      if (!changed.count) throw new BadRequestException('This suggestion is no longer awaiting review');
      await tx.auditLog.create({ data: { actorId: user.id, actorRole: user.delegatedActor ? 'SUB_BROKER_ADMIN' : user.role,
        organizationId: event.organizationId, action: 'connect.event.review', entity: 'ConnectEvent', entityId: id, meta: { decision } } });
      return { id, status: decision };
    });
  }

  async remove(user: RequestUser, id: string) {
    if (user.role !== 'BROKER_ADMIN' || user.delegatedActor) {
      throw new ForbiddenException('Only the firm Broker Admin can delete Connect captures');
    }
    const event = await this.db.connectEvent.findFirst({ where: { id, organizationId: requireOrg(user) } });
    if (!event) throw new NotFoundException('Connect activity not found');
    if (event.status !== 'DELETED') await this.event(user, id);
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR SHARE`;
      if (!(await tx.user.count({ where: { id: user.id, organizationId: event.organizationId,
        role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null } }))) throw new ForbiddenException('Firm membership changed');
      const removed = await tx.connectEvent.updateMany({ where: { id, organizationId: event.organizationId, status: { not: 'DELETED' } },
        data: { status: 'DELETED', encryptedInput: null, encryptedResult: null, lastError: null } });
      if (removed.count) await tx.auditLog.create({ data: { actorId: user.id, actorRole: user.role,
        organizationId: event.organizationId, action: 'connect.event.delete', entity: 'ConnectEvent', entityId: id } });
    });
    if (event.recordingKey) await this.jobs.enqueue('connect.purge', { id, orgId: event.organizationId }, { key: 'connect-purge:' + id, repeat: true });
    return { ok: true };
  }

  @Cron('0 15 2 * * *', { timeZone: 'Asia/Kolkata' })
  async scheduleRetention() {
    const flags = env();
    if (!flags.JOBS_ENABLED || !flags.CONNECT_ENABLED) return;
    const now = new Date();
    const day = new Date(now.valueOf() + 330 * 60_000).toISOString().slice(0, 10);
    const settings = await this.db.orgSetting.findMany({ where: { key: firmPolicyKey, organization: { status: 'ACTIVE' } },
      select: { organizationId: true, value: true } });
    for (const { organizationId, value } of settings) {
      if (!connectFirmPolicy.safeParse(value).data?.retentionDays) continue;
      await this.jobs.enqueue('connect.retention', { orgId: organizationId, at: now.toISOString() },
        { key: 'connect:retention:' + organizationId + ':' + day });
    }
  }

  private async expireCaptures(organizationId: string, now: Date) {
    if (!env().CONNECT_ENABLED) return;
    let more = true;
    while (more) {
      more = await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId + ':' + firmPolicyKey}))`;
        const { retentionDays } = await this.firmPolicy(tx, organizationId);
        if (!retentionDays) return false;
        const expired = await tx.$queryRaw<{ id: string; recordingKey: string | null }[]>`
          SELECT id, "recordingKey" FROM "ConnectEvent"
          WHERE "organizationId" = ${organizationId} AND status <> 'DELETED'
            AND "capturedAt" < ${new Date(now.valueOf() - retentionDays * 86_400_000)}
          ORDER BY "capturedAt", id LIMIT 100 FOR UPDATE SKIP LOCKED`;
        if (!expired.length) return false;
        await tx.connectEvent.updateMany({ where: { id: { in: expired.map(({ id }) => id) } },
          data: { status: 'DELETED', encryptedInput: null, encryptedResult: null, lastError: null } });
        await tx.auditLog.createMany({ data: expired.map(({ id }) => ({ organizationId, action: 'connect.event.retention',
          entity: 'ConnectEvent', entityId: id, meta: { retentionDays } })) });
        const recordings = expired.flatMap(({ id, recordingKey }) => recordingKey
          ? [{ type: 'connect.purge', key: 'connect-purge:' + id, payload: { id, orgId: organizationId } }] : []);
        if (recordings.length) await tx.job.createMany({ data: recordings, skipDuplicates: true });
        return expired.length === 100;
      });
    }
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

  private async surveySuggestions(tx: Prisma.TransactionClient, row: { id: string; leadId: string; userId: string; organizationId: string },
    proposal: Insight, original: string, allowApply: boolean, definitions: ConnectSurveyField[] = []) {
    if (proposal.intent !== 'OFFER' || !proposal.address || !original.toLowerCase().includes(proposal.address.toLowerCase())) return [];
    const member = await tx.user.findFirst({ where: { id: row.userId, organizationId: row.organizationId, status: 'ACTIVE', deletedAt: null },
      select: { role: true, delegatedPermissions: true } });
    if (!member || !['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(member.role)) return [];
    if (member.role === 'SUB_BROKER_ADMIN' && !['inventory:view', 'inventory:edit'].every((grant) => member.delegatedPermissions.includes(grant))) return [];
    const owners = member.role === 'BROKER_AGENT' ? { OR: [{ createdById: row.userId }, { assignedToId: row.userId }] } : {};
    const matches = await tx.inventoryItem.findMany({ where: {
      organizationId: row.organizationId, deletedAt: null, address: { equals: proposal.address, mode: 'insensitive' },
      visits: { some: { leadId: row.leadId, organizationId: row.organizationId,
        lead: { deletedAt: null, ...(member.role === 'BROKER_AGENT' ? { assignedToId: row.userId } : {}) } } }, ...owners,
    }, take: 2, select: { id: true, furnishing: true, floor: true, bhk: true, purpose: true, status: true, verificationStatus: true,
      publishedListingId: true, revision: true, connectSurveyFields: true, sourceType: true } });
    if (matches.length !== 1) return [];
    const survey = matches[0];
    const evidence = proposal.evidence ?? '';
    const floor = proposal.floor?.trim().replace(/[^a-zA-Z0-9 ]/g, '');
    const evidenceFloor = floor && /\bfloor\b/i.test(floor) ? new RegExp(`\\b${floor}\\b`, 'i') : floor
      ? new RegExp(`\\b(?:${floor}(?:st|nd|rd|th)?\\s+floor|floor\\s+${floor})\\b`, 'i') : null;
    const standard = [
      { field: 'bhk' as const, proposed: proposal.bedrooms, verified: new RegExp(`\\b${proposal.bedrooms}\\s*BHK\\b`, 'i').test(evidence) },
      { field: 'floor' as const, proposed: proposal.floor, verified: Boolean(evidenceFloor?.test(evidence)) },
      { field: 'purpose' as const, proposed: proposal.purpose, verified: proposal.purpose === 'RENT' ? /\brent(?:al)?\b/i.test(evidence) : /\bfor sale\b/i.test(evidence) },
    ].flatMap(({ field, proposed, verified }) => proposed === undefined ? [] : [{
      field, proposed, previous: survey[field], conflict: survey[field] !== null && survey[field] !== proposed,
      verified, confidence: proposal.confidence, evidence, inventoryId: survey.id, applied: false,
    }]);
    const stored = connectSurveyValuesSchema.safeParse(survey.connectSurveyFields).data ?? {};
    const custom = survey.sourceType === 'SURVEY' ? customSurveySuggestions(definitions, stored, redact(original), proposal.confidence)
      .map((field) => ({ ...field, inventoryId: survey.id })) : [];
    const suggestions = [...standard, ...custom];
    const emptyVerified = (suggestion: (typeof suggestions)[number]) => suggestion.verified && suggestion.previous === null && !suggestion.conflict;
    const fill = standard.filter(emptyVerified);
    const customFill = custom.filter((field) => emptyVerified(field) && evidence.includes(field.evidence));
    if (!allowApply || !evidence.toLowerCase().includes(proposal.address.toLowerCase()) || (!fill.length && !customFill.length) ||
      survey.sourceType !== 'SURVEY' || survey.status !== 'DRAFT' || survey.verificationStatus !== 'NEEDS_REVIEW' || survey.publishedListingId) return suggestions;
    const fields = Object.fromEntries(fill.map(({ field, proposed }) => [field, proposed]));
    const customValues = Object.fromEntries(customFill.map(({ field, label, proposed }) => [field.slice('custom:'.length), { label, value: proposed }]));
    const changed = await tx.inventoryItem.updateMany({
      where: { id: survey.id, organizationId: row.organizationId, revision: survey.revision, sourceType: 'SURVEY', deletedAt: null, ...owners },
      data: { ...fields, ...(customFill.length ? { connectSurveyFields: { ...stored, ...customValues } } : {}), revision: { increment: 1 } },
    });
    if (changed.count) {
      for (const field of [...fill, ...customFill]) field.applied = true;
      await tx.auditLog.create({ data: { actorId: row.userId, actorRole: member.role, organizationId: row.organizationId,
        action: 'connect.survey.fill', entity: 'InventoryItem', entityId: survey.id, meta: { eventId: row.id, fields: [...fill, ...customFill].map(({ field }) => field) } } });
    }
    return suggestions;
  }

  private supportedRecommendation(proposal: Insight, text: string, capturedAt: Date) {
    const action = proposal.recommendedAction;
    if (!action || !text.includes(action.evidence)) return undefined;
    const time = action.at ? new Date(action.at) : null;
    return { ...action, at: time && time > capturedAt && time.valueOf() - capturedAt.valueOf() < 90 * 86_400_000 ? time.toISOString() : undefined };
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
      if (!this.messageAllowed(settings, row.kind, input.group)) {
        await this.db.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PAUSED' } });
        return;
      }
      const checkpoint: { transcript?: Transcript | null } = row.encryptedResult ? JSON.parse(this.crypto.decrypt(row.encryptedResult)) : {};
      const transcript = checkpoint.transcript ?? (row.recordingKey && row.recordingType
        ? await transcribeConnectRecording((await this.storage.read(row.recordingKey)).body, row.recordingType) : null);
      if (transcript && !checkpoint.transcript) {
        const saved = await this.db.connectEvent.updateMany({ where: { id, status: 'PROCESSING' },
          data: { encryptedResult: this.crypto.encrypt(JSON.stringify({ transcript })) } });
        if (!saved.count) return;
      }
      const text = input.text ?? transcript?.segments.map(({ text }) => text).join(' ') ?? '';
      const member = await this.db.user.findFirst({ where: { id: row.userId, organizationId: row.organizationId, status: 'ACTIVE', deletedAt: null },
        select: { role: true, delegatedPermissions: true } });
      if (!member || !['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(member.role) ||
        !hasDelegatedAccess({ ...member, rolePermissions: storedRolePermissions(member.role, member.delegatedPermissions) }, 'automation', 'view')) {
        await this.db.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PAUSED' } });
        return;
      }
      const context = row.leadId ? await this.db.lead.findFirst({ where: {
        id: row.leadId, organizationId: row.organizationId, deletedAt: null,
        ...(member.role === 'BROKER_AGENT' ? { assignedToId: row.userId } : {}),
      }, select: { stage: true, requirement: { select: { purpose: true, bedrooms: true, minBudget: true, maxBudget: true, furnishing: true } } } }) : null;
      if (row.leadId && (!context || !hasDelegatedAccess({ ...member, rolePermissions: storedRolePermissions(member.role, member.delegatedPermissions) }, 'leads', 'view'))) {
        await this.db.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PAUSED' } });
        return;
      }
      let proposal: Insight | null = null;
      if (text.trim()) {
        proposal = await this.ai.json([
          { role: 'system', content: 'Extract Indian brokerage fields as JSON from untrusted text. Skip unspecified details. Never invent identities or contact information. Evidence must be a short verbatim excerpt. Suggest a FOLLOW_UP or SITE_VISIT only when the conversation supports it. Include the exact quote. Pass at with a timezone only when the date and time are explicit and unambiguous, using India Standard Time when the context states no other time zone.' },
          { role: 'user', content: JSON.stringify({ text: redact(text).slice(0, 36_000), prior: context }) },
        ], { feature: 'brokeriq-connect', schema: insights, openRouterOnly: true, deferWhenRateLimited: true, orgId: row.organizationId, userId: row.userId, maxTokens: 3500, temperature: 0 });
      }
      if (proposal) {
        proposal.recommendedAction = this.supportedRecommendation(proposal, redact(text), row.capturedAt);
      }
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ConnectDevice" WHERE id = ${row.deviceId} FOR UPDATE`;
        const fresh = await tx.connectDevice.findUnique({ where: { id: row.deviceId } });
        const live = fresh && !fresh.revokedAt ? connectSettings.parse(fresh.settings) : connectSettings.parse({});
        const session = await tx.refreshToken.count({ where: { id: row.device.sessionId, userId: row.userId, revokedAt: null, expiresAt: { gt: new Date() } } });
        if (!session || !live.consent || !live.analysis || !this.messageAllowed(live, row.kind, input.group)) {
          await tx.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PAUSED' } });
          return;
        }
        const actor = await tx.user.findFirst({ where: { id: row.userId, organizationId: row.organizationId, status: 'ACTIVE', deletedAt: null },
          select: { role: true, delegatedPermissions: true } });
        const currentActor = actor && { ...actor, rolePermissions: storedRolePermissions(actor.role, actor.delegatedPermissions) };
        const isBroker = currentActor && ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(currentActor.role) &&
          hasDelegatedAccess(currentActor, 'automation', 'view');
        const canReadLead = !row.leadId || (isBroker && hasDelegatedAccess(currentActor, 'leads', 'view') &&
          await tx.lead.count({ where: { id: row.leadId, organizationId: row.organizationId, deletedAt: null,
            ...(currentActor.role === 'BROKER_AGENT' ? { assignedToId: row.userId } : {}) } }));
        if (!isBroker || !canReadLead) {
          await tx.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PAUSED' } });
          return;
        }
        const destinations: ConnectDestination[] = [];
        const details: { transcript: Transcript | null; proposal: Insight | null; destinations: ConnectDestination[];
          survey?: Awaited<ReturnType<ConnectService['surveySuggestions']>> } = { transcript, proposal, destinations };
        const encrypted = () => this.crypto.encrypt(JSON.stringify(details));
        const result = await tx.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: {
          encryptedResult: encrypted(), status: 'REVIEW',
        } });
        if (!result.count || !proposal) return;
        // Broader inbox capture creates review suggestions. Approved conversations retain existing automation.
        if (row.kind === 'SMS' || (row.kind === 'WHATSAPP' && (!input.group || !live.groups.includes(input.group)))) return;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.organizationId + ':' + firmPolicyKey}))`;
        const policy = await this.firmPolicy(tx, row.organizationId);
        const eligible = proposal.confidence >= 90 && Boolean(proposal.evidence && redact(text).includes(proposal.evidence));
        if (row.leadId && live.fillSurvey) {
          const survey = await this.surveySuggestions(tx, { ...row, leadId: row.leadId }, proposal, text, eligible && policy.survey && hasDelegatedAccess(currentActor, 'inventory', 'view', 'edit'), policy.surveyFields);
          if (survey.length) {
            details.survey = survey;
            const applied = survey.find((field) => field.applied);
            if (applied) destinations.push({ module: 'Survey', label: 'Verified fields saved', recordId: applied.inventoryId });
            await tx.connectEvent.update({ where: { id }, data: { encryptedResult: encrypted(), status: applied ? 'APPLIED' : 'REVIEW' } });
          }
        }
        if (!eligible) return;
        if (row.leadId && live.fillSurvey && policy.survey && hasDelegatedAccess(currentActor, 'leads', 'view', 'edit')) {
          const summary = await tx.lead.updateMany({ where: { id: row.leadId, organizationId: row.organizationId, deletedAt: null, aiSummary: null }, data: { aiSummary: proposal.summary } });
          const activity = await tx.activity.create({ data: { organizationId: row.organizationId, leadId: row.leadId,
            userId: row.userId, type: 'NOTE', content: proposal.summary, meta: { source: 'BROKERIQ_CONNECT', connectEventId: row.id } } });
          destinations.push({ module: 'Leads', label: summary.count ? 'Lead summary and activity note saved' : 'Lead activity note saved',
            recordId: row.leadId, relatedId: activity.id });
          await tx.connectEvent.update({ where: { id }, data: { encryptedResult: encrypted() } });
        }
        if (proposal.intent === 'DEMAND' && live.createLeads && policy.leads && input.senderPhone && proposal.purpose &&
          hasDelegatedAccess(currentActor, 'leads', 'view', 'create')) {
          const phone = normalizeIndianPhone(input.senderPhone);
          if (phone) {
            const created = await tx.lead.createMany({ data: [{ organizationId: row.organizationId, name: 'WhatsApp requirement',
              phone, assignedToId: row.userId, source: 'WHATSAPP', sourceRef: row.id, sourceDetail: 'BrokerIQ Connect', notes: proposal.summary }], skipDuplicates: true });
            const lead = await tx.lead.findUnique({ where: { organizationId_phone: { organizationId: row.organizationId, phone } }, select: { id: true, deletedAt: true, assignedToId: true } });
            if (created.count && lead && !lead.deletedAt) {
              const requirement = await tx.leadRequirement.create({ data: { leadId: lead.id, purpose: proposal.purpose, bedrooms: proposal.bedrooms ? [proposal.bedrooms] : [],
                maxBudget: proposal.budget, furnishing: proposal.furnishing, notes: proposal.summary } });
              destinations.push({ module: 'Leads', label: 'Lead and requirement created', recordId: lead.id, relatedId: requirement.id });
              await tx.connectEvent.update({ where: { id }, data: { leadId: lead.id, status: 'APPLIED', encryptedResult: encrypted() } });
            }
          }
        }
        if (input.group && proposal.intent === 'OFFER' && live.createInventory && policy.inventory && proposal.purpose && proposal.address &&
          text.toLowerCase().includes(proposal.address.toLowerCase()) &&
          hasDelegatedAccess(currentActor, 'inventory', 'view', 'create')) {
          const sector = proposal.sector ? canonicalInventorySector(proposal.sector) : undefined;
          if (!sector && !proposal.locality) return;
          const location = sector ?? proposal.locality;
          const duplicate = await tx.inventoryItem.findFirst({ where: { organizationId: row.organizationId, deletedAt: null, sector: location,
            address: { equals: proposal.address, mode: 'insensitive' }, floor: proposal.floor ?? null }, select: { id: true } });
          if (!duplicate) {
            const draft = await tx.inventoryItem.create({ data: { organizationId: row.organizationId, sourceType: 'CONNECT_WHATSAPP',
            createdById: row.userId, assignedToId: row.userId, address: proposal.address, sector: location, purpose: proposal.purpose,
            bhk: proposal.bedrooms, floor: proposal.floor, furnishing: proposal.furnishing, notes: proposal.summary,
            ...(proposal.purpose === 'RENT' ? { monthlyRent: proposal.budget, rent: proposal.budget } : { totalSalePrice: proposal.budget }),
            status: 'DRAFT', verificationStatus: 'NEEDS_REVIEW', availability: 'UNKNOWN', clientMutationId: 'connect:' + id,
            }, select: { id: true } });
            destinations.push({ module: 'Inventory', label: 'Private property draft created for review', recordId: draft.id });
          }
          await tx.connectEvent.update({ where: { id }, data: { status: duplicate ? 'DUPLICATE' : 'APPLIED', encryptedResult: encrypted() } });
        }
      }, { timeout: 30_000 });
    } catch (error) {
      if (error instanceof OpenRouterQuotaDeferred) {
        await this.db.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'PENDING', lastError: error.message } });
        throw new JobDeferred(error.message, error.until);
      }
      const missing = error instanceof IntegrationNotConfiguredException;
      const lastError = missing ? error.message : 'Connect could not finish transcription or analysis. Retry when the integration is available.';
      await this.db.connectEvent.updateMany({ where: { id, status: 'PROCESSING' }, data: { status: 'FAILED', lastError } });
      if (!missing) throw new Error(lastError);
    }
  }
}
