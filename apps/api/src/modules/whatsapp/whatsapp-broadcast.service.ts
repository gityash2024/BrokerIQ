import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { broadcastContactInput, broadcastGroupInput, broadcastMessage, normalizeIndianPhone, phoneForWhatsApp, type BroadcastDraftInput } from '@brokeriq/shared';
import { z } from 'zod';
import type { RequestUser } from '../../common/decorators';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import { requireOrg } from '../../common/utils';
import { AccessService } from '../../core/access/access.service';
import { AuditService } from '../../core/audit/audit.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { SettingsService } from '../../core/settings/settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppBillingException, WhatsAppService } from './whatsapp.service';

const jobType = 'whatsapp.broadcast-recipient';
const day = 86_400_000;
const quoteTtl = 5 * 60_000;
const listRatesEffective = new Date('2026-10-01T00:00:00+05:30');
const nextRateQuarter = new Date('2027-01-01T00:00:00+05:30');
const isOpen = (at: Date | null | undefined, now: Date) => at && at <= now && now.valueOf() - at.valueOf() < day;
const authorizedContact = { archivedAt: null, optedOutAt: null, consentAt: { not: null } } as const;

@Injectable()
export class WhatsAppBroadcastService {
  constructor(
    private readonly db: PrismaService,
    private readonly settings: SettingsService,
    private readonly wa: WhatsAppService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    jobs: JobsService,
  ) {
    jobs.register(jobType, ({ recipientId }) => this.deliver(recipientId));
  }

  private firm(user: RequestUser, ...actions: string[]) {
    if (user.role !== 'BROKER_ADMIN' || user.delegatedActor || user.rolePermissions &&
      !['view', ...actions].every((action) => user.rolePermissions?.includes('inbox:' + action))) throw new ForbiddenException();
    return requireOrg(user);
  }

