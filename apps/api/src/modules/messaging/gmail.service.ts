import { Interval } from '@nestjs/schedule';
import { ModulesService } from '../../core/features/modules.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { WebPushService } from '../../core/notifications/web-push.service';
import { simpleParser } from 'mailparser';
import { JobsService } from '../../core/jobs/jobs.service';
import { RealtimeGateway } from '../../core/realtime/realtime.gateway';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { CryptoService } from '../../core/settings/crypto.service';
import { AccessService } from '../../core/access/access.service';
import { requireOrg } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';
import { env } from '../../config/env';
import {
  canonicalEmail,
  GMAIL_SCOPES,
  gmailApi,
  gmailClient,
  gmailExchange,
  gmailToken,
  gmailContactQuery,
  gmailBody,
  gmailMime,
  GmailRequestError,
} from '../../core/gmail/gmail.client';
import { IntegrationNotConfiguredException } from '../../common/exceptions';

const digest = (value: unknown) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
@Injectable()
export class GmailService {
  private scheduling = false;
  private tokens = new Map<string, { value: string; expires: number }>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly crypto: CryptoService,
    private readonly access: AccessService,
    private readonly jobs: JobsService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly webPush: WebPushService,
    private readonly modules: ModulesService,
  ) {
    this.jobs.register('gmail.dispatch', async (payload) => this.dispatchEmail(payload.messageId));
    this.jobs.register('gmail.notify', async (payload) => this.deliverEmailNotification(payload.messageId));
    this.jobs.register('gmail.sync', async (payload) => {
      const actor = await this.prisma.user.findFirst({
        where: { id: payload.actorId, organizationId: payload.orgId, role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null },
      });
      if (!actor) return;
      try {
        await this.sync(
          { id: actor.id, role: actor.role, orgId: actor.organizationId, email: actor.email },
          payload.conversationId,
          payload.cursor || undefined,
        );
      } catch {
        await this.prisma.conversation.updateMany({
          where: { id: payload.conversationId, organizationId: payload.orgId },
          data: { emailSyncError: 'Gmail sync failed. Reconnect or retry the client conversation.', emailSyncCursor: null },
        });
        throw new Error('Gmail client sync failed');
      }
    });
  }
  @Interval(180_000)
  async scheduleSync() {
    if (!env().JOBS_ENABLED || this.scheduling || !(await this.modules.enabled('inbox'))) return;
    this.scheduling = true;
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: {
          channel: 'EMAIL',
          blockedAt: null,
          lead: { is: { deletedAt: null } },
          organization: { status: 'ACTIVE', settings: { some: { key: 'integration.gmail', value: { path: ['enabled'], equals: true } } } },
          OR: [{ lastEmailSyncAt: null }, { lastEmailSyncAt: { lt: new Date(Date.now() - 180_000) } }],
        },
        orderBy: [{ lastEmailSyncAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
        take: 10,
      });
      for (const conv of conversations) {
        const actor = await this.prisma.user.findFirst({
          where: { organizationId: conv.organizationId, role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });
        if (!actor) continue;
        await this.jobs.enqueue(
          'gmail.sync',
          { orgId: conv.organizationId!, actorId: actor.id, conversationId: conv.id, cursor: conv.emailSyncCursor || '' },
          { key: `gmail-sync:${conv.id}`, maxAttempts: 3, repeat: true },
        );
        await this.prisma.conversation.update({ where: { id: conv.id }, data: { lastEmailSyncAt: new Date() } });
      }
    } finally {
      this.scheduling = false;
    }
  }
  @Interval(600_000)
  async pruneAuthorizations() {
    if (!env().JOBS_ENABLED) return;
    await this.prisma.mailboxAuthorization.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
  redirectUri() {
    const url = new URL(env().PUBLIC_API_URL);
    url.pathname = '/api/webhooks/gmail/callback';
    url.search = '';
    url.hash = '';
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
      throw new IntegrationNotConfiguredException('gmail_oauth', 'Gmail production callback requires HTTPS.');
    return url.toString();
  }
  async begin(user: RequestUser, sessionId: string | undefined) {
    if (user.role !== 'BROKER_ADMIN' || !sessionId) throw new ForbiddenException();
    await this.access.assertAllowed(user, 'connectors');
    const orgId = requireOrg(user);
    const client = gmailClient(await this.settings.resolve('gmail_oauth'));
    const actor = await this.prisma.user.findFirst({ where: { id: user.id, role: 'BROKER_ADMIN', organizationId: orgId, status: 'ACTIVE', deletedAt: null } });
    if (!actor) throw new ForbiddenException();
    const state = randomBytes(32).toString('base64url'),
      verifier = randomBytes(48).toString('base64url');
    await this.prisma.mailboxAuthorization.create({
      data: {
        id: digest(state),
        actorId: actor.id,
        sessionId,
        organizationId: orgId,
        sessionVersion: actor.sessionVersion,
        verifierEnc: this.crypto.encrypt(verifier),
        clientFingerprint: digest(client),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: GMAIL_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent select_account',
      include_granted_scopes: 'false',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return { authorizationUrl: url.toString(), expiresInSeconds: 600 };
  }
  async complete(state: string, code: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !code || code.length > 4096) throw new BadRequestException('Invalid authorization response');
    const attempt = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gmail-state:${digest(state)}`}))`;
      const row = await tx.mailboxAuthorization.findUnique({ where: { id: digest(state) } });
      if (!row || !row.sessionId || row.consumedAt || row.expiresAt <= new Date()) throw new BadRequestException('Authorization expired or already used');
      const actor = await tx.user.findFirst({
        where: {
          id: row.actorId,
          role: 'BROKER_ADMIN',
          organizationId: row.organizationId,
          sessionVersion: row.sessionVersion,
          status: 'ACTIVE',
          deletedAt: null,
          organization: { status: 'ACTIVE' },
        },
      });
      const device = await tx.refreshToken.findFirst({
        where: { id: row.sessionId!, userId: row.actorId, sessionVersion: row.sessionVersion, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!actor || !device) throw new ForbiddenException('Firm administrator or device session changed');
      await tx.mailboxAuthorization.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
      return row;
    });
    const client = gmailClient(await this.settings.resolve('gmail_oauth'));
    if (digest(client) !== attempt.clientFingerprint) throw new ConflictException('OAuth client changed. Start a new connection.');
    const token = await gmailExchange(client, code, this.crypto.decrypt(attempt.verifierEnc), this.redirectUri());
    const profile = await gmailApi(token.accessToken, '/profile');
    const mailbox = canonicalEmail(profile.emailAddress);
    if (!mailbox) throw new BadRequestException('Gmail did not identify an authorized mailbox');
    await this.prisma.$transaction(async (tx) => {
      // Lock current membership while installing the firm grant, so demotion/transfer cannot authorize a mailbox.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${attempt.actorId} FOR UPDATE`;
      const actor = await tx.user.findFirst({
        where: {
          id: attempt.actorId,
          role: 'BROKER_ADMIN',
          organizationId: attempt.organizationId,
          sessionVersion: attempt.sessionVersion,
          status: 'ACTIVE',
          deletedAt: null,
          organization: { status: 'ACTIVE' },
        },
      });
      const device = await tx.refreshToken.findFirst({
        where: { id: attempt.sessionId!, userId: attempt.actorId, sessionVersion: attempt.sessionVersion, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!device || !actor || actor.restrictions.includes('connectors')) throw new ForbiddenException('Administrator access changed');
      const org = await tx.organization.findUniqueOrThrow({ where: { id: attempt.organizationId } });
      if (org.restrictions.includes('connectors')) throw new ForbiddenException('Firm connectors are disabled');
      const value = {
        enabled: true,
        fields: { mailboxEmail: mailbox, refreshToken: { enc: this.crypto.encrypt(token.refreshToken) }, clientFingerprint: attempt.clientFingerprint },
      };
      await tx.orgSetting.upsert({
        where: { organizationId_key: { organizationId: attempt.organizationId, key: 'integration.gmail' } },
        create: { organizationId: attempt.organizationId, key: 'integration.gmail', updatedById: actor.id, value },
        update: { updatedById: actor.id, value, lastTestOk: null, lastTestedAt: null, lastTestMessage: null },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          organizationId: org.id,
          action: 'gmail.connected',
          entity: 'Integration',
          entityId: 'gmail',
          meta: { mailbox, scopes: [...GMAIL_SCOPES] },
        },
      });
    });
    this.settings.invalidate(`org:${attempt.organizationId}:gmail`);
    return { mailbox };
  }
  async connection(orgId: string) {
    const values = await this.settings.resolveOrganizationOnly('gmail', orgId);
    if (!values || typeof values.refreshToken !== 'string' || !canonicalEmail(values.mailboxEmail)) throw new IntegrationNotConfiguredException('gmail');
    const client = gmailClient(await this.settings.resolve('gmail_oauth'));
    if (values.clientFingerprint !== digest(client))
      throw new IntegrationNotConfiguredException('gmail', 'Platform OAuth client changed. Reconnect the business mailbox.');
    const key = digest([orgId, values.refreshToken, values.clientFingerprint]);
    const cached = this.tokens.get(key);
    const token = cached && cached.expires > Date.now() ? cached.value : await gmailToken(client, values.refreshToken);
    if (!cached || cached.expires <= Date.now()) {
      if (this.tokens.size > 32) this.tokens.clear();
      this.tokens.set(key, { value: token, expires: Date.now() + 600_000 });
    }
    return { token, mailbox: canonicalEmail(values.mailboxEmail)! };
  }

  private async conversation(user: RequestUser, id: string) {
    const actor = await this.prisma.user.findFirst({
      where: { id: user.id, organizationId: requireOrg(user), role: user.role, status: 'ACTIVE', deletedAt: null, organization: { status: 'ACTIVE' } },
    });
    if (!actor || !['BROKER_ADMIN', 'BROKER_AGENT'].includes(actor.role)) throw new ForbiddenException('Account permissions changed');
    const conv = await this.prisma.conversation.findFirst({
      where: { id, organizationId: requireOrg(user), channel: 'EMAIL', blockedAt: null },
      include: { lead: true },
    });
    if (!conv?.lead || conv.lead.deletedAt || (user.role === 'BROKER_AGENT' && conv.lead.assignedToId !== user.id))
      throw new NotFoundException('Email conversation not found');
    if (canonicalEmail(conv.lead.email) !== conv.contactKey) throw new ConflictException('Client email changed. Review the conversation.');
    return conv;
  }
  async resolve(user: RequestUser, leadId: string) {
    const orgId = requireOrg(user);
    await this.connection(orgId);
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: leadId, organizationId: orgId, deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) },
      });
      if (!lead) throw new NotFoundException('Lead not found');
      const email = canonicalEmail(lead.email);
      if (!email) throw new BadRequestException('Lead needs a valid client email');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gmail-contact:${orgId}:${email}`}))`;
      const old = await tx.conversation.findUnique({
        where: { organizationId_channel_contactKey: { organizationId: orgId, channel: 'EMAIL', contactKey: email } },
      });
      if (old && (old.leadId !== lead.id || old.blockedAt)) throw new ConflictException('Review existing email contact before opening this Lead.');
      const conv =
        old ??
        (await tx.conversation.create({ data: { organizationId: orgId, channel: 'EMAIL', contactKey: email, contactName: lead.name, leadId: lead.id } }));
      return { conversationId: conv.id, channel: 'EMAIL' as const };
    });
  }
  async sendEmail(user: RequestUser, input: { conversationId: string; requestId: string; subject: string; text: string; replyToId?: string }) {
    await this.access.assertAllowed(user, 'chat');
    const conv = await this.conversation(user, input.conversationId);
    const orgId = requireOrg(user);
    const connection = await this.connection(orgId);
    const requestKey = digest(`gmail:${orgId}:${input.requestId}`);
    // Validate MIME/header constraints before queuing any provider work.
    const mime = gmailMime({ from: connection.mailbox, to: conv.contactKey, subject: input.subject, text: input.text, requestKey });
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${requestKey}))`;
      const old = await tx.message.findUnique({ where: { requestKey } });
      if (old) {
        if (
          old.conversationId !== conv.id ||
          old.senderUserId !== user.id ||
          old.body !== input.text ||
          (old.meta as any)?.subject !== input.subject ||
          ((old.meta as any)?.replyToId || undefined) !== input.replyToId
        )
          throw new ConflictException('Email request ID already used');
        return old;
      }
      const reply = input.replyToId ? await tx.message.findFirst({ where: { id: input.replyToId, conversationId: conv.id } }) : null;
      if (input.replyToId && !reply) throw new BadRequestException('Reply target is not in this conversation');
      const email = await tx.message.create({
        data: {
          conversationId: conv.id,
          direction: 'OUTBOUND',
          body: input.text,
          senderUserId: user.id,
          requestKey,
          meta: {
            subject: input.subject,
            messageId: mime.messageId,
            ...(input.replyToId ? { replyToId: input.replyToId } : {}),
            mailbox: connection.mailbox,
            dispatch: 'PENDING',
            ...(reply && typeof (reply.meta as any)?.messageId === 'string'
              ? { replyTo: (reply.meta as any).messageId, threadId: (reply.meta as any).threadId || '' }
              : {}),
          },
        },
      });
      await tx.job.create({
        data: { runAt: new Date(), type: 'gmail.dispatch', payload: { orgId, messageId: email.id }, key: `gmail-dispatch:${email.id}`, maxAttempts: 1 },
      });
      return email;
    });
  }
  async dispatchEmail(id: string) {
    const message = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gmail-dispatch:${id}`}))`;
      const row = await tx.message.findUnique({ where: { id }, include: { sender: true, conversation: { include: { lead: true } } } });
      if (!row || (row.meta as any)?.dispatch !== 'PENDING') return null;
      await tx.message.update({ where: { id }, data: { meta: { ...(row.meta as any), dispatch: 'ATTEMPTED' } } });
      return row;
    });
    if (!message) return;
    const conv = message.conversation;
    const orgId = conv.organizationId;
    let accepted = false;
    try {
      if (!orgId || !message.sender) throw new ForbiddenException();
      const actor = { id: message.sender.id, role: message.sender.role, email: message.sender.email, orgId };
      const currentUser = await this.prisma.user.findFirst({
        where: {
          id: actor.id,
          organizationId: orgId,
          status: 'ACTIVE',
          deletedAt: null,
          role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] },
          organization: { status: 'ACTIVE' },
        },
      });
      if (!currentUser) throw new ForbiddenException();
      actor.role = currentUser.role;
      const connection = await this.connection(orgId);
      if (connection.mailbox !== (message.meta as any)?.mailbox) throw new ConflictException('Business mailbox changed');
      const latest = await this.conversation(actor, conv.id);
      await this.access.assertAllowed(actor, 'chat');
      await this.access.assertNotBlocked({ email: latest.contactKey, phone: latest.lead!.phone });
      const meta = message.meta as any;
      const mime = gmailMime({
        from: connection.mailbox,
        to: latest.contactKey,
        subject: meta.subject,
        text: message.body!,
        requestKey: message.requestKey!,
        replyTo: meta.replyTo,
      });
      const sent = await gmailApi(connection.token, '/messages/send', { raw: mime.raw, ...(meta.threadId ? { threadId: meta.threadId } : {}) });
      accepted = true;
      if (typeof sent.id !== 'string' || !/^[a-f0-9]+$/i.test(sent.id)) throw new GmailRequestError(200, true);
      await this.prisma.$transaction(async (tx) => {
        await tx.message.update({
          where: { id },
          data: {
            externalId: `gmail:${orgId}:${connection.mailbox}:${sent.id}`,
            status: 'SENT',
            meta: { ...meta, dispatch: 'ACCEPTED', threadId: sent.threadId || '', messageId: mime.messageId },
          },
        });
        await tx.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: message.createdAt, lastPreview: message.body!.slice(0, 140) } });
        await tx.activity.create({
          data: {
            organizationId: orgId,
            leadId: conv.leadId!,
            userId: actor.id,
            type: 'EMAIL',
            content: `Email sent · ${meta.subject} · ${message.body!.slice(0, 500)}`,
          },
        });
        await tx.lead.updateMany({ where: { id: conv.leadId!, organizationId: orgId, firstResponseAt: null }, data: { firstResponseAt: new Date() } });
      });
    } catch (error) {
      const uncertain = accepted || (error instanceof GmailRequestError && error.ambiguous);
      await this.prisma.message.update({
        where: { id },
        data: {
          status: uncertain ? 'QUEUED' : 'FAILED',
          error: uncertain
            ? 'Email status uncertain. Review Gmail Sent before sending again.'
            : 'Email connection, sender permission or client changed. Reconnect/review before sending.',
          meta: { ...(message.meta as any), dispatch: uncertain ? 'UNCERTAIN' : 'FAILED' },
        },
      });
    }
    if (orgId)
      await this.realtime.toConversation(orgId, conv.id, 'wa:message', {
        conversationId: conv.id,
        message: await this.prisma.message.findUnique({ where: { id } }),
      });
  }
  async sync(user: RequestUser, id: string, cursor?: string) {
    await this.access.assertAllowed(user, 'chat');
    const conv = await this.conversation(user, id);
    const orgId = requireOrg(user);
    const connection = await this.connection(orgId);
    const since = new Date(Math.max(conv.createdAt.getTime() - 30 * 86400_000, Date.now() - 90 * 86400_000));
    const query = new URLSearchParams({ q: gmailContactQuery(conv.contactKey, since), maxResults: '25', ...(cursor ? { pageToken: cursor } : {}) });
    const list = await gmailApi(connection.token, `/messages?${query}`);
    let imported = 0;
    for (const candidate of (Array.isArray(list.messages) ? list.messages : []).slice(0, 25)) {
      if (typeof candidate.id !== 'string' || !/^[a-f0-9]+$/i.test(candidate.id)) continue;
      const email = await gmailApi(connection.token, `/messages/${candidate.id}?format=full`);
      const headers = (email.payload?.headers || []).filter(
        (header: any) =>
          ['from', 'to', 'cc', 'bcc', 'subject', 'message-id', 'in-reply-to'].includes(String(header.name).toLowerCase()) && typeof header.value === 'string',
      );
      const parsed = await simpleParser(headers.map((header: any) => `${header.name}: ${header.value}`).join('\r\n') + '\r\n\r\n');
      const from = parsed.from?.value?.map((address) => canonicalEmail(address.address)).filter(Boolean) || [];
      const to = (Array.isArray(parsed.to) ? parsed.to.flatMap((value) => value.value) : parsed.to?.value || [])
        .map((value) => canonicalEmail(value.address))
        .filter(Boolean);
      const cc = Array.isArray(parsed.cc) ? parsed.cc.flatMap((value) => value.value) : parsed.cc?.value || [];
      const bcc = Array.isArray(parsed.bcc) ? parsed.bcc.flatMap((value) => value.value) : parsed.bcc?.value || [];
      const inbound = from.length === 1 && from[0] === conv.contactKey && to.includes(connection.mailbox);
      const outbound = from.length === 1 && from[0] === connection.mailbox && to.includes(conv.contactKey);
      if ((!inbound && !outbound) || cc.length || bcc.length || to.some((value) => value !== conv.contactKey && value !== connection.mailbox)) continue;
      const body = await gmailBody(email.payload);
      if (!body.trim() || /\b(?:otp|one[ -]?time|verification code|security code|password)\b|ओटीपी|सत्यापन.?कोड/i.test(`${parsed.subject || ''}\n${body}`))
        continue;
      const millis = Number(email.internalDate);
      if (!Number.isFinite(millis) || millis < since.getTime() || millis > Date.now() + 300_000) continue;
      // Recheck assignment/mailbox after remote work before writing any private content.
      await this.conversation(user, id);
      const current = await this.settings.resolveOrganizationOnly('gmail', orgId);
      if (current?.mailboxEmail !== connection.mailbox) throw new ConflictException('Mailbox changed during sync');
      const externalId = `gmail:${orgId}:${connection.mailbox}:${candidate.id}`;
      const changed = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${externalId}))`;
        if (await tx.message.findUnique({ where: { externalId } })) return false;
        const currentActor = await tx.user.findFirst({ where: { id: user.id, organizationId: orgId, role: user.role, status: 'ACTIVE', deletedAt: null } });
        const currentLead = await tx.lead.findFirst({
          where: { id: conv.leadId!, organizationId: orgId, deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) },
        });
        if (!currentActor || !currentLead || canonicalEmail(currentLead.email) !== conv.contactKey)
          throw new ForbiddenException('Client access changed during sync');
        const at = new Date(millis);
        const local =
          outbound && parsed.messageId
            ? await tx.message.findFirst({
                where: { conversationId: id, direction: 'OUTBOUND', meta: { path: ['messageId'], equals: parsed.messageId }, externalId: null },
              })
            : null;
        if (local) {
          await tx.message.update({
            where: { id: local.id },
            data: { externalId, status: 'SENT', error: null, meta: { ...(local.meta as any), dispatch: 'RECONCILED', threadId: email.threadId || '' } },
          });
          return true;
        }
        const created = await tx.message.create({
          data: {
            conversationId: id,
            direction: inbound ? 'INBOUND' : 'OUTBOUND',
            status: inbound ? 'RECEIVED' : 'SENT',
            externalId,
            body,
            createdAt: at,
            meta: { subject: parsed.subject || '', threadId: email.threadId || '', messageId: parsed.messageId || '', mailbox: connection.mailbox },
          },
        });
        if (inbound) {
          const members = await tx.user.findMany({
            where: {
              organizationId: orgId,
              status: 'ACTIVE',
              deletedAt: null,
              OR: [{ role: 'BROKER_ADMIN' }, ...(currentLead.assignedToId ? [{ id: currentLead.assignedToId, role: 'BROKER_AGENT' as const }] : [])],
            },
            select: { id: true },
          });
          for (const member of members)
            await tx.notification.create({
              data: {
                userId: member.id,
                kind: 'EMAIL',
                title: 'नया client email',
                body: 'Gmail Inbox में संदेश देखें।',
                link: `/broker/inbox?channel=EMAIL&c=${id}`,
                data: { emailMessageId: created.id, conversationId: id },
              },
            });
          await tx.job.create({
            data: { runAt: new Date(), type: 'gmail.notify', payload: { orgId, messageId: created.id }, key: `gmail-notify:${created.id}`, maxAttempts: 3 },
          });
        }
        const latest = await tx.conversation.findUniqueOrThrow({ where: { id } });
        await tx.conversation.update({
          where: { id },
          data: {
            ...(at >= (latest.lastMessageAt || new Date(0)) ? { lastMessageAt: at, lastPreview: body.slice(0, 140) } : {}),
            ...(inbound ? { unreadCount: { increment: 1 }, ...(at >= (latest.lastInboundAt || new Date(0)) ? { lastInboundAt: at } : {}) } : {}),
          },
        });
        await tx.activity.create({
          data: {
            organizationId: orgId,
            leadId: conv.leadId!,
            type: 'EMAIL',
            content: `Email ${inbound ? 'received' : 'sent'} · ${parsed.subject || ''} · ${body.slice(0, 500)}`,
          },
        });
        return true;
      });
      if (changed) imported++;
    }
    await this.prisma.conversation.update({
      where: { id },
      data: { lastEmailSyncAt: new Date(), emailSyncError: null, emailSyncCursor: typeof list.nextPageToken === 'string' ? list.nextPageToken : null },
    });
    await this.realtime.toConversation(orgId, id, 'wa:message', { conversationId: id });
    return { imported, nextCursor: typeof list.nextPageToken === 'string' ? list.nextPageToken : null };
  }

  private async deliverEmailNotification(messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId }, include: { conversation: { include: { lead: true } } } });
    const conv = message?.conversation;
    if (!conv?.organizationId || !conv.lead || conv.lead.deletedAt || conv.blockedAt) return;
    const members = await this.prisma.notification.findMany({
      where: {
        kind: 'EMAIL',
        data: { path: ['emailMessageId'], equals: messageId },
        user: {
          organizationId: conv.organizationId,
          status: 'ACTIVE',
          deletedAt: null,
          OR: [{ role: 'BROKER_ADMIN' }, ...(conv.lead.assignedToId ? [{ id: conv.lead.assignedToId, role: 'BROKER_AGENT' as const }] : [])],
        },
      },
    });
    const data = { kind: 'EMAIL', link: `/broker/inbox?channel=EMAIL&c=${conv.id}` };
    const recipients = Object.fromEntries(members.map((note) => [note.userId, { notificationId: note.id, recipientUserId: note.userId }]));
    for (const note of members) this.realtime.toUser(note.userId, 'notification', { ...data, ...recipients[note.userId], title: note.title, body: note.body });
    const ids = members.map((note) => note.userId);
    await this.notifications.push(ids, 'नया client email', 'Gmail Inbox में संदेश देखें।', data, recipients);
    await this.webPush.send(ids, 'नया client email', 'Gmail Inbox में संदेश देखें।', data, recipients);
  }
  async disconnect(user: RequestUser) {
    if (user.role !== 'BROKER_ADMIN') throw new ForbiddenException();
    await this.access.assertAllowed(user, 'connectors');
    const orgId = requireOrg(user);
    const previous = await this.settings.resolveOrganizationOnly('gmail', orgId);
    await this.prisma.mailboxAuthorization.updateMany({ where: { organizationId: orgId, consumedAt: null }, data: { consumedAt: new Date() } });
    await this.settings.remove('gmail', orgId);
    this.tokens.clear();
    let providerRevoked = false;
    if (typeof previous?.refreshToken === 'string') {
      try {
        const response = await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: previous.refreshToken }),
        });
        providerRevoked = response.ok;
      } catch {
        /* Local access remains disabled even if Google is unavailable. */
      }
    }
    await this.prisma.auditLog.create({
      data: { actorId: user.id, actorRole: user.role, organizationId: orgId, action: 'gmail.disconnected', entity: 'Integration', entityId: 'gmail' },
    });
    return { ok: true, providerRevoked };
  }
}
