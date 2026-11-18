import { randomUUID } from 'node:crypto';
import { ConflictException, BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { parseLeadQuery } from './lead-query';
import { csvCell } from '../../common/csv';
import { Prisma, type LeadSource, type LeadStage } from '@prisma/client';
import {
  parseRentalQuery,
  hasDelegatedAccess,
  shareablePropertyPhotoUrls,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_LABELS,
  followUpIstDayEnd,
  formatPriceShort,
  normalizeIndianPhone,
  type LeadInput,
  type LeadRequirementInput,
} from '@brokeriq/shared';
import { JobsService } from '../../core/jobs/jobs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../core/events/events.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { UsageService } from '../../core/usage/usage.service';
import { AiService } from '../../core/ai/ai.service';
import { SettingsService } from '../../core/settings/settings.service';
import { paged, requireOrg, shortCode } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';
import { LISTING_CARD_SELECT } from '../listings/listings.service';
import { SHAREABLE_LISTING } from '../listings/public-listing-scope';
import { env } from '../../config/env';
import { LEAD_INSIGHTS_SYSTEM, leadInsightsSchema, type LeadInsights } from '../../core/ai/prompts';

export interface IngestInput {
  orgId: string;
  name?: string | null;
  phone: string;
  email?: string | null;
  source: LeadSource;
  sourceRef?: string | null;
  sourceDetail?: string | null;
  listingId?: string | null;
  message?: string | null;
  rawPayload?: unknown;
  requirement?: Partial<LeadRequirementInput>;
  assignedToId?: string | null;
  actorId?: string | null;
}

export interface LeadListQuery {
  q?: string;
  stage?: string;
  source?: string;
  assignedToId?: string;
  temperature?: string;
  tag?: string;
  from?: string;
  to?: string;
  dateField?: 'createdAt' | 'stageChangedAt';
  responseSla?: 'eligible';
  view?: 'all' | 'unassigned' | 'mine' | 'due' | 'new' | 'stale';
  page?: number;
  pageSize?: number;
  sort?: 'recent' | 'created' | 'score' | 'followup';
}

const LEAD_LIST_INCLUDE = {
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  listing: { select: { id: true, title: true, slug: true, bedrooms: true, furnishing: true, locality: { select: { name: true } } } },
  requirement: true,
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly usage: UsageService,
    private readonly ai: AiService,
    private readonly settings: SettingsService,
    private readonly jobs: JobsService,
  ) {
    this.jobs.register('lead.assignment-notification', async ({ notificationId }) => {
      const note = await this.prisma.notification.findUnique({ where: { id: notificationId }, include: { user: true } });
      if (!note || note.user.status !== 'ACTIVE' || note.user.deletedAt) return;
      if ((await this.notifications.hiddenLeadNotifications(note.userId)).includes(note.id)) return;
      await this.notifications.dispatchSaved(note);
    });
  }

  private async queueAssignmentNotification(tx: Prisma.TransactionClient, userIds: string[], lead: { id: string; name: string }, kind: string, body: string) {
    const notes = await tx.notification.createManyAndReturn({
      data: [...new Set(userIds)].map((userId) => ({
        userId,
        kind,
        title: kind === 'LEAD_ASSIGNED' ? `Lead assigned: ${lead.name}` : `Lead accepted: ${lead.name}`,
        body,
        link: `/broker/leads/${lead.id}`,
        data: { leadId: lead.id },
      })),
    });
    if (notes.length)
      await tx.job.createMany({
        data: notes.map((note) => ({ type: 'lead.assignment-notification', key: 'assignment-notification:' + note.id, payload: { notificationId: note.id } })),
      });
  }

  // ------------------------------------------------------------------ scoping
  scope(user: RequestUser): Prisma.LeadWhereInput {
    const orgId = requireOrg(user);
    return { organizationId: orgId, deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) };
  }

  async getScoped(id: string, user: RequestUser) {
    const lead = await this.prisma.lead.findFirst({ where: { id, ...this.scope(user) } });
    if (!lead) throw new NotFoundException('Lead नहीं मिली');
    return lead;
  }

  // ------------------------------------------------------------------ ingestion (all sources)
  /**
   * Creates a lead or merges into an existing one with the same phone (per organization).
   * Every channel — website enquiries, portal emails, webhooks, Facebook, WhatsApp, CSV — goes through here.
   */
  async ingest(input: IngestInput) {
    const phone = normalizeIndianPhone(input.phone) ?? (input.phone?.replace(/[^\d+]/g, '') || null);
    if (!phone || phone.replace(/\D/g, '').length < 10) throw new BadRequestException('Valid phone number ज़रूरी है');
    const enquiryText = [input.sourceDetail, input.message, input.requirement?.notes].filter(Boolean).join('\n');
    const hints = parseRentalQuery(enquiryText);
    const locality =
      !input.requirement?.localityIds?.length && hints.localityText
        ? await this.prisma.locality.findFirst({ where: { name: { equals: hints.localityText, mode: 'insensitive' } }, select: { id: true } })
        : null;
    const requirement = {
      ...input.requirement,
      bedrooms: input.requirement?.bedrooms?.length ? input.requirement.bedrooms : hints.bedrooms,
      furnishing: input.requirement?.furnishing ?? hints.furnishing,
      localityIds: input.requirement?.localityIds?.length ? input.requirement.localityIds : locality ? [locality.id] : [],
    };
    const hasRequirement = !!input.requirement || !!requirement.bedrooms.length || !!requirement.furnishing || !!requirement.localityIds.length;
    const org = await this.prisma.organization.findUnique({ where: { id: input.orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    const name = (input.name || '').trim() || 'Unknown';
    const existing = await this.prisma.lead.findUnique({
      where: { organizationId_phone: { organizationId: input.orgId, phone } },
      include: { requirement: true },
    });

    if (existing) {
      const reopened = existing.stage === 'LOST' || existing.deletedAt;
      const lead = await this.prisma.lead.update({
        where: { id: existing.id },
        data: {
          repeatCount: { increment: 1 },
          deletedAt: null,
          ...(reopened ? { stage: 'NEW', stageChangedAt: new Date(), lostReason: null } : {}),
          name: existing.name === 'Unknown' ? name : undefined,
          email: existing.email ?? (input.email || null),
          listingId: input.listingId ?? existing.listingId,
          assignedToId: existing.assignedToId ? undefined : (input.assignedToId ?? undefined),
          lastActivityAt: new Date(),
        },
      });
      await this.prisma.activity.create({
        data: {
          organizationId: input.orgId,
          leadId: lead.id,
          userId: input.actorId ?? null,
          type: 'ENQUIRY',
          content: `Repeat enquiry via ${LEAD_SOURCE_LABELS[input.source]}${input.sourceDetail ? ` — ${input.sourceDetail}` : ''}${input.message ? `\n${input.message}` : ''}`,
          meta: { source: input.source, sourceRef: input.sourceRef } as Prisma.InputJsonValue,
        },
      });
      if (hasRequirement) {
        // Each predicate is checked by PostgreSQL at write time so a concurrent
        // manual requirement edit is never replaced by an older enquiry snapshot.
        await this.prisma.$transaction(async (tx) => {
          await tx.leadRequirement.upsert({
            where: { leadId: lead.id },
            create: { leadId: lead.id, ...this.requirementData(requirement) },
            update: {},
          });
          if (requirement.bedrooms.length)
            await tx.leadRequirement.updateMany({ where: { leadId: lead.id, bedrooms: { isEmpty: true } }, data: { bedrooms: requirement.bedrooms } });
          if (requirement.furnishing)
            await tx.leadRequirement.updateMany({ where: { leadId: lead.id, furnishing: null }, data: { furnishing: requirement.furnishing } });
          if (requirement.localityIds.length)
            await tx.leadRequirement.updateMany({ where: { leadId: lead.id, localityIds: { isEmpty: true } }, data: { localityIds: requirement.localityIds } });
        });
      }
      await this.notifyNew(lead.id, input.orgId, true);
      this.events.emit('lead.created', { leadId: lead.id, orgId: input.orgId, isNew: false });
      return { lead, isNew: false };
    }

    const lead = await this.prisma.lead.create({
      data: {
        organizationId: input.orgId,
        name,
        phone,
        email: input.email || null,
        source: input.source,
        sourceRef: input.sourceRef ?? null,
        sourceDetail: input.sourceDetail ?? null,
        listingId: input.listingId ?? null,
        assignedToId: input.assignedToId ?? null,
        notes: input.message ?? null,
        rawPayload: (input.rawPayload ?? undefined) as Prisma.InputJsonValue | undefined,
        lastActivityAt: new Date(),
        requirement: hasRequirement ? { create: this.requirementData(requirement) } : undefined,
        activities: {
          create: {
            organizationId: input.orgId,
            userId: input.actorId ?? null,
            type: 'ENQUIRY',
            content: `New lead from ${LEAD_SOURCE_LABELS[input.source]}${input.sourceDetail ? ` — ${input.sourceDetail}` : ''}${input.message ? `\n${input.message}` : ''}`,
            meta: { source: input.source, sourceRef: input.sourceRef } as Prisma.InputJsonValue,
          },
        },
      },
    });
    await this.usage.increment(input.orgId, 'leads');
    await this.notifyNew(lead.id, input.orgId, false);
    this.events.emit('lead.created', { leadId: lead.id, orgId: input.orgId, isNew: true });
    return { lead, isNew: true };
  }

  private requirementData(r: Partial<LeadRequirementInput>) {
    return {
      purpose: r.purpose ?? null,
      propertyTypes: (r.propertyTypes ?? []) as any,
      localityIds: r.localityIds ?? [],
      minBudget: r.minBudget ?? null,
      maxBudget: r.maxBudget ?? null,
      bedrooms: r.bedrooms ?? [],
      minArea: r.minArea ?? null,
      maxArea: r.maxArea ?? null,
      furnishing: r.furnishing ?? null,
      notes: r.notes ?? null,
    };
  }

  private async notifyNew(leadId: string, orgId: string, repeat: boolean) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;
    const title = repeat ? `🔁 Repeat enquiry: ${lead.name}` : `🔥 नई lead: ${lead.name}`;
    const body = `${LEAD_SOURCE_LABELS[lead.source]}${lead.sourceDetail ? ` · ${lead.sourceDetail}` : ''}`;
    const link = `/broker/leads/${lead.id}`;
    if (lead.assignedToId) await this.notifications.notify(lead.assignedToId, { kind: 'NEW_LEAD', title, body, link, data: { leadId } });
    await this.notifications.notifyOrg(orgId, { kind: 'NEW_LEAD', title, body, link, data: { leadId } }, { adminsOnly: true });
    if (!repeat) {
      const admins = await this.prisma.user.findMany({ where: { organizationId: orgId, role: 'BROKER_ADMIN', status: 'ACTIVE' }, select: { email: true } });
      if (admins.length) {
        this.mail
          .trySendTemplate(
            'lead.new',
            admins.map((a) => a.email),
            { lead, source: LEAD_SOURCE_LABELS[lead.source], link: `${env().PUBLIC_WEB_URL}${link}` },
          )
          .catch(() => undefined);
      }
    }
  }

  // ------------------------------------------------------------------ queries
  private listQuery(user: RequestUser, input: LeadListQuery) {
    const q = parseLeadQuery(input);
    const and: Prisma.LeadWhereInput[] = [this.scope(user)];
    if (q.stage) and.push({ stage: { in: q.stage.split(',') as LeadStage[] } });
    if (q.source) and.push({ source: { in: q.source.split(',') as LeadSource[] } });
    if (q.assignedToId) and.push({ assignedToId: q.assignedToId === 'none' ? null : q.assignedToId });
    if (q.temperature) and.push({ temperature: q.temperature });
    if (q.tag) and.push({ tags: { has: q.tag } });
    const dateField = q.dateField ?? 'createdAt';
    const parseBound = (value: string, end: boolean) => {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
      const date = new Date(dateOnly ? value + 'T00:00:00+05:30' : value);
      if (!Number.isFinite(date.getTime()) || (dateOnly && new Date(value).toISOString().slice(0, 10) !== value))
        throw new BadRequestException('Invalid reporting date');
      return dateOnly && end ? new Date(date.getTime() + 86400000) : date;
    };
    const from = q.from ? parseBound(q.from, false) : null,
      to = q.to ? parseBound(q.to, true) : null;
    if (from && to && from > to) throw new BadRequestException('Invalid reporting date range');
    if (from) and.push({ [dateField]: { gte: from } });
    if (to) and.push({ [dateField]: /^\d{4}-\d{2}-\d{2}$/.test(q.to!) ? { lt: to } : { lte: to } });
    if (q.responseSla) {
      and.push({ OR: [{ firstResponseAt: { not: null } }, { createdAt: { lte: new Date(Date.now() - 15 * 60_000) } }] });
    }
    if (q.q) {
      const s = q.q.trim();
      and.push({
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { phone: { contains: s.replace(/\s/g, '') } },
          { email: { contains: s, mode: 'insensitive' } },
          { sourceDetail: { contains: s, mode: 'insensitive' } },
        ],
      });
    }
    switch (q.view) {
      case 'unassigned':
        and.push({ assignedToId: null });
        break;
      case 'mine':
        and.push({ assignedToId: user.id });
        break;
      case 'due':
        and.push({ nextFollowUpAt: { lte: followUpIstDayEnd() } });
        break;
      case 'new':
        and.push({ stage: 'NEW' });
        break;
      case 'stale':
        and.push({ stage: { notIn: ['WON', 'LOST'] }, lastActivityAt: { lt: new Date(Date.now() - 3 * 86400_000) } });
        break;
    }
    const orderBy: Prisma.LeadOrderByWithRelationInput[] =
      q.sort === 'created'
        ? [{ createdAt: 'desc' }]
        : q.sort === 'score'
          ? [{ score: 'desc' }, { createdAt: 'desc' }]
          : q.sort === 'followup'
            ? [{ nextFollowUpAt: { sort: 'asc', nulls: 'last' } }]
            : [{ lastActivityAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
    orderBy.push({ id: 'desc' });
    return { where: { AND: and }, orderBy, page: q.page, pageSize: q.pageSize };
  }

  private async withRequirementLocalities<T extends { requirement?: { localityIds: string[] } | null }>(items: T[]) {
    const ids = [...new Set(items.flatMap((item) => item.requirement?.localityIds ?? []))];
    const localities = ids.length ? await this.prisma.locality.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const names = new Map(localities.map((locality) => [locality.id, locality.name]));
    return items.map((item) => ({
      ...item,
      requirement: item.requirement
        ? { ...item.requirement, localityNames: item.requirement.localityIds.flatMap((id) => (names.has(id) ? [names.get(id)!] : [])) }
        : null,
    }));
  }

  async list(user: RequestUser, q: LeadListQuery) {
    const { where, orderBy, page, pageSize } = this.listQuery(user, q);
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: LEAD_LIST_INCLUDE }),
      this.prisma.lead.count({ where }),
    ]);
    return paged(await this.withRequirementLocalities(items), total, page, pageSize);
  }

  async kanban(user: RequestUser, input: { source?: string; assignedToId?: string; q?: string }) {
    const q = parseLeadQuery(input);
    const base: Prisma.LeadWhereInput = {
      AND: [this.scope(user), ...(q.assignedToId ? [{ assignedToId: q.assignedToId }] : [])],
      ...(q.source ? { source: { in: q.source.split(',') as LeadSource[] } } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }] } : {}),
    };
    const stages: LeadStage[] = [
      'NEW',
      'CONTACTED',
      'FOLLOW_UP',
      'INTERESTED',
      'NOT_INTERESTED',
      'PHOTOS_SHARED',
      'SITE_VISIT',
      'SHORTLISTED',
      'NEGOTIATION',
      'WON',
      'LOST',
    ];
    const columns = await Promise.all(
      stages.map(async (stage) => {
        const where = {
          ...base,
          stage,
          ...(stage === 'WON' || stage === 'LOST' || stage === 'NOT_INTERESTED' ? { stageChangedAt: { gte: new Date(Date.now() - 30 * 86400_000) } } : {}),
        };
        const [items, count] = await Promise.all([
          this.prisma.lead.findMany({
            where,
            orderBy: [{ stageChangedAt: 'desc' }, { id: 'desc' }],
            take: 50,
            include: { ...LEAD_LIST_INCLUDE, _count: { select: { visits: { where: { status: 'COMPLETED' } } } } },
          }),
          this.prisma.lead.count({ where }),
        ]);
        return {
          stage,
          label: LEAD_STAGE_LABELS[stage],
          count,
          items: items.map(({ _count, ...item }) => ({ ...item, hasCompletedVisit: _count.visits > 0 })),
        };
      }),
    );
    return columns;
  }

  async detail(id: string, user: RequestUser) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, ...this.scope(user) },
      include: {
        ...LEAD_LIST_INCLUDE,
        activities: { orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        followUps: { orderBy: { dueAt: 'asc' }, include: { assignedTo: { select: { id: true, name: true } } } },
        visits: { orderBy: { scheduledAt: 'desc' }, include: { listing: { select: { id: true, title: true, slug: true } } } },
        deals: true,
        conversations: { select: { id: true, channel: true, lastMessageAt: true, unreadCount: true, lastPreview: true, lastInboundAt: true } },
        shareLinks: { orderBy: { createdAt: 'desc' }, take: 20, include: { listing: { select: { id: true, title: true, slug: true } } } },
      },
    });
    if (!lead) throw new NotFoundException('Lead नहीं मिली');
    const { rawPayload, ...rest } = lead;
    return { ...rest, hasRawPayload: !!rawPayload };
  }

  // ------------------------------------------------------------------ mutations
  async create(input: LeadInput, user: RequestUser) {
    const orgId = requireOrg(user);
    if (user.role === 'BROKER_AGENT' && input.assignedToId && input.assignedToId !== user.id)
      throw new ForbiddenException('Only firm admins can assign leads to other members');
    if (input.assignedToId) await this.assertMember(orgId, input.assignedToId);

    const normalizedPhone = normalizeIndianPhone(input.phone) ?? input.phone;
    const existing = await this.prisma.lead.findFirst({ where: { organizationId: orgId, phone: normalizedPhone, deletedAt: null } });
    if (existing && user.role === 'BROKER_AGENT' && existing.assignedToId && existing.assignedToId !== user.id) {
      const assigned = await this.prisma.user.findUnique({ where: { id: existing.assignedToId }, select: { name: true } });
      throw new BadRequestException(`यह Lead पहले से ${assigned?.name || 'अन्य एजेंट'} को असाइन है`);
    }

    const effectiveAssignee = user.role === 'BROKER_AGENT' ? user.id : (input.assignedToId ?? null);
    const { lead } = await this.ingest({
      orgId,
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      source: input.source,
      listingId: input.listingId,
      message: input.notes,
      requirement: input.requirement,
      assignedToId: effectiveAssignee,
      actorId: user.id,
    });
    const data: Prisma.LeadUpdateInput = {};
    if (input.stage && input.stage !== 'NEW') data.stage = input.stage;
    if (input.temperature) Object.assign(data, { temperature: input.temperature, temperatureManual: true });
    if (input.tags?.length) data.tags = input.tags;
    if (input.alternatePhone) data.alternatePhone = normalizeIndianPhone(input.alternatePhone) ?? input.alternatePhone;
    if (effectiveAssignee && !lead.assignedToId) data.assignedTo = { connect: { id: effectiveAssignee } };
    if (Object.keys(data).length) await this.prisma.lead.update({ where: { id: lead.id }, data });
    return this.detail(lead.id, user);
  }

  async update(id: string, input: Partial<LeadInput> & { lostReason?: string | null }, user: RequestUser) {
    const lead = await this.getScoped(id, user);
    const { requirement, stage, assignedToId, phone, alternatePhone, ...rest } = input;
    if (stage && stage !== lead.stage) await this.changeStage(id, stage, user, input.lostReason);
    if (assignedToId !== undefined && assignedToId !== lead.assignedToId) await this.assign(id, assignedToId, user);
    const data: Prisma.LeadUpdateInput = { ...(rest as any), email: rest.email === '' ? null : rest.email };
    // A person choosing HOT/WARM/COLD wins over automatic scoring; clearing it hands control back.
    if (rest.temperature !== undefined) data.temperatureManual = !!rest.temperature;
    if (phone) data.phone = normalizeIndianPhone(phone) ?? phone;
    if (alternatePhone !== undefined) data.alternatePhone = alternatePhone ? (normalizeIndianPhone(alternatePhone) ?? alternatePhone) : null;
    delete (data as any).source;
    delete (data as any).listingId;
    if (rest.listingId !== undefined) data.listing = rest.listingId ? { connect: { id: rest.listingId } } : { disconnect: true };
    await this.prisma.lead.update({ where: { id }, data });
    if (requirement) {
      const req = this.requirementData(requirement);
      await this.prisma.leadRequirement.upsert({ where: { leadId: id }, create: { leadId: id, ...req }, update: req });
    }
    this.events.emit('lead.updated', { leadId: id, orgId: lead.organizationId });
    return this.detail(id, user);
  }

  async changeStage(id: string, stage: LeadStage, user: RequestUser, lostReason?: string | null) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      const lead = await tx.lead.findFirst({ where: { id, ...this.scope(user) } });
      if (!lead) throw new NotFoundException('Lead नहीं मिली');
      if (lead.stage === stage) return { lead, from: lead.stage, changed: false };
      if (stage === 'PHOTOS_SHARED') throw new BadRequestException('Share the property photos or confirm that they were sent first.');
      if (stage === 'FOLLOW_UP') {
        const followUp = await tx.followUp.findFirst({ where: { leadId: id, organizationId: lead.organizationId, status: 'PENDING' }, select: { id: true } });
        if (!followUp) throw new BadRequestException('Schedule a follow-up before moving this lead to Follow-up.');
      }
      if (stage === 'SHORTLISTED') {
        const visit = await tx.siteVisit.findFirst({
          where: { leadId: lead.id, organizationId: lead.organizationId, status: 'COMPLETED' },
          select: { id: true },
        });
        if (!visit) throw new BadRequestException('Complete a site visit before marking this lead Shortlisted.');
      }
      const isClosedReasonStage = stage === 'LOST' || stage === 'NOT_INTERESTED';
      const closing = ['WON', 'LOST', 'NOT_INTERESTED'].includes(stage);
      const updated = await tx.lead.update({
        where: { id },
        data: {
          stage,
          stageChangedAt: new Date(),
          lostReason: isClosedReasonStage ? (lostReason ?? null) : null,
          lastActivityAt: new Date(),
          firstResponseAt: lead.firstResponseAt ?? (stage !== 'NEW' ? new Date() : null),
          ...(closing ? { nextFollowUpAt: null } : {}),
          activities: {
            create: {
              organizationId: lead.organizationId,
              userId: user.id,
              type: 'STAGE_CHANGE',
              content: `${LEAD_STAGE_LABELS[lead.stage]} → ${LEAD_STAGE_LABELS[stage]}${isClosedReasonStage && lostReason ? ` (${lostReason})` : ''}`,
              meta: { from: lead.stage, to: stage } as Prisma.InputJsonValue,
            },
          },
        },
      });
      if (closing)
        await tx.followUp.updateMany({ where: { leadId: id, organizationId: lead.organizationId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      return { lead: updated, from: lead.stage, changed: true };
    });
    if (result.changed)
      this.events.emit('lead.stage_changed', { leadId: id, orgId: result.lead.organizationId, from: result.from, to: stage, userId: user.id });
    return result.lead;
  }

  async confirmPropertyPhotosShared(id: string, inventoryId: string, user: RequestUser, messageId?: string) {
    const actor = { ...user, role: user.delegatedActor ? 'SUB_BROKER_ADMIN' : user.role };
    if (!hasDelegatedAccess(actor, 'inventory', 'view') || !hasDelegatedAccess(actor, 'leads', 'edit'))
      throw new ForbiddenException('Photo sharing and lead edit permissions are required');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
      const lead = await tx.lead.findFirst({ where: { id, ...this.scope(user) } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (!['NEW', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED', 'PHOTOS_SHARED', 'SITE_VISIT'].includes(lead.stage)) {
        if (messageId) return { lead, changed: false, from: lead.stage };
        throw new BadRequestException('This lead has already moved past photo sharing');
      }
      const inventory = await tx.inventoryItem.findFirst({
        where: {
          id: inventoryId,
          organizationId: lead.organizationId,
          deletedAt: null,
          ...(user.role === 'BROKER_AGENT'
            ? { OR: [{ assignedToId: user.id }, { createdById: user.id }, { detailAccess: { some: { agentId: user.id, status: 'APPROVED' } } }] }
            : {}),
        },
        select: { id: true, photoUrls: true },
      });
      if (!inventory || !shareablePropertyPhotoUrls(inventory.photoUrls).length) throw new NotFoundException('Property photos not found');
      const completed = await tx.siteVisit.findFirst({ where: { leadId: id, organizationId: lead.organizationId, status: 'COMPLETED' }, select: { id: true } });
      if (completed && !messageId) throw new BadRequestException('This lead already has a completed site visit.');
      if (completed || lead.stage === 'PHOTOS_SHARED') return { lead, changed: false, from: lead.stage };
      if (lead.stage === 'SITE_VISIT') {
        const recorded = await tx.activity.findFirst({
          where: {
            leadId: id,
            organizationId: lead.organizationId,
            type: 'PROPERTY_SHARED',
            meta: { path: messageId ? ['messageId'] : ['inventoryId'], equals: messageId ?? inventoryId },
          },
          select: { id: true },
        });
        if (recorded) return { lead, changed: false, from: lead.stage };
      }
      // Sharing photos for an already scheduled visit must not move the lead backwards.
      const nextStage = lead.stage === 'SITE_VISIT' ? lead.stage : 'PHOTOS_SHARED';
      const changed = nextStage !== lead.stage;
      const updated = await tx.lead.update({
        where: { id },
        data: {
          stage: nextStage,
          ...(changed ? { stageChangedAt: new Date() } : {}),
          lastActivityAt: new Date(),
          activities: {
            create: {
              organizationId: lead.organizationId,
              userId: user.id,
              type: 'PROPERTY_SHARED',
              content: messageId ? 'Property photos sent from BrokerIQ' : 'Agent confirmed property photos sent outside BrokerIQ',
              meta: { inventoryId, messageId: messageId ?? null, channel: messageId ? 'BROKERIQ_WHATSAPP' : 'EXTERNAL_CONFIRMATION' },
            },
          },
        },
      });
      if (changed)
        await tx.activity.create({
          data: {
            organizationId: lead.organizationId,
            leadId: id,
            userId: user.id,
            type: 'STAGE_CHANGE',
            content: LEAD_STAGE_LABELS[lead.stage] + ' → ' + LEAD_STAGE_LABELS.PHOTOS_SHARED,
            meta: { from: lead.stage, to: 'PHOTOS_SHARED' },
          },
        });
      return { lead: updated, changed, from: lead.stage };
    });
    if (result.changed)
      this.events.emit('lead.stage_changed', { leadId: id, orgId: result.lead.organizationId, from: result.from, to: 'PHOTOS_SHARED', userId: user.id });
    return result.lead;
  }

  /** Uses only a successfully persisted outbound message and current firm permissions. */
  async recordSentPropertyPhotos(messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId }, include: { conversation: true } });
    if (
      !message ||
      message.direction !== 'OUTBOUND' ||
      !['SENT', 'DELIVERED', 'READ'].includes(message.status) ||
      !message.senderUserId ||
      !message.conversation.leadId ||
      !message.conversation.organizationId
    )
      return;
    const photos = shareablePropertyPhotoUrls([...(message.body?.match(/https:\/\/[^\s<>]+/g) ?? []), ...(message.mediaUrl ? [message.mediaUrl] : [])]);
    const galleryIds = (message.body?.match(/https?:\/\/[^\s<>]+/g) ?? []).flatMap((value) => {
      try {
        const url = new URL(value);
        return url.origin === new URL(env().PUBLIC_WEB_URL).origin && /^\/photos\/[a-f0-9]{48}$/.test(url.pathname) ? [url.pathname.split('/').pop()!] : [];
      } catch {
        return [];
      }
    });
    if (!photos.length && !galleryIds.length) return;
    const actor = await this.prisma.user.findFirst({
      where: { id: message.senderUserId, organizationId: message.conversation.organizationId, status: 'ACTIVE', deletedAt: null },
    });
    if (
      !actor ||
      !['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(actor.role) ||
      !hasDelegatedAccess(actor, 'leads', 'edit') ||
      !hasDelegatedAccess(actor, 'inventory', 'view')
    )
      return;
    const inventory = await this.prisma.inventoryItem.findFirst({
      where: {
        organizationId: actor.organizationId!,
        deletedAt: null,
        AND: [
          { OR: [{ photoUrls: { hasSome: photos } }, { photoGallery: { is: { id: { in: galleryIds } } } }] },
          ...(actor.role === 'BROKER_AGENT'
            ? [{ OR: [{ assignedToId: actor.id }, { createdById: actor.id }, { detailAccess: { some: { agentId: actor.id, status: 'APPROVED' } } }] }]
            : []),
        ],
      },
      select: { id: true },
    });
    if (!inventory) return;
    const user: RequestUser = {
      id: actor.id,
      email: actor.email!,
      orgId: actor.organizationId,
      role: actor.role,
      delegatedPermissions: actor.delegatedPermissions,
    };
    await this.confirmPropertyPhotosShared(message.conversation.leadId, inventory.id, user, messageId);
  }

  async assertMember(orgId: string, userId: string) {
    const m = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, status: 'ACTIVE', deletedAt: null, role: { in: ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'] } },
    });
    if (!m) throw new BadRequestException('यह user आपकी team में नहीं है');
    return m;
  }

  async assign(id: string, assigneeId: string | null, user: RequestUser | null, opts: { orgId?: string; viaAutomation?: boolean } = {}) {
    if (user && user.role === 'BROKER_AGENT') throw new ForbiddenException('सिर्फ admin leads assign कर सकते हैं');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${id} FOR UPDATE`;
      const lead = await tx.lead.findFirst({ where: { id, organizationId: user ? requireOrg(user) : opts.orgId, deletedAt: null } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (!user && (!opts.orgId || lead.organizationId !== opts.orgId)) throw new ForbiddenException('Explicit firm required for automated assignment');
      if (assigneeId) await tx.$queryRaw`SELECT id FROM "User" WHERE id=${assigneeId} FOR UPDATE`;
      const assignee = assigneeId
        ? await tx.user.findFirst({
            where: {
              id: assigneeId,
              organizationId: lead.organizationId,
              status: 'ACTIVE',
              deletedAt: null,
              role: { in: ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'] },
            },
          })
        : null;
      if (assigneeId && !assignee) throw new BadRequestException('Assigned member is not active in this firm');
      if (lead.assignedToId === assigneeId) return { lead, assignee, changed: false };
      await tx.lead.update({
        where: { id },
        data: {
          assignedToId: assigneeId,
          assignmentId: assigneeId ? randomUUID() : null,
          assignmentAcceptedAt: null,
          activities: {
            create: {
              organizationId: lead.organizationId,
              userId: user?.id ?? null,
              type: 'ASSIGNMENT',
              content: assignee ? `Assigned to ${assignee.name}${opts.viaAutomation ? ' (automation)' : ''}` : 'Unassigned',
            },
          },
        },
      });
      await tx.followUp.updateMany({
        where: { leadId: id, organizationId: lead.organizationId, status: 'PENDING' },
        data: { assignedToId: assigneeId, reminderSentAt: null },
      });
      await tx.siteVisit.updateMany({
        where: { leadId: id, organizationId: lead.organizationId, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        data: { assignedToId: assigneeId, reminderSentAt: null },
      });
      if (assignee && assignee.id !== user?.id)
        await this.queueAssignmentNotification(tx, [assignee.id], lead, 'LEAD_ASSIGNED', 'A lead has been assigned to you. Open it and confirm acceptance.');
      return { lead, assignee, changed: true };
    });
    return { ok: true };
  }

  async acceptAssignment(id: string, assignmentId: string | null, user: RequestUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${id} FOR UPDATE`;
      const lead = await tx.lead.findFirst({ where: { id, ...this.scope(user) } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.assignedToId !== user.id) throw new ForbiddenException('Only the assigned member can accept this lead');
      if (lead.assignmentId !== assignmentId) throw new ConflictException('This lead was reassigned. Refresh before accepting.');
      if (lead.assignmentAcceptedAt) return { acceptedAt: lead.assignmentAcceptedAt };
      const acceptedAt = new Date();
      await tx.lead.update({
        where: { id },
        data: {
          assignmentAcceptedAt: acceptedAt,
          activities: {
            create: {
              organizationId: lead.organizationId,
              userId: user.id,
              type: 'ASSIGNMENT',
              content: 'Assigned lead accepted',
              meta: { assignmentId, acceptedAt: acceptedAt.toISOString() },
            },
          },
        },
      });
      const admins = await tx.user.findMany({
        where: {
          organizationId: lead.organizationId,
          status: 'ACTIVE',
          deletedAt: null,
          id: { not: user.id },
          OR: [{ role: 'BROKER_ADMIN' }, { role: 'SUB_BROKER_ADMIN', delegatedPermissions: { hasEvery: ['leads:view', 'leads:assign'] } }],
        },
        select: { id: true },
      });
      await this.queueAssignmentNotification(
        tx,
        admins.map((admin) => admin.id),
        lead,
        'LEAD_ASSIGNMENT_ACCEPTED',
        'The assigned team member has accepted this lead.',
      );
      return { acceptedAt };
    });
  }

  /** Round-robin across active team members (optionally limited to a subset). */
  async assignRoundRobin(leadId: string, orgId: string, memberIds?: string[]) {
    const members = await this.prisma.user.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE',
        deletedAt: null,
        role: { in: ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'] },
        organization: { status: 'ACTIVE' },
        ...(memberIds?.length ? { id: { in: memberIds } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!members.length) return null;
    const org = await this.prisma.organization.update({ where: { id: orgId }, data: { roundRobinCursor: { increment: 1 } } });
    const next = members[(org.roundRobinCursor - 1) % members.length];
    await this.assign(leadId, next.id, null, { orgId, viaAutomation: true });
    return next.id;
  }

  async addActivity(id: string, input: { type: any; content?: string | null; callOutcome?: any; durationSec?: number | null }, user: RequestUser) {
    const lead = await this.getScoped(id, user);
    const activity = await this.prisma.activity.create({
      data: {
        organizationId: lead.organizationId,
        leadId: id,
        userId: user.id,
        type: input.type,
        content: input.content,
        callOutcome: input.callOutcome,
        durationSec: input.durationSec,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const patch: Prisma.LeadUpdateInput = { lastActivityAt: new Date() };
    if (!lead.firstResponseAt && ['CALL', 'WHATSAPP', 'EMAIL', 'SMS'].includes(input.type)) patch.firstResponseAt = new Date();
    if (lead.stage === 'NEW' && ['CALL', 'WHATSAPP', 'EMAIL'].includes(input.type) && input.callOutcome !== 'NO_ANSWER') {
      await this.changeStage(id, 'CONTACTED', user);
    }
    await this.prisma.lead.update({ where: { id }, data: patch });
    this.events.emit('lead.updated', { leadId: id, orgId: lead.organizationId });
    return activity;
  }

  async remove(id: string, user: RequestUser) {
    await this.getScoped(id, user);
    if (user.role === 'BROKER_AGENT') throw new ForbiddenException('सिर्फ admin leads delete कर सकते हैं');
    await this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async bulk(user: RequestUser, body: { ids: string[]; action: 'assign' | 'stage' | 'tag' | 'delete'; value?: string | null }) {
    if (!body.ids?.length) return { updated: 0 };
    const ids = (await this.prisma.lead.findMany({ where: { id: { in: body.ids.slice(0, 500) }, ...this.scope(user) }, select: { id: true } })).map(
      (l) => l.id,
    );
    for (const id of ids) {
      if (body.action === 'assign') await this.assign(id, body.value ?? null, user);
      else if (body.action === 'stage' && body.value) await this.changeStage(id, body.value as LeadStage, user);
      else if (body.action === 'tag' && body.value) await this.prisma.lead.update({ where: { id }, data: { tags: { push: body.value } } });
      else if (body.action === 'delete') await this.remove(id, user);
    }
    return { updated: ids.length };
  }

  async refreshNextFollowUp(leadId: string) {
    const next = await this.prisma.followUp.findFirst({ where: { leadId, status: 'PENDING' }, orderBy: { dueAt: 'asc' } });
    await this.prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: next?.dueAt ?? null } });
  }

  // ------------------------------------------------------------------ matching & sharing
  async matches(id: string, user: RequestUser, scope: 'org' | 'all' = 'org') {
    const lead = await this.prisma.lead.findFirst({ where: { id, ...this.scope(user) }, include: { requirement: true } });
    if (!lead) throw new NotFoundException();
    const r = lead.requirement;
    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      ...(scope === 'org' ? { organizationId: lead.organizationId } : {}),
      ...(r?.purpose ? { purpose: r.purpose } : {}),
      ...(r?.propertyTypes?.length ? { propertyType: { in: r.propertyTypes } } : {}),
      ...(r?.localityIds?.length ? { localityId: { in: r.localityIds } } : {}),
      ...(r?.maxBudget
        ? { price: { lte: r.maxBudget * 1.1, ...(r.minBudget ? { gte: r.minBudget * 0.8 } : {}) } }
        : r?.minBudget
          ? { price: { gte: r.minBudget * 0.8 } }
          : {}),
      ...(r?.bedrooms?.length ? { bedrooms: { in: r.bedrooms } } : {}),
    };
    const listings = await this.prisma.listing.findMany({
      where,
      take: 40,
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
      select: { ...LISTING_CARD_SELECT, localityId: true, amenities: true },
    });
    const scored = listings.map((l) => {
      let score = 50;
      if (r?.localityIds?.includes(l.localityId)) score += 20;
      if (r?.maxBudget && l.price <= r.maxBudget) score += 15;
      if (r?.bedrooms?.length && l.bedrooms && r.bedrooms.includes(l.bedrooms)) score += 10;
      if (r?.furnishing && l.furnishing === r.furnishing) score += 5;
      return { ...l, matchScore: Math.min(100, score) };
    });
    return scored.sort((a, b) => b.matchScore - a.matchScore);
  }

  async shareListing(id: string, listingId: string, user: RequestUser) {
    const lead = await this.getScoped(id, user);
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ...SHAREABLE_LISTING }, include: { locality: true } });
    if (!listing) throw new NotFoundException('Listing नहीं मिली');
    const code = shortCode(8);
    await this.prisma.shareLink.create({ data: { code, organizationId: lead.organizationId, listingId, leadId: id, createdById: user.id } });
    const url = `${env().PUBLIC_WEB_URL}/s/${code}`;
    const text = `नमस्ते ${lead.name} 👋\nआपकी requirement के हिसाब से यह property देखिए:\n*${listing.title}*\n💰 ${formatPriceShort(listing.price)}${listing.purpose === 'RENT' ? '/month' : ''} · 📍 ${listing.locality.name}\n${url}`;
    await this.prisma.activity.create({
      data: { organizationId: lead.organizationId, leadId: id, userId: user.id, type: 'PROPERTY_SHARED', content: listing.title, meta: { listingId, code } },
    });
    await this.prisma.lead.update({ where: { id }, data: { lastActivityAt: new Date() } });
    return { url, code, text };
  }

  // ------------------------------------------------------------------ AI
  async aiInsights(id: string, user: RequestUser) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, ...this.scope(user) },
      include: { requirement: true, activities: { where: { type: { not: 'EMAIL' } }, orderBy: { createdAt: 'desc' }, take: 30 }, visits: true },
    });
    if (!lead) throw new NotFoundException();
    await this.usage.assertAiCredit(lead.organizationId);
    const convo = await this.prisma.message.findMany({
      where: { conversation: { leadId: id, organizationId: lead.organizationId, channel: { not: 'EMAIL' } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const context = {
      lead: { name: lead.name, source: lead.source, stage: lead.stage, createdAt: lead.createdAt, notes: lead.notes, requirement: lead.requirement },
      activities: lead.activities.map((a) => ({ at: a.createdAt, type: a.type, content: a.content, callOutcome: a.callOutcome })),
      visits: lead.visits.map((v) => ({ at: v.scheduledAt, status: v.status, feedback: v.feedback })),
      whatsapp: convo.reverse().map((m) => ({ dir: m.direction, text: m.body })),
    };
    const out = await this.ai.json<LeadInsights>(
      [
        { role: 'system', content: LEAD_INSIGHTS_SYSTEM },
        { role: 'user', content: JSON.stringify(context) },
      ],
      { feature: 'lead_insights', orgId: lead.organizationId, userId: user.id, maxTokens: 700, temperature: 0.2, schema: leadInsightsSchema },
    );
    const score = Math.max(0, Math.min(100, Math.round(Number(out.score) || 0)));
    // Score/temperature on the lead come from rule-based scoring (explainable, updated on every event);
    // the AI's own estimate is returned with the insights only.
    await this.prisma.lead.update({ where: { id }, data: { aiSummary: out.summary } });
    return { ...out, score };
  }

  // ------------------------------------------------------------------ CSV
  async exportCsv(user: RequestUser, q: LeadListQuery) {
    const { where, orderBy } = this.listQuery(user, q);
    const all = await this.prisma.lead.findMany({ where, orderBy, take: 20001, include: LEAD_LIST_INCLUDE });
    if (all.length > 20000) throw new BadRequestException('एक export में अधिकतम 20,000 leads हैं। Date या source filter लगाकर export करें।');
    const header = ['Name', 'Phone', 'Email', 'Source', 'Stage', 'Temperature', 'Assigned to', 'Tags', 'Created', 'Last activity', 'Notes'];
    const rows = all.map((l) => [
      l.name,
      l.phone,
      l.email ?? '',
      LEAD_SOURCE_LABELS[l.source],
      LEAD_STAGE_LABELS[l.stage],
      l.temperature ?? '',
      l.assignedTo?.name ?? '',
      l.tags.join('|'),
      l.createdAt.toISOString(),
      l.lastActivityAt?.toISOString() ?? '',
      (l.notes ?? '').replace(/\s+/g, ' '),
    ]);
    return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  }

  async importRows(user: RequestUser, rows: Record<string, string>[]) {
    const orgId = requireOrg(user);
    let created = 0;
    let merged = 0;
    const errors: { row: number; error: string }[] = [];
    for (const [i, row] of rows.slice(0, 5000).entries()) {
      const get = (...keys: string[]) => {
        for (const k of Object.keys(row)) if (keys.includes(k.trim().toLowerCase())) return row[k]?.trim();
        return undefined;
      };
      const phone = get('phone', 'mobile', 'phone number', 'contact', 'mobile number');
      if (!phone) {
        errors.push({ row: i + 2, error: 'phone missing' });
        continue;
      }
      try {
        const res = await this.ingest({
          orgId,
          name: get('name', 'full name', 'customer name'),
          phone,
          email: get('email', 'email id'),
          source: 'CSV_IMPORT',
          message: get('notes', 'requirement', 'remarks', 'message'),
          sourceDetail: get('source', 'project', 'property'),
          actorId: user.id,
        });
        if (res.isNew) created++;
        else merged++;
      } catch (e) {
        errors.push({ row: i + 2, error: (e as Error).message });
      }
    }
    return { created, merged, failed: errors.length, errors: errors.slice(0, 50) };
  }
}
