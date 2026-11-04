import { AccessService } from '../../core/access/access.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { WebPushService } from '../../core/notifications/web-push.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type MessageStatus } from '@prisma/client';
import { normalizeIndianPhone } from '@brokeriq/shared';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { RealtimeGateway } from '../../core/realtime/realtime.gateway';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import type { RequestUser } from '../../common/decorators';
import { requireOrg } from '../../common/utils';
import {
  allowedInboundSms,
  sendTextbeeSms,
  textbeeConfig,
  textbeeEventSchema,
  TextbeeRequestError,
  verifyTextbeeSignature,
} from '../../core/sms/textbee.client';
import { env } from '../../config/env';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly jobs: JobsService,
    private readonly realtime: RealtimeGateway,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly webPush: WebPushService,
  ) {
    jobs.register('sms.dispatch', async (payload) => this.dispatch(payload.messageId));
    jobs.register('sms.event', async (payload) => this.processEvent(payload.eventId));
    jobs.register('sms.notify', async (payload) => this.deliverNotification(payload.messageId));
  }
  async credentials(orgId: string) {
    const values = await this.settings.resolveOrganizationOnly('textbee', orgId);
    if (!values) throw new IntegrationNotConfiguredException('textbee', 'Firm settings → Textbee में business SMS connection configure करें।');
    textbeeConfig(values);
    return values;
  }
  private async lead(tx: Prisma.TransactionClient, user: RequestUser, id: string) {
    const lead = await tx.lead.findFirst({
      where: { id, organizationId: requireOrg(user), deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }
  async resolveSms(user: RequestUser, leadId: string) {
    const orgId = requireOrg(user);
    await this.credentials(orgId);
    return this.prisma.$transaction(async (tx) => {
      const lead = await this.lead(tx, user, leadId);
      const phone = normalizeIndianPhone(lead.phone);
      if (!phone) throw new BadRequestException('Lead needs a valid phone');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sms-contact:${orgId}:${phone}`}))`;
      const existing = await tx.conversation.findUnique({
        where: { organizationId_channel_contactKey: { organizationId: orgId, channel: 'SMS', contactKey: phone } },
      });
      if (existing?.blockedAt) throw new ForbiddenException('Conversation is blocked');
      if (existing && existing.leadId !== lead.id) throw new ConflictException('SMS contact is linked to another record; review it before opening history.');
      const conversation =
        existing ??
        (await tx.conversation.create({
          data: { organizationId: orgId, channel: 'SMS', contactKey: phone, contactPhone: phone, contactName: lead.name, leadId },
        }));
      return { conversationId: conversation.id, channel: 'SMS' as const };
    });
  }
  async sendSms(user: RequestUser, input: { conversationId: string; text: string; requestId: string }) {
    await this.access.assertAllowed(user, 'chat');
    const orgId = requireOrg(user);
    const values = await this.credentials(orgId);
    const config = textbeeConfig(values);
    const requestKey = hash(`sms:${orgId}:${input.requestId}`);
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${requestKey}))`;
      const conv = await tx.conversation.findFirst({ where: { id: input.conversationId, organizationId: orgId, channel: 'SMS', blockedAt: null } });
      if (!conv?.leadId) throw new NotFoundException('SMS conversation not found');
      const lead = await this.lead(tx, user, conv.leadId);
      if (normalizeIndianPhone(lead.phone) !== conv.contactPhone) throw new ConflictException('Lead phone changed; review the conversation.');
      const existing = await tx.message.findUnique({ where: { requestKey } });
      if (existing) {
        if (existing.conversationId !== conv.id || existing.body !== input.text || existing.senderUserId !== user.id)
          throw new ConflictException('SMS request id was already used for another message');
        return existing;
      }
      const created = await tx.message.create({
        data: {
          conversationId: conv.id,
          direction: 'OUTBOUND',
          body: input.text,
          requestKey,
          senderUserId: user.id,
          meta: { dispatch: 'PENDING', deviceId: config.deviceId, simSubscriptionId: config.simSubscriptionId, senderPhone: config.senderPhone },
        },
      });
      await tx.job.create({
        data: { runAt: new Date(), type: 'sms.dispatch', payload: { orgId, messageId: created.id }, key: `sms-dispatch:${created.id}`, maxAttempts: 1 },
      });
      return created;
    });
    return record;
  }
  /** Durable single attempt marker precedes the provider call. A worker crash cannot blindly resend. */
  async dispatch(id: string) {
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sms-dispatch:${id}`}))`;
      const message = await tx.message.findUnique({ where: { id }, include: { conversation: { include: { lead: true } }, sender: true } });
      if (!message || (message.meta as any)?.dispatch !== 'PENDING') return null;
      const { conversation: conv, sender } = message;
      if (
        !conv.organizationId ||
        conv.channel !== 'SMS' ||
        conv.blockedAt ||
        !conv.lead ||
        conv.lead.deletedAt ||
        !sender ||
        sender.deletedAt ||
        sender.status !== 'ACTIVE' ||
        sender.organizationId !== conv.organizationId ||
        !['BROKER_ADMIN', 'BROKER_AGENT'].includes(sender.role) ||
        (sender.role === 'BROKER_AGENT' && conv.lead.assignedToId !== sender.id) ||
        normalizeIndianPhone(conv.lead.phone) !== conv.contactPhone
      ) {
        await tx.message.update({
          where: { id },
          data: { status: 'FAILED', error: 'Sender access or Lead contact changed', meta: { ...(message.meta as any), dispatch: 'BLOCKED' } },
        });
        return null;
      }
      await tx.message.update({ where: { id }, data: { meta: { ...(message.meta as any), dispatch: 'ATTEMPTED', attemptedAt: new Date().toISOString() } } });
      return message;
    });
    if (!record) return;
    const conv = record.conversation;
    const orgId = conv.organizationId!;
    let acceptedBatch: string | null = null;
    try {
      const values = await this.credentials(orgId);
      const config = textbeeConfig(values);
      const original = record.meta as any;
      if (original.deviceId !== config.deviceId || original.simSubscriptionId !== config.simSubscriptionId || original.senderPhone !== config.senderPhone)
        throw new ConflictException('SMS gateway changed; review queued message before sending.');
      const accepted = await sendTextbeeSms(values, conv.contactPhone!, record.body!, async () => {
        const current = await this.prisma.user.findFirst({ where: { id: record.senderUserId!, organizationId: orgId, status: 'ACTIVE', deletedAt: null } });
        const activeOrg = await this.prisma.organization.findFirst({ where: { id: orgId, status: 'ACTIVE' } });
        const currentConversation = await this.prisma.conversation.findFirst({
          where: { id: conv.id, organizationId: orgId, blockedAt: null, leadId: conv.leadId },
        });
        const currentLead = await this.prisma.lead.findFirst({ where: { id: conv.leadId!, organizationId: orgId, deletedAt: null } });
        if (
          !activeOrg ||
          !currentConversation ||
          !current ||
          !['BROKER_ADMIN', 'BROKER_AGENT'].includes(current.role) ||
          !currentLead ||
          (current.role === 'BROKER_AGENT' && currentLead.assignedToId !== current.id) ||
          normalizeIndianPhone(currentLead.phone) !== conv.contactPhone
        )
          throw new ForbiddenException('SMS sender access changed');
        await this.access.assertAllowed({ id: current.id, role: current.role, orgId, email: current.email } as RequestUser, 'chat');
        await this.access.assertNotBlocked({ phone: currentLead.phone, email: currentLead.email });
      });
      acceptedBatch = accepted.batchId;
      await this.prisma.$transaction(async (tx) => {
        await tx.message.update({
          where: { id },
          data: { providerBatchId: accepted.batchId, meta: { ...original, dispatch: 'ACCEPTED', warning: accepted.warning, deviceId: config.deviceId } },
        });
        await tx.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: record.createdAt, lastPreview: record.body!.slice(0, 140) } });
        await tx.activity.create({
          data: {
            organizationId: orgId,
            leadId: conv.leadId!,
            userId: record.senderUserId,
            type: 'SMS',
            content: `SMS queued · ${record.body!.slice(0, 500)}`,
          },
        });
        await tx.lead.update({ where: { id: conv.leadId! }, data: { lastActivityAt: record.createdAt } });
      });
    } catch (error) {
      const uncertain = !!acceptedBatch || (error instanceof TextbeeRequestError && error.ambiguous);
      await this.prisma.message.update({
        where: { id },
        data: {
          ...(acceptedBatch ? { providerBatchId: acceptedBatch } : {}),
          status: uncertain ? 'QUEUED' : 'FAILED',
          error: uncertain
            ? 'SMS delivery uncertain. Check provider history before sending again.'
            : error instanceof TextbeeRequestError
              ? error.message
              : 'SMS configuration or contact changed. Review before retrying.',
          meta: { ...(record.meta as any), dispatch: uncertain ? 'UNCERTAIN' : 'FAILED' },
        },
      });
    }
    const message = await this.prisma.message.findUnique({ where: { id } });
    await this.realtime.toConversation(orgId, conv.id, 'wa:message', { conversationId: conv.id, message });
  }
  async status(user: RequestUser) {
    const orgId = requireOrg(user);
    const values = await this.settings.resolveOrganizationOnly('textbee', orgId);
    const gmail = await this.settings.resolveOrganizationOnly('gmail', orgId);
    const org = user.role === 'BROKER_ADMIN' ? await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } }) : null;
    return {
      gmail: { configured: !!gmail, mailboxEmail: gmail?.mailboxEmail ?? null },
      sms: {
        configured: !!values,
        senderPhone: values?.senderPhone ?? null,
        inboundEnabled: values?.inboundEnabled === true,
        ...(org ? { webhookUrl: `${env().PUBLIC_API_URL}/api/webhooks/textbee/${org.webhookKey}` } : {}),
      },
    };
  }
  async webhook(key: string, raw: Buffer | undefined, signature: unknown, body: unknown) {
    const org = await this.prisma.organization.findUnique({ where: { webhookKey: key } });
    if (!org || org.status !== 'ACTIVE') throw new NotFoundException();
    const values = await this.credentials(org.id);
    if (!verifyTextbeeSignature(values.webhookSecret, raw, signature)) throw new ForbiddenException('Invalid SMS signature');
    const parsed = textbeeEventSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid SMS event');
    const event = parsed.data;
    const config = textbeeConfig(values);
    if (event.deviceId !== config.deviceId || event.webhookSubscriptionId !== values.webhookSubscriptionId)
      throw new ForbiddenException('SMS device/subscription mismatch');
    if (event.simUsed?.subscriptionId !== undefined && event.simUsed.subscriptionId !== config.simSubscriptionId) return { ignored: true };
    if (event.webhookEvent === 'MESSAGE_RECEIVED') {
      if (values.inboundEnabled !== true || event.simUsed?.subscriptionId !== config.simSubscriptionId) return { ignored: true };
      const phone = normalizeIndianPhone(event.sender || '');
      const linked = phone
        ? await this.prisma.conversation.findUnique({
            where: { organizationId_channel_contactKey: { organizationId: org.id, channel: 'SMS', contactKey: phone } },
            include: { lead: true },
          })
        : null;
      if (!linked?.lead || linked.lead.deletedAt || !allowedInboundSms({ ...event, sender: phone! }, new Set([phone!]))) return { ignored: true };
    }
    const stored = event.webhookEvent === 'MESSAGE_RECEIVED' ? event : { ...event, message: '' };
    const externalId = `${org.id}:${event.idempotencyKey}`;
    const saved = await this.prisma.webhookEvent.upsert({
      where: { provider_externalId: { provider: 'textbee', externalId } },
      create: { provider: 'textbee', organizationId: org.id, externalId, payload: stored as Prisma.InputJsonValue },
      update: {},
    });
    await this.jobs.enqueue('sms.event', { orgId: org.id, eventId: saved.id }, { key: `sms-event:${saved.id}`, maxAttempts: 8 });
    return { ok: true };
  }
  async processEvent(id: string) {
    const changed = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sms-event:${id}`}))`;
      const saved = await tx.webhookEvent.findUnique({ where: { id } });
      if (!saved || saved.status === 'PROCESSED' || !saved.organizationId) return null;
      const event = textbeeEventSchema.parse(saved.payload);
      const orgId = saved.organizationId;
      let message;
      if (event.webhookEvent === 'MESSAGE_RECEIVED') {
        const phone = normalizeIndianPhone(event.sender || '');
        const conv = phone
          ? await tx.conversation.findUnique({
              where: { organizationId_channel_contactKey: { organizationId: orgId, channel: 'SMS', contactKey: phone } },
              include: { lead: true },
            })
          : null;
        if (conv?.lead && !conv.lead.deletedAt && !conv.blockedAt) {
          const externalId = `textbee:${orgId}:${event.deviceId}:${event.smsId}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${externalId}))`;
          const exists = await tx.message.findUnique({ where: { externalId } });
          if (!exists) {
            const at = event.receivedAt ? new Date(event.receivedAt) : saved.createdAt;
            message = await tx.message.create({
              data: { conversationId: conv.id, direction: 'INBOUND', body: event.message, status: 'RECEIVED', externalId, createdAt: at },
            });
            await tx.conversation.update({
              where: { id: conv.id },
              data: {
                unreadCount: { increment: 1 },
                ...(at >= (conv.lastMessageAt || new Date(0)) ? { lastMessageAt: at, lastPreview: event.message.slice(0, 140) } : {}),
                ...(at >= (conv.lastInboundAt || new Date(0)) ? { lastInboundAt: at } : {}),
              },
            });
            await tx.activity.create({
              data: { organizationId: orgId, leadId: conv.leadId!, type: 'SMS', content: `SMS received · ${event.message.slice(0, 500)}` },
            });
            const recipients = await tx.user.findMany({
              where: {
                organizationId: orgId,
                status: 'ACTIVE',
                deletedAt: null,
                OR: [{ role: 'BROKER_ADMIN' }, ...(conv.lead.assignedToId ? [{ id: conv.lead.assignedToId, role: 'BROKER_AGENT' as const }] : [])],
              },
              select: { id: true },
            });
            for (const recipient of recipients)
              await tx.notification.create({
                data: {
                  userId: recipient.id,
                  kind: 'SMS',
                  title: 'नया client SMS',
                  body: 'Inbox में संदेश देखें।',
                  link: `/broker/inbox?channel=SMS&c=${conv.id}`,
                  data: { smsMessageId: message.id, conversationId: conv.id },
                },
              });
            await tx.job.create({
              data: { runAt: new Date(), type: 'sms.notify', payload: { orgId, messageId: message.id }, key: `sms-notify:${message.id}`, maxAttempts: 3 },
            });
          }
        }
      } else if (event.smsBatchId) {
        const current = await tx.message.findFirst({
          where: { providerBatchId: event.smsBatchId, conversation: { organizationId: orgId, channel: 'SMS' } },
          include: { conversation: true },
        });
        if (!current) throw new Error('SMS acceptance is not reconciled yet');
        const stamp = event.deliveredAt || event.failedAt || event.sentAt;
        const at = stamp ? new Date(stamp) : saved.createdAt;
        const status: MessageStatus | null =
          event.webhookEvent === 'MESSAGE_DELIVERED'
            ? 'DELIVERED'
            : event.webhookEvent === 'MESSAGE_SENT'
              ? 'SENT'
              : event.webhookEvent === 'MESSAGE_FAILED'
                ? 'FAILED'
                : null;
        if (status && !['DELIVERED', 'FAILED'].includes(current.status) && (!current.providerEventAt || at >= current.providerEventAt)) {
          message = await tx.message.update({
            where: { id: current.id },
            data: {
              status,
              providerEventAt: at,
              externalId: `textbee:${orgId}:${event.deviceId}:${event.smsId}`,
              error: status === 'FAILED' ? 'Carrier reported SMS failure' : null,
            },
          });
          if (current.conversation.leadId && ['SENT', 'DELIVERED'].includes(status))
            await tx.lead.updateMany({
              where: { id: current.conversation.leadId, organizationId: orgId, firstResponseAt: null },
              data: { firstResponseAt: at },
            });
        } else if (event.webhookEvent === 'UNKNOWN_STATE' && current.status === 'QUEUED') {
          message = await tx.message.update({
            where: { id: current.id },
            data: {
              error: 'SMS delivery is unconfirmed. Check the sending phone and provider history before sending again.',
              meta: { ...((current.meta as Record<string, any>) ?? {}), dispatch: 'UNCERTAIN' },
            },
          });
        }
      }
      await tx.webhookEvent.update({ where: { id }, data: { status: 'PROCESSED', processedAt: new Date() } });
      return message ? { orgId, message } : null;
    });
    if (changed)
      await this.realtime.toConversation(changed.orgId, changed.message.conversationId, 'wa:message', {
        conversationId: changed.message.conversationId,
        message: changed.message,
      });
  }
  private async deliverNotification(messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId }, include: { conversation: { include: { lead: true } } } });
    const conv = message?.conversation;
    if (!message || !conv?.organizationId || !conv.lead || conv.lead.deletedAt || conv.blockedAt) return;
    const notes = await this.prisma.notification.findMany({
      where: {
        kind: 'SMS',
        data: { path: ['smsMessageId'], equals: messageId },
        user: {
          organizationId: conv.organizationId,
          status: 'ACTIVE',
          deletedAt: null,
          OR: [{ role: 'BROKER_ADMIN' }, ...(conv.lead.assignedToId ? [{ id: conv.lead.assignedToId, role: 'BROKER_AGENT' as const }] : [])],
        },
      },
    });
    const data = { link: `/broker/inbox?channel=SMS&c=${conv.id}`, kind: 'SMS' };
    const recipients = Object.fromEntries(notes.map((note) => [note.userId, { notificationId: note.id, recipientUserId: note.userId }]));
    for (const note of notes) this.realtime.toUser(note.userId, 'notification', { ...data, ...recipients[note.userId], title: note.title, body: note.body });
    const ids = notes.map((note) => note.userId);
    await this.notifications.push(ids, 'नया client SMS', 'Inbox में संदेश देखें।', data, recipients);
    await this.webPush.send(ids, 'नया client SMS', 'Inbox में संदेश देखें।', data, recipients);
  }
}
