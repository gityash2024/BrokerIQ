import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type LeadSource, type LeadStage } from '@prisma/client';
import {
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_LABELS,
  formatPriceShort,
  normalizeIndianPhone,
  type LeadInput,
  type LeadRequirementInput,
} from '@brokeriq/shared';
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
  view?: 'all' | 'unassigned' | 'mine' | 'due' | 'new' | 'stale';
  page?: number;
  pageSize?: number;
  sort?: 'recent' | 'created' | 'score' | 'followup';
}

const LEAD_LIST_INCLUDE = {
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  listing: { select: { id: true, title: true, slug: true } },
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
  ) {}

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
    const org = await this.prisma.organization.findUnique({ where: { id: input.orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    const name = (input.name || '').trim() || 'Unknown';
    const existing = await this.prisma.lead.findUnique({ where: { organizationId_phone: { organizationId: input.orgId, phone } } });

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
        requirement: input.requirement ? { create: this.requirementData(input.requirement) } : undefined,
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
          .trySendTemplate('lead.new', admins.map((a) => a.email), { lead, source: LEAD_SOURCE_LABELS[lead.source], link: `${env().PUBLIC_WEB_URL}${link}` })
          .catch(() => undefined);
      }
    }
  }

  // ------------------------------------------------------------------ queries
  async list(user: RequestUser, q: LeadListQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Number(q.pageSize) || 30);
    const and: Prisma.LeadWhereInput[] = [this.scope(user)];
    if (q.stage) and.push({ stage: { in: q.stage.split(',') as LeadStage[] } });
    if (q.source) and.push({ source: { in: q.source.split(',') as LeadSource[] } });
    if (q.assignedToId) and.push({ assignedToId: q.assignedToId === 'none' ? null : q.assignedToId });
    if (q.temperature) and.push({ temperature: q.temperature as any });
    if (q.tag) and.push({ tags: { has: q.tag } });
    if (q.from) and.push({ createdAt: { gte: new Date(q.from) } });
    if (q.to) and.push({ createdAt: { lte: new Date(q.to) } });
    if (q.q) {
      const s = q.q.trim();
      and.push({ OR: [{ name: { contains: s, mode: 'insensitive' } }, { phone: { contains: s.replace(/\s/g, '') } }, { email: { contains: s, mode: 'insensitive' } }, { sourceDetail: { contains: s, mode: 'insensitive' } }] });
    }
    switch (q.view) {
      case 'unassigned':
        and.push({ assignedToId: null });
        break;
      case 'mine':
        and.push({ assignedToId: user.id });
        break;
      case 'due':
        and.push({ nextFollowUpAt: { lte: endOfToday() } });
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
    const where = { AND: and };
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: LEAD_LIST_INCLUDE }),
      this.prisma.lead.count({ where }),
    ]);
    return paged(items, total, page, pageSize);
  }

  async kanban(user: RequestUser, q: { source?: string; assignedToId?: string; q?: string }) {
    const base: Prisma.LeadWhereInput = {
      ...this.scope(user),
      ...(q.source ? { source: { in: q.source.split(',') as LeadSource[] } } : {}),
      ...(q.assignedToId ? { assignedToId: q.assignedToId } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }] } : {}),
    };
    const stages: LeadStage[] = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'WON', 'LOST'];
    const columns = await Promise.all(
      stages.map(async (stage) => {
        const where = { ...base, stage, ...(stage === 'WON' || stage === 'LOST' ? { stageChangedAt: { gte: new Date(Date.now() - 30 * 86400_000) } } : {}) };
        const [items, count] = await Promise.all([
          this.prisma.lead.findMany({ where, orderBy: [{ stageChangedAt: 'desc' }], take: 50, include: LEAD_LIST_INCLUDE }),
          this.prisma.lead.count({ where }),
        ]);
        return { stage, label: LEAD_STAGE_LABELS[stage], count, items };
      }),
    );
    return columns;
  }

  async detail(id: string, user: RequestUser) {
    await this.getScoped(id, user);
    const lead = await this.prisma.lead.findUniqueOrThrow({
      where: { id },
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
    const { rawPayload, ...rest } = lead;
    return { ...rest, hasRawPayload: !!rawPayload };
  }

  // ------------------------------------------------------------------ mutations
  async create(input: LeadInput, user: RequestUser) {
    const orgId = requireOrg(user);
    if (input.assignedToId) await this.assertMember(orgId, input.assignedToId);
    const { lead } = await this.ingest({
      orgId,
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      source: input.source,
      listingId: input.listingId,
      message: input.notes,
      requirement: input.requirement,
      assignedToId: input.assignedToId ?? (user.role === 'BROKER_AGENT' ? user.id : null),
      actorId: user.id,
    });
    const data: Prisma.LeadUpdateInput = {};
    if (input.stage && input.stage !== 'NEW') data.stage = input.stage;
    if (input.temperature) data.temperature = input.temperature;
    if (input.tags?.length) data.tags = input.tags;
    if (input.alternatePhone) data.alternatePhone = normalizeIndianPhone(input.alternatePhone) ?? input.alternatePhone;
    if (Object.keys(data).length) await this.prisma.lead.update({ where: { id: lead.id }, data });
    return this.detail(lead.id, user);
  }

  async update(id: string, input: Partial<LeadInput> & { lostReason?: string | null }, user: RequestUser) {
    const lead = await this.getScoped(id, user);
    const { requirement, stage, assignedToId, phone, alternatePhone, ...rest } = input;
    if (stage && stage !== lead.stage) await this.changeStage(id, stage, user, input.lostReason);
    if (assignedToId !== undefined && assignedToId !== lead.assignedToId) await this.assign(id, assignedToId, user);
    const data: Prisma.LeadUpdateInput = { ...(rest as any), email: rest.email === '' ? null : rest.email };
    if (phone) data.phone = normalizeIndianPhone(phone) ?? phone;
    if (alternatePhone !== undefined) data.alternatePhone = alternatePhone ? normalizeIndianPhone(alternatePhone) ?? alternatePhone : null;
    delete (data as any).source;
    delete (data as any).listingId;
    if (rest.listingId !== undefined) data.listing = rest.listingId ? { connect: { id: rest.listingId } } : { disconnect: true };
    await this.prisma.lead.update({ where: { id }, data });
    if (requirement) {
      const req = this.requirementData(requirement);
      await this.prisma.leadRequirement.upsert({ where: { leadId: id }, create: { leadId: id, ...req }, update: req });
    }
    return this.detail(id, user);
  }

  async changeStage(id: string, stage: LeadStage, user: RequestUser, lostReason?: string | null) {
    const lead = await this.getScoped(id, user);
    if (lead.stage === stage) return lead;
    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        stage,
        stageChangedAt: new Date(),
        lostReason: stage === 'LOST' ? lostReason ?? null : null,
        lastActivityAt: new Date(),
        firstResponseAt: lead.firstResponseAt ?? (stage !== 'NEW' ? new Date() : null),
        activities: {
          create: {
            organizationId: lead.organizationId,
            userId: user.id,
            type: 'STAGE_CHANGE',
            content: `${LEAD_STAGE_LABELS[lead.stage]} → ${LEAD_STAGE_LABELS[stage]}${stage === 'LOST' && lostReason ? ` (${lostReason})` : ''}`,
            meta: { from: lead.stage, to: stage } as Prisma.InputJsonValue,
          },
        },
      },
    });
    if (['WON', 'LOST'].includes(stage)) {
      await this.prisma.followUp.updateMany({ where: { leadId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      await this.refreshNextFollowUp(id);
    }
    this.events.emit('lead.stage_changed', { leadId: id, orgId: lead.organizationId, from: lead.stage, to: stage, userId: user.id });
    return updated;
  }

  async assertMember(orgId: string, userId: string) {
    const m = await this.prisma.user.findFirst({ where: { id: userId, organizationId: orgId, status: 'ACTIVE' } });
    if (!m) throw new BadRequestException('यह user आपकी team में नहीं है');
    return m;
  }

  async assign(id: string, assigneeId: string | null, user: RequestUser | null, opts: { orgId?: string; viaAutomation?: boolean } = {}) {
    const lead = user ? await this.getScoped(id, user) : await this.prisma.lead.findUniqueOrThrow({ where: { id } });
    if (user && user.role === 'BROKER_AGENT') throw new ForbiddenException('सिर्फ admin leads assign कर सकते हैं');
    const assignee = assigneeId ? await this.assertMember(lead.organizationId, assigneeId) : null;
    await this.prisma.lead.update({
      where: { id },
      data: {
        assignedToId: assigneeId,
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
    await this.prisma.followUp.updateMany({ where: { leadId: id, status: 'PENDING' }, data: { assignedToId: assigneeId } });
    if (assignee && assignee.id !== user?.id) {
      await this.notifications.notify(assignee.id, { kind: 'LEAD_ASSIGNED', title: `Lead assigned: ${lead.name}`, body: `${LEAD_SOURCE_LABELS[lead.source]} · ${lead.phone}`, link: `/broker/leads/${id}`, data: { leadId: id } });
    }
    return { ok: true };
  }

  /** Round-robin across active team members (optionally limited to a subset). */
  async assignRoundRobin(leadId: string, orgId: string, memberIds?: string[]) {
    const members = await this.prisma.user.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', ...(memberIds?.length ? { id: { in: memberIds } } : {}) },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!members.length) return null;
    const org = await this.prisma.organization.update({ where: { id: orgId }, data: { roundRobinCursor: { increment: 1 } } });
    const next = members[(org.roundRobinCursor - 1) % members.length];
    await this.assign(leadId, next.id, null, { viaAutomation: true });
    return next.id;
  }

  async addActivity(id: string, input: { type: any; content?: string | null; callOutcome?: any; durationSec?: number | null }, user: RequestUser) {
    const lead = await this.getScoped(id, user);
    const activity = await this.prisma.activity.create({
      data: { organizationId: lead.organizationId, leadId: id, userId: user.id, type: input.type, content: input.content, callOutcome: input.callOutcome, durationSec: input.durationSec },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const patch: Prisma.LeadUpdateInput = { lastActivityAt: new Date() };
    if (!lead.firstResponseAt && ['CALL', 'WHATSAPP', 'EMAIL', 'SMS'].includes(input.type)) patch.firstResponseAt = new Date();
    if (lead.stage === 'NEW' && ['CALL', 'WHATSAPP', 'EMAIL'].includes(input.type) && input.callOutcome !== 'NO_ANSWER') {
      await this.changeStage(id, 'CONTACTED', user);
    }
    await this.prisma.lead.update({ where: { id }, data: patch });
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
    const ids = (await this.prisma.lead.findMany({ where: { id: { in: body.ids.slice(0, 500) }, ...this.scope(user) }, select: { id: true } })).map((l) => l.id);
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
      ...(r?.maxBudget ? { price: { lte: r.maxBudget * 1.1, ...(r.minBudget ? { gte: r.minBudget * 0.8 } : {}) } } : r?.minBudget ? { price: { gte: r.minBudget * 0.8 } } : {}),
      ...(r?.bedrooms?.length ? { bedrooms: { in: r.bedrooms } } : {}),
    };
    const listings = await this.prisma.listing.findMany({ where, take: 40, orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }], select: { ...LISTING_CARD_SELECT, localityId: true, amenities: true } });
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
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null }, include: { locality: true } });
    if (!listing) throw new NotFoundException('Listing नहीं मिली');
    const code = shortCode(8);
    await this.prisma.shareLink.create({ data: { code, organizationId: lead.organizationId, listingId, leadId: id, createdById: user.id } });
    const url = `${env().PUBLIC_WEB_URL}/s/${code}`;
    const text = `नमस्ते ${lead.name} 👋\nआपकी requirement के हिसाब से यह property देखिए:\n*${listing.title}*\n💰 ${formatPriceShort(listing.price)}${listing.purpose === 'RENT' ? '/month' : ''} · 📍 ${listing.locality.name}\n${url}`;
    await this.prisma.activity.create({ data: { organizationId: lead.organizationId, leadId: id, userId: user.id, type: 'PROPERTY_SHARED', content: listing.title, meta: { listingId, code } } });
    await this.prisma.lead.update({ where: { id }, data: { lastActivityAt: new Date() } });
    return { url, code, text };
  }

  // ------------------------------------------------------------------ AI
  async aiInsights(id: string, user: RequestUser) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, ...this.scope(user) },
      include: { requirement: true, activities: { orderBy: { createdAt: 'desc' }, take: 30 }, visits: true },
    });
    if (!lead) throw new NotFoundException();
    await this.usage.assertAiCredit(lead.organizationId);
    const convo = await this.prisma.message.findMany({ where: { conversation: { leadId: id } }, orderBy: { createdAt: 'desc' }, take: 30 });
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
    await this.prisma.lead.update({ where: { id }, data: { aiSummary: out.summary, temperature: ['HOT', 'WARM', 'COLD'].includes(out.temperature) ? out.temperature : undefined, score } });
    return { ...out, score };
  }

  // ------------------------------------------------------------------ CSV
  async exportCsv(user: RequestUser, q: LeadListQuery) {
    const { items } = await this.list(user, { ...q, page: 1, pageSize: 100 });
    const all = [...items];
    let page = 2;
    while (all.length < 5000) {
      const next = await this.list(user, { ...q, page, pageSize: 100 });
      if (!next.items.length) break;
      all.push(...next.items);
      page++;
    }
    const header = ['Name', 'Phone', 'Email', 'Source', 'Stage', 'Temperature', 'Assigned to', 'Tags', 'Created', 'Last activity', 'Notes'];
    const rows = all.map((l) => [l.name, l.phone, l.email ?? '', LEAD_SOURCE_LABELS[l.source], LEAD_STAGE_LABELS[l.stage], l.temperature ?? '', l.assignedTo?.name ?? '', l.tags.join('|'), l.createdAt.toISOString(), l.lastActivityAt?.toISOString() ?? '', (l.notes ?? '').replace(/\s+/g, ' ')]);
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
        const res = await this.ingest({ orgId, name: get('name', 'full name', 'customer name'), phone, email: get('email', 'email id'), source: 'CSV_IMPORT', message: get('notes', 'requirement', 'remarks', 'message'), sourceDetail: get('source', 'project', 'property'), actorId: user.id });
        if (res.isNew) created++;
        else merged++;
      } catch (e) {
        errors.push({ row: i + 2, error: (e as Error).message });
      }
    }
    return { created, merged, failed: errors.length, errors: errors.slice(0, 50) };
  }
}

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
