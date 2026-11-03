import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { LEAD_STAGE_LABELS, videoRoomUrl, visitInputSchema, visitUpdateSchema } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../core/events/events.service';
import { FeaturesService } from '../../core/features/features.service';
import { RequestUser } from '../../common/decorators';
import { randomToken, requireOrg } from '../../common/utils';

const include = {
  lead: { select: { id: true, name: true, phone: true, email: true, stage: true } },
  listing: { select: { id: true, title: true, slug: true, coverUrl: true, latitude: true, longitude: true, address: true } },
  assignedTo: { select: { id: true, name: true } },
} as const;
const querySchema = z
  .object({
    status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    assignedToId: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    paginated: z.enum(['true', 'false']).optional(),
  })
  .refine((v) => !v.from || !v.to || new Date(v.from) <= new Date(v.to), 'Invalid date range');

@Injectable()
export class VisitsService {
  constructor(
    private readonly db: PrismaService,
    private readonly events: EventsService,
    private readonly features: FeaturesService,
  ) {}
  private scope(user: RequestUser): Prisma.SiteVisitWhereInput {
    return {
      organizationId: requireOrg(user),
      lead: { deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) },
      ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}),
    };
  }
  async list(user: RequestUser, raw: unknown) {
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const q = parsed.data;
    const where: Prisma.SiteVisitWhereInput = {
      AND: [this.scope(user), ...(q.assignedToId ? [{ assignedToId: q.assignedToId }] : [])],
      status: q.status,
      ...(q.from || q.to ? { scheduledAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
    };
    // Old installed clients keep the array shape. New clients page through the complete scoped dataset.
    if (q.paginated !== 'true') return this.db.siteVisit.findMany({ where, orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }], take: 500, include });
    const [items, total] = await this.db.$transaction([
      this.db.siteVisit.findMany({ where, orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, include }),
      this.db.siteVisit.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize, pages: Math.ceil(total / q.pageSize) };
  }
  private async lockLead(tx: Prisma.TransactionClient, user: RequestUser, id: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`visit-lead:${id}`}))`;
    await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${id} FOR UPDATE`;
    const lead = await tx.lead.findFirst({
      where: { id, organizationId: requireOrg(user), deletedAt: null, ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}) },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }
  async create(user: RequestUser, body: z.infer<typeof visitInputSchema>) {
    if (body.mode === 'VIDEO') await this.features.assertEnabled('video_visits');
    const requestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const result = await this.db.$transaction(async (tx) => {
      if (body.clientMutationId)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`visit-submission:${requireOrg(user)}:${body.clientMutationId}`}))`;
      const lead = await this.lockLead(tx, user, body.leadId);
      if (body.clientMutationId) {
        const previous = await tx.siteVisit.findUnique({
          where: { organizationId_clientMutationId: { organizationId: lead.organizationId, clientMutationId: body.clientMutationId } },
          include,
        });
        if (previous) {
          if (previous.leadId !== lead.id || previous.requestHash !== requestHash)
            throw new ConflictException('This submission ID was already used for a different visit');
          // The creation activity is committed with the visit and identifies the original actor on old and new records.
          const originalActor = await tx.activity.findFirst({
            where: {
              organizationId: lead.organizationId,
              leadId: lead.id,
              userId: user.id,
              type: 'SITE_VISIT',
              meta: { equals: { visitId: previous.id } },
            },
            select: { id: true },
          });
          if (!originalActor) throw new ConflictException('This submission ID was already used for a different visit');
          return { visit: previous, created: false, from: lead.stage };
        }
      }
      const assignedToId = body.assignedToId ?? lead.assignedToId ?? user.id;
      if (user.role === 'BROKER_AGENT' && assignedToId !== user.id) throw new ForbiddenException('Only an administrator can assign another member');
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${assignedToId} FOR UPDATE`;
      const assignee = await tx.user.findFirst({
        where: { id: assignedToId, organizationId: lead.organizationId, status: 'ACTIVE', deletedAt: null, role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] } },
        select: { id: true, role: true },
      });
      if (!assignee) throw new BadRequestException('Assignee must be an active firm member');
      if (assignee.role === 'BROKER_AGENT' && lead.assignedToId !== assignee.id)
        throw new BadRequestException('पहले lead इस Agent को assign करें, फिर उसकी site visit बनाएँ।');
      let snapshot: Prisma.InputJsonObject | undefined;
      let listingId = body.listingId;
      if (body.inventoryId) {
        const item = await tx.inventoryItem.findFirst({
          where: {
            id: body.inventoryId,
            organizationId: lead.organizationId,
            deletedAt: null,
            ...(user.role === 'BROKER_AGENT' ? { OR: [{ createdById: user.id }, { assignedToId: user.id }] } : {}),
          },
        });
        if (!item) throw new NotFoundException('Inventory property not found');
        if (listingId && listingId !== item.publishedListingId) throw new BadRequestException('Inventory and listing refer to different properties');
        listingId = item.publishedListingId;
        const title = [item.houseNo, item.unitLabel, item.floor, item.sector].filter(Boolean).join(' · ') || item.address || 'Property';
        snapshot = {
          kind: 'INVENTORY',
          id: item.id,
          title,
          address: item.address,
          purpose: item.purpose,
          bhk: item.bhk,
          floor: item.floor,
          unitLabel: item.unitLabel,
          price: item.purpose === 'SALE' ? Number(item.totalSalePrice ?? item.price ?? 0) || null : Number(item.monthlyRent ?? item.rent ?? 0) || null,
          availability: item.availability,
        };
      } else if (listingId) {
        const listing = await tx.listing.findFirst({
          where: {
            id: listingId,
            organizationId: lead.organizationId,
            deletedAt: null,
            ...(user.role === 'BROKER_AGENT'
              ? { OR: [{ postedById: user.id }, { inventoryOrigin: { is: { OR: [{ assignedToId: user.id }, { createdById: user.id }] } } }] }
              : {}),
          },
        });
        if (!listing) throw new NotFoundException('Listing not found');
        snapshot = {
          kind: 'LISTING',
          id: listing.id,
          title: listing.title,
          address: listing.address,
          purpose: listing.purpose,
          bhk: listing.bedrooms,
          floor: listing.floor,
          price: listing.price,
          availability: listing.status,
        };
      }
      const scheduledAt = new Date(body.scheduledAt);
      const visit = await tx.siteVisit.create({
        data: {
          organizationId: lead.organizationId,
          leadId: lead.id,
          inventoryId: body.inventoryId,
          listingId,
          propertySnapshot: snapshot,
          clientMutationId: body.clientMutationId,
          requestHash,
          scheduledAt,
          address: body.address?.trim() || (snapshot?.address as string | null) || (snapshot?.title as string | null),
          note: body.note,
          assignedToId,
          mode: body.mode,
          meetingUrl: body.mode === 'VIDEO' ? videoRoomUrl(randomToken(12)) : null,
        },
        include,
      });
      const changeStage = ['NEW', 'CONTACTED', 'INTERESTED'].includes(lead.stage);
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          lastActivityAt: new Date(),
          ...(changeStage ? { stage: 'SITE_VISIT', stageChangedAt: new Date(), firstResponseAt: lead.firstResponseAt ?? new Date(), lostReason: null } : {}),
        },
      });
      await tx.activity.create({
        data: {
          organizationId: lead.organizationId,
          leadId: lead.id,
          userId: user.id,
          type: 'SITE_VISIT',
          content: `Site visit scheduled: ${scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}${snapshot?.title ? ` — ${snapshot.title}` : ''}`,
          meta: { visitId: visit.id },
        },
      });
      if (changeStage)
        await tx.activity.create({
          data: {
            organizationId: lead.organizationId,
            leadId: lead.id,
            userId: user.id,
            type: 'STAGE_CHANGE',
            content: `${LEAD_STAGE_LABELS[lead.stage]} → ${LEAD_STAGE_LABELS.SITE_VISIT}`,
            meta: { from: lead.stage, to: 'SITE_VISIT' },
          },
        });
      return { visit, created: true, from: lead.stage };
    });
    if (result.created) {
      this.events.emit('visit.scheduled', { visitId: result.visit.id, orgId: result.visit.organizationId, leadId: result.visit.leadId });
      if (['NEW', 'CONTACTED', 'INTERESTED'].includes(result.from))
        this.events.emit('lead.stage_changed', {
          leadId: result.visit.leadId,
          orgId: result.visit.organizationId,
          from: result.from,
          to: 'SITE_VISIT',
          userId: user.id,
        });
    }
    return result.visit;
  }
  async update(user: RequestUser, id: string, body: z.infer<typeof visitUpdateSchema>) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`visit:${id}`}))`;
      const initial = await tx.siteVisit.findFirst({ where: { id, organizationId: requireOrg(user) }, select: { leadId: true } });
      if (!initial) throw new NotFoundException();
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${initial.leadId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "SiteVisit" WHERE id=${id} FOR UPDATE`;
      const visit = await tx.siteVisit.findFirst({ where: { id, ...this.scope(user) } });
      if (!visit) throw new NotFoundException();
      if (body.expectedUpdatedAt && new Date(body.expectedUpdatedAt).getTime() !== visit.updatedAt.getTime())
        throw new ConflictException('Visit changed. Refresh before saving.');
      const closed = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(visit.status);
      if (closed && (body.scheduledAt || (body.status && body.status !== visit.status) || body.checkInLat != null))
        throw new ConflictException('This visit is closed; schedule a new visit.');
      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
      const changedDate = scheduledAt && scheduledAt.getTime() !== visit.scheduledAt.getTime();
      const updated = await tx.siteVisit.update({
        where: { id },
        data: {
          status: body.status,
          scheduledAt,
          feedback: body.feedback,
          rating: body.rating,
          ...(body.checkInLat != null && !visit.checkInAt ? { checkInAt: new Date(), checkInLat: body.checkInLat, checkInLng: body.checkInLng } : {}),
          ...(changedDate ? { reminderSentAt: null, tenantDayReminderAt: null, tenantHourReminderAt: null } : {}),
        },
        include,
      });
      if ((body.status && body.status !== visit.status) || changedDate) {
        await tx.activity.create({
          data: {
            organizationId: visit.organizationId,
            leadId: visit.leadId,
            userId: user.id,
            type: 'SITE_VISIT',
            content: changedDate ? `Site visit rescheduled: ${scheduledAt.toISOString()}` : `Site visit ${body.status!.toLowerCase().replace('_', ' ')}`,
            meta: { visitId: id },
          },
        });
        await tx.lead.update({ where: { id: visit.leadId }, data: { lastActivityAt: new Date() } });
      }
      return updated;
    });
  }
}