  async workspace(user: RequestUser, search?: string, after?: string) {
    const organizationId = this.firm(user);
    const [contacts, groups, broadcasts, credentials, templates] = await Promise.all([
      this.db.whatsAppBroadcastContact.findMany({ where: { organizationId, archivedAt: null, ...(after ? { id: { gt: after } } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search.replace(/[^\d+]/g, '').replace(/^\+/, '') || search } }] } : {}),
      }, select: { id: true, name: true, phone: true, consentAt: true, optedOutAt: true }, take: 51, orderBy: { id: 'asc' } }),
      this.db.whatsAppBroadcastGroup.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
      this.db.whatsAppBroadcast.findMany({ where: { organizationId, queuedAt: { not: null } }, select: { id: true, name: true, queuedAt: true },
        take: 20, orderBy: { queuedAt: 'desc' } }),
      this.settings.resolveOrganizationOnly('whatsapp', organizationId),
      this.db.whatsAppTemplate.findMany({ where: { organizationId, status: 'APPROVED', category: { in: ['MARKETING', 'UTILITY'] } },
        select: { name: true, language: true, category: true, body: true, components: true }, orderBy: { name: 'asc' } }),
    ]);
    const counts = await this.db.$queryRaw<{ broadcastId: string; status: string; total: number }[]>`
      SELECT r."broadcastId", COALESCE(m."status"::text, r.status) AS status, COUNT(*)::integer AS total
      FROM "WhatsAppBroadcastRecipient" r LEFT JOIN "Message" m ON m.id = r."messageId"
      WHERE r."broadcastId" IN (${Prisma.join(broadcasts.length ? broadcasts.map(({ id }) => id) : [''])})
      GROUP BY 1, 2`;
    return { contacts: contacts.slice(0, 50), next: contacts.length === 51 ? contacts[49].id : null, groups,
      broadcasts: broadcasts.map((row) => ({ ...row, counts: Object.fromEntries(counts.filter((count) => count.broadcastId === row.id).map(({ status, total }) => [status, total])) })),
      connected: !!credentials, templates: credentials ? templates : [], balance: null, remainingBalance: null };
  }

  async importContacts(user: RequestUser, entries: z.infer<typeof broadcastContactInput>[]) {
    const organizationId = this.firm(user, 'create');
    const unique = new Map(entries.map(({ phone, ...entry }) => {
      const normalized = normalizeIndianPhone(phone);
      if (!normalized) throw new BadRequestException('Enter a valid Indian mobile number');
      return [phoneForWhatsApp(normalized), entry];
    }));
    const saved = await this.db.$transaction(async (tx) => {
      const changes = [];
      for (const [phone, entry] of unique) {
        const evidence = entry.consentEvidence;
        const data = { name: entry.name, ...(evidence ? { consentEvidence: evidence, consentAt: new Date() } : {}) };
        changes.push(await tx.whatsAppBroadcastContact.upsert({ where: { organizationId_phone: { organizationId, phone } },
          create: { ...data, organizationId, phone }, update: { ...data, archivedAt: null },
          select: { id: true, name: true, phone: true, consentAt: true, optedOutAt: true } }));
      }
      return changes;
    }, { timeout: 20_000 });
    await this.audit.log(user, 'whatsapp.broadcast.contacts.import', 'WhatsAppBroadcastContact', null, { count: saved.length });
    return { contacts: saved };
  }

  async archiveContact(user: RequestUser, id: string) {
    const organizationId = this.firm(user, 'delete');
    const changed = await this.db.whatsAppBroadcastContact.updateMany({ where: { id, organizationId, archivedAt: null },
      data: { archivedAt: new Date(), optedOutAt: new Date() } });
    if (!changed.count) throw new NotFoundException('Contact not found');
    await this.audit.log(user, 'whatsapp.broadcast.contact.archive', 'WhatsAppBroadcastContact', id);
    return { id };
  }

  async group(user: RequestUser, input: z.infer<typeof broadcastGroupInput>, id?: string) {
    const organizationId = this.firm(user, id ? 'edit' : 'create');
    const contactIds = [...new Set(input.contactIds)];
    const saved = await this.db.$transaction(async (tx) => {
      if (contactIds.length !== await tx.whatsAppBroadcastContact.count({ where: { id: { in: contactIds }, organizationId, archivedAt: null } }))
        throw new BadRequestException('Choose contacts from your firm');
      if (!id) return tx.whatsAppBroadcastGroup.create({ data: { organizationId, name: input.name, contactIds } });
      const updated = await tx.whatsAppBroadcastGroup.updateMany({ where: { id, organizationId }, data: { name: input.name, contactIds } });
      if (!updated.count) throw new NotFoundException('Group not found');
      return tx.whatsAppBroadcastGroup.findUniqueOrThrow({ where: { id } });
    });
    await this.audit.log(user, 'whatsapp.broadcast.group.save', 'WhatsAppBroadcastGroup', saved.id, { count: contactIds.length });
    return saved;
  }

  async deleteGroup(user: RequestUser, id: string) {
    const organizationId = this.firm(user, 'delete');
    const result = await this.db.whatsAppBroadcastGroup.deleteMany({ where: { id, organizationId } });
    if (!result.count) throw new NotFoundException('Group not found');
    await this.audit.log(user, 'whatsapp.broadcast.group.delete', 'WhatsAppBroadcastGroup', id);
    return { id };
  }

  async preview(user: RequestUser, input: BroadcastDraftInput) {
    const organizationId = this.firm(user, 'send');
    await this.access.assertAllowed(user, 'chat');
    const account = await this.settings.resolveOrganizationOnly('whatsapp', organizationId);
    if (!account) throw new IntegrationNotConfiguredException('whatsapp', 'Connect your firm’s own Business number in Broker → Connectors.');
    const groupIds = [...new Set(input.groupIds)];
    const groups = await this.db.whatsAppBroadcastGroup.findMany({ where: { id: { in: groupIds }, organizationId } });
    if (groups.length !== groupIds.length) throw new NotFoundException('Group not found');
    const ids = [...new Set(groups.flatMap(({ contactIds }) => contactIds))];
    const contacts = await this.db.whatsAppBroadcastContact.findMany({ where: { id: { in: ids }, organizationId, ...authorizedContact },
      select: { id: true, phone: true } });
    const phones = contacts.map(({ phone }) => phone);
    const conversations = await this.db.conversation.findMany({ where: { organizationId, channel: 'WHATSAPP', contactKey: { in: phones } },
      select: { contactKey: true, lastInboundAt: true, blockedAt: true, lead: { select: { optedOutAt: true } } } });
    const blocked = new Set((await this.db.lead.findMany({ where: { organizationId, deletedAt: null, optedOutAt: { not: null } },
      select: { phone: true } })).map(({ phone }) => phoneForWhatsApp(phone)));
    const byPhone = new Map(conversations.map((conversation) => [conversation.contactKey, conversation]));
    const now = new Date();
    const message = input.message;
    // Meta INR list rate, effective 2026-10-01. Keep the estimate unavailable outside its reviewed quarter.
    const rateCardCurrent = now >= listRatesEffective && now < nextRateQuarter;
    let rate = 0.115;
    let freeCapacity: number | null = null;
    if (message.type === 'template') {
      const template = await this.db.whatsAppTemplate.findUnique({ where: {
        organizationId_name_language: { organizationId, name: message.name, language: message.language },
      } });
      if (template?.status !== 'APPROVED' || !['MARKETING', 'UTILITY'].includes(template.category ?? ''))
        throw new BadRequestException('Sync and select an approved Meta marketing or utility template');
      const parts = Array.isArray(template.components) ? template.components : [];
      const header = parts.find((part) => part && typeof part === 'object' && 'type' in part && part.type === 'HEADER');
      const format = header && typeof header === 'object' && 'format' in header ? header.format : null;
      const body = new Set((template.body ?? '').match(/{{\d+}}/g));
      if (message.params.length !== body.size || (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(format)) ?
        message.header?.type.toUpperCase() !== format : !!message.header))
        throw new BadRequestException('Complete the template body parameters and matching media header');
      rate = template.category === 'MARKETING' ? 0.8631 : 0.115;
    } else {
      freeCapacity = await this.wa.broadcastFreeCapacity(organizationId, account);
    }
    const eligible = contacts.filter(({ phone }) => {
      const conversation = byPhone.get(phone);
      return !blocked.has(phone) && !conversation?.blockedAt && !conversation?.lead?.optedOutAt &&
        (message.type === 'template' || isOpen(conversation?.lastInboundAt, now));
    });
    const canQueue = input.allowMetaCharges ? eligible.length : Math.min(eligible.length, freeCapacity ?? 0);
    const quote = { selected: ids.length, eligible: eligible.length, canQueue, skipped: ids.length - canQueue,
      freeCapacity, brokerIqFee: 0, currency: 'INR', balance: null, remainingBalance: null,
      estimatedCost: input.allowMetaCharges ? rateCardCurrent ? Math.ceil(canQueue * rate * 100) / 100 : null : 0,
      allowMetaCharges: input.allowMetaCharges };
    if (!canQueue || quote.estimatedCost === null) return { ...quote, id: null };
    const saved = await this.db.whatsAppBroadcast.create({ data: {
      organizationId, createdById: user.id, name: input.name, accountId: String(account.businessAccountId), phoneNumberId: String(account.phoneNumberId),
      message, quote, allowMetaCharges: input.allowMetaCharges, expiresAt: new Date(now.valueOf() + quoteTtl),
      recipients: { createMany: { data: eligible.slice(0, canQueue).map(({ id: contactId }) => ({ contactId })) } },
    }, select: { id: true } });
    return { ...quote, id: saved.id };
  }

  async enqueue(user: RequestUser, id: string) {
    const organizationId = this.firm(user, 'send');
    await this.access.assertAllowed(user, 'chat');
    return this.db.$transaction(async (tx) => {
      const queued = await tx.whatsAppBroadcast.updateMany({ where: { id, organizationId, createdById: user.id, queuedAt: null, expiresAt: { gt: new Date() } },
        data: { queuedAt: new Date() } });
      if (!queued.count) throw new ConflictException('Preview expired or already confirmed');
      const recipients = await tx.whatsAppBroadcastRecipient.findMany({ where: { broadcastId: id }, select: { id: true } });
      await tx.job.createMany({ data: recipients.map(({ id: recipientId }) => ({
        type: jobType, key: jobType + ':' + recipientId, payload: { orgId: organizationId, recipientId },
      })) });
      await tx.auditLog.create({ data: { actorId: user.id, actorRole: user.role, organizationId, action: 'whatsapp.broadcast.queue',
        entity: 'WhatsAppBroadcast', entityId: id, meta: { recipients: recipients.length } } });
      return { id, queued: recipients.length };
    }, { timeout: 20_000 });
  }

  async retryBilling(user: RequestUser, id: string) {
    const organizationId = this.firm(user, 'send');
    await this.access.assertAllowed(user, 'chat');
    const now = new Date();
    if (now < listRatesEffective || now >= nextRateQuarter) throw new ConflictException('Create a new cost preview using the current Meta rate card.');
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'whatsapp-broadcast-billing:' + id}))`;
      const broadcast = await tx.whatsAppBroadcast.findFirst({ where: { id, organizationId, queuedAt: { not: null } } });
      if (!broadcast) throw new NotFoundException('Broadcast not found');
      const recipients = await tx.whatsAppBroadcastRecipient.findMany({
        where: { broadcastId: id, status: 'BILLING_ACTION_NEEDED' }, select: { id: true },
      });
      if (!recipients.length) throw new ConflictException('No recipients are waiting for Meta Billing');
      const keys = recipients.map(({ id: recipientId }) => jobType + ':' + recipientId);
      const reset = await tx.job.updateMany({ where: { key: { in: keys }, status: { in: ['DONE', 'FAILED'] } },
        data: { status: 'PENDING', attempts: 0, runAt: now, lastError: null, lockedAt: null } });
      if (reset.count !== recipients.length) throw new ConflictException('Wait for the current delivery attempts to finish.');
      await tx.whatsAppBroadcastRecipient.updateMany({ where: { id: { in: recipients.map(({ id: recipientId }) => recipientId) } },
        data: { status: 'PENDING', error: null } });
      await tx.auditLog.create({ data: { actorId: user.id, actorRole: user.role, organizationId, action: 'whatsapp.broadcast.billing_retry',
        entity: 'WhatsAppBroadcast', entityId: id, meta: { recipients: reset.count } } });
      return { id, queued: reset.count };
    });
  }

  private async deliver(id: string) {
    const recipient = await this.db.whatsAppBroadcastRecipient.findUnique({ where: { id }, include: { broadcast: true } });
    if (!recipient || !recipient.broadcast.queuedAt) return;
    const { organizationId, createdById, accountId, phoneNumberId, allowMetaCharges, message } = recipient.broadcast;
    if (recipient.status === 'SENDING') {
      const receipt = await this.db.message.findFirst({ where: { conversation: { organizationId }, meta: { path: ['broadcastRecipientId'], equals: id } },
        select: { id: true, externalId: true } });
      await this.db.whatsAppBroadcastRecipient.update({ where: { id }, data: { status: receipt?.externalId ? 'SENT' : 'REVIEW', messageId: receipt?.externalId ? receipt.id : null } });
      return;
    }
    if (recipient.status !== 'PENDING') return;
    const [contact, actor] = await Promise.all([
      this.db.whatsAppBroadcastContact.findFirst({ where: { id: recipient.contactId, organizationId, ...authorizedContact } }),
      this.db.user.findFirst({ where: { id: createdById, organizationId, role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null },
        select: { email: true, role: true, delegatedPermissions: true } }),
    ]);
    const allowed = actor && (!actor.delegatedPermissions.includes('$role-permissions') ||
      ['inbox:view', 'inbox:send'].every((grant) => actor.delegatedPermissions.includes(grant)));
    const stop = contact ? await this.db.lead.findFirst({ where: { organizationId, deletedAt: null, optedOutAt: { not: null },
      phone: { in: ['+' + contact.phone, contact.phone, contact.phone.slice(-10)] } }, select: { id: true } }) : null;
    const claim = await this.db.whatsAppBroadcastRecipient.updateMany({ where: { id, status: 'PENDING' },
      data: { status: contact && allowed && !stop ? 'SENDING' : 'SKIPPED' } });
    if (!claim.count || !contact || !actor || !allowed || stop) return;
    try {
      if (allowMetaCharges && new Date() >= nextRateQuarter) throw new ConflictException('Create a new cost preview using the current Meta rate card.');
      await this.access.assertAllowed({ id: createdById, orgId: organizationId, role: actor.role, email: actor.email ?? '' }, 'chat');
      const payload = broadcastMessage.parse(message);
      if (payload.type === 'template' && !await this.db.whatsAppTemplate.count({ where: {
        organizationId, name: payload.name, language: payload.language, status: 'APPROVED', category: { in: ['MARKETING', 'UTILITY'] },
      } })) throw new BadRequestException('Template approval changed after preview');
      const saved = await this.wa.send(organizationId, '+' + contact.phone, payload, {
        ownNumberOnly: true, contactName: contact.name, userId: createdById,
        meta: { broadcastRecipientId: id }, broadcast: { accountId, phoneNumberId, allowMetaCharges },
      });
      await this.db.whatsAppBroadcastRecipient.update({ where: { id }, data: { status: 'SENT', messageId: saved.id } });
    } catch (error) {
      const receipt = await this.db.message.findFirst({ where: { conversation: { organizationId }, meta: { path: ['broadcastRecipientId'], equals: id } },
        select: { id: true, externalId: true, status: true } });
      await this.db.whatsAppBroadcastRecipient.update({ where: { id }, data: receipt?.externalId
        ? { status: 'SENT', messageId: receipt.id }
        : { status: error instanceof WhatsAppBillingException ? 'BILLING_ACTION_NEEDED' :
          receipt && !(error && typeof error === 'object' && 'getStatus' in error) ? 'REVIEW' : 'FAILED',
          error: (error as Error).message.slice(0, 240) } });
    }
  }
}
