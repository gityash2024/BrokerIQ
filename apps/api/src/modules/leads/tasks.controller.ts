import {
  Body,
  Controller,
  Delete,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  dealInputSchema,
  followUpInputSchema,
  followUpQuerySchema,
  followUpIstDayEnd,
  type FollowUpQuery,
  visitInputSchema,
  visitUpdateSchema,
} from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadsService } from './leads.service';
import { EventsService } from '../../core/events/events.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';
import { VisitsService } from './visits.service';
import { FeaturesService } from '../../core/features/features.service';

const followUpUpdate = z.object({
  status: z.enum(['PENDING', 'DONE', 'MISSED', 'CANCELLED']).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().max(1000).nullable().optional(),
  outcomeNote: z.string().max(1000).optional(),
});

@ApiTags('crm')
@Roles('BROKER_ADMIN', 'BROKER_AGENT')
@Controller()
export class TasksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
    private readonly events: EventsService,
    private readonly features: FeaturesService,
    private readonly visitService: VisitsService,
  ) {}

  private mineFilter(user: RequestUser) {
    return user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {};
  }

  private async taskAssignee(user: RequestUser, organizationId: string, requested: string | null | undefined, fallback: string | null) {
    const assignedToId = requested ?? fallback ?? user.id;
    if (user.role === 'BROKER_AGENT' && assignedToId !== user.id) throw new ForbiddenException('सिर्फ admin दूसरे सदस्य को काम assign कर सकते हैं');
    await this.leads.assertMember(organizationId, assignedToId);
    return assignedToId;
  }

  // ------------------------------------------------------------------ follow-ups
  @Get('follow-ups')
  async followUps(@CurrentUser() user: RequestUser, @Query(new ZodPipe(followUpQuerySchema)) q: FollowUpQuery) {
    const where = this.followUpFilter(user, q);
    const include = {
      lead: { select: { id: true, name: true, phone: true, email: true, stage: true, source: true } },
      assignedTo: { select: { id: true, name: true } },
    };
    const orderBy: Prisma.FollowUpOrderByWithRelationInput[] = [
      q.sortBy === 'completedAt' ? { completedAt: { sort: q.sortOrder, nulls: 'last' } } : { [q.sortBy]: q.sortOrder },
      { id: q.sortOrder },
    ];
    // Preserve the response shape for older installed clients. Upgraded clients always paginate.
    if (q.paginated !== 'true') return this.prisma.followUp.findMany({ where, include, orderBy, take: 500 });
    const [items, total] = await this.prisma.$transaction(
      [this.prisma.followUp.findMany({ where, include, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }), this.prisma.followUp.count({ where })],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) };
  }

  @Get('follow-ups/summary')
  async followUpSummary(@CurrentUser() user: RequestUser, @Query(new ZodPipe(followUpQuerySchema)) q: FollowUpQuery) {
    const now = new Date();
    const [today, overdue] = await this.prisma.$transaction(
      [
        this.prisma.followUp.count({ where: this.followUpFilter(user, { ...q, status: 'PENDING', view: 'today' }, now) }),
        this.prisma.followUp.count({ where: this.followUpFilter(user, { ...q, status: 'PENDING', view: 'overdue' }, now) }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { today, overdue };
  }

  private followUpFilter(user: RequestUser, q: FollowUpQuery, now = new Date()): Prisma.FollowUpWhereInput {
    const orgId = requireOrg(user);
    const conditions: Prisma.FollowUpWhereInput[] = [this.mineFilter(user)];
    if (q.assignedToId) conditions.push({ assignedToId: q.assignedToId });
    if (q.status) conditions.push({ status: q.status });
    if (q.from || q.to) conditions.push({ dueAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } });
    if (q.view === 'overdue') conditions.push({ status: 'PENDING', dueAt: { lt: now } });
    if (q.view === 'today') conditions.push({ status: 'PENDING', dueAt: { lte: followUpIstDayEnd(now) } });
    if (q.view === 'upcoming') conditions.push({ status: 'PENDING', dueAt: { gt: followUpIstDayEnd(now) } });
    if (q.search)
      conditions.push({
        OR: [
          { note: { contains: q.search, mode: 'insensitive' } },
          { lead: { OR: ['name', 'phone', 'email'].map((field) => ({ [field]: { contains: q.search, mode: 'insensitive' } })) } },
        ],
      });
    return {
      organizationId: orgId,
      AND: conditions,
      lead: { organizationId: orgId, deletedAt: null, ...this.mineFilter(user) },
    };
  }

  @Post('follow-ups')
  async createFollowUp(@CurrentUser() user: RequestUser, @Body(new ZodPipe(followUpInputSchema)) body: z.infer<typeof followUpInputSchema>) {
    const organizationId = requireOrg(user);
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          actorId: user.id,
          leadId: body.leadId,
          type: body.type,
          dueAt: new Date(body.dueAt).toISOString(),
          note: body.note ?? null,
          assignedToId: body.assignedToId ?? null,
        }),
      )
      .digest('hex');
    return this.prisma.$transaction(async (tx) => {
      if (body.clientMutationId)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`followup-submission:${organizationId}:${body.clientMutationId}`}))`;
      // Serialize with assignment, completion and snooze; check current ownership after acquiring the lock.
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${body.leadId} FOR UPDATE`;
      const lead = await tx.lead.findFirst({ where: { id: body.leadId, organizationId, deletedAt: null, ...this.mineFilter(user) } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (body.clientMutationId) {
        const previous = await tx.followUp.findUnique({
          where: { organizationId_clientMutationId: { organizationId, clientMutationId: body.clientMutationId } },
        });
        if (previous) {
          if (previous.requestHash !== requestHash) throw new ConflictException('Submission already used for a different follow-up');
          return previous;
        }
      }
      const assignedToId = body.assignedToId ?? lead.assignedToId ?? user.id;
      if (user.role === 'BROKER_AGENT' && assignedToId !== user.id) throw new ForbiddenException('Only Admin can assign another member');
      const assignee = await tx.user.findFirst({
        where: { id: assignedToId, organizationId, status: 'ACTIVE', deletedAt: null, role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] } },
      });
      if (!assignee) throw new BadRequestException('Assignee must be an active firm member');
      const fu = await tx.followUp.create({
        data: {
          organizationId,
          leadId: lead.id,
          type: body.type,
          dueAt: new Date(body.dueAt),
          note: body.note,
          assignedToId,
          createdById: user.id,
          clientMutationId: body.clientMutationId,
          requestHash,
        },
      });
      await tx.activity.create({
        data: {
          organizationId,
          leadId: lead.id,
          userId: user.id,
          type: 'FOLLOW_UP',
          content: `Follow-up scheduled: ${new Date(body.dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}${body.note ? ` — ${body.note}` : ''}`,
        },
      });
      await this.refreshFollowUp(tx, lead.id);
      return fu;
    });
  }

  @Patch('follow-ups/:id')
  async updateFollowUp(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(followUpUpdate)) body: z.infer<typeof followUpUpdate>) {
    return this.prisma.$transaction(async (tx) => {
      const fu = await this.lockFollowUp(tx, user, id);
      const updated = await tx.followUp.update({
        where: { id },
        data: {
          status: body.status,
          dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
          note: body.note,
          completedAt: body.status === 'DONE' ? (fu.completedAt ?? new Date()) : body.status === 'PENDING' ? null : undefined,
          reminderSentAt: body.dueAt || body.status === 'PENDING' ? null : undefined,
        },
      });
      if (body.status === 'DONE' && fu.status !== 'DONE') {
        await tx.activity.create({
          data: {
            organizationId: fu.organizationId,
            leadId: fu.leadId,
            userId: user.id,
            type: 'FOLLOW_UP',
            content: `Follow-up done${body.outcomeNote ? `: ${body.outcomeNote}` : ''}`,
          },
        });
        await tx.lead.update({ where: { id: fu.leadId }, data: { lastActivityAt: new Date() } });
      }
      await this.refreshFollowUp(tx, fu.leadId);
      return updated;
    });
  }

  private async lockFollowUp(tx: Prisma.TransactionClient, user: RequestUser, id: string) {
    const candidate = await tx.followUp.findFirst({ where: { id, organizationId: requireOrg(user) }, select: { leadId: true } });
    if (!candidate) throw new NotFoundException();
    // Lead assignment writes acquire the same PostgreSQL row lock before updating tasks.
    await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${candidate.leadId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "FollowUp" WHERE id=${id} FOR UPDATE`;
    const fu = await tx.followUp.findFirst({
      where: {
        id,
        organizationId: requireOrg(user),
        ...this.mineFilter(user),
        lead: { organizationId: requireOrg(user), deletedAt: null, ...this.mineFilter(user) },
      },
    });
    if (!fu) throw new NotFoundException();
    return fu;
  }

  private async refreshFollowUp(tx: Prisma.TransactionClient, leadId: string) {
    const next = await tx.followUp.findFirst({ where: { leadId, status: 'PENDING' }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }] });
    await tx.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: next?.dueAt ?? null } });
  }

  @Delete('follow-ups/:id')
  async deleteFollowUp(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.$transaction(async (tx) => {
      const fu = await this.lockFollowUp(tx, user, id);
      await tx.followUp.delete({ where: { id } });
      await this.refreshFollowUp(tx, fu.leadId);
      return { ok: true };
    });
  }

  // ------------------------------------------------------------------ site visits
  @Get('visits')
  visits(@CurrentUser() user: RequestUser, @Query() q: Record<string, string>) {
    return this.visitService.list(user, q);
  }
  @Post('visits')
  createVisit(@CurrentUser() user: RequestUser, @Body(new ZodPipe(visitInputSchema)) body: z.infer<typeof visitInputSchema>) {
    return this.visitService.create(user, body);
  }
  @Patch('visits/:id')
  updateVisit(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(visitUpdateSchema)) body: z.infer<typeof visitUpdateSchema>) {
    return this.visitService.update(user, id, body);
  }

  // ------------------------------------------------------------------ deals
  @Get('deals')
  deals(@CurrentUser() user: RequestUser, @Query() q: { status?: string }) {
    return this.prisma.deal.findMany({
      where: {
        organizationId: requireOrg(user),
        ...(user.role === 'BROKER_AGENT' ? { agentId: user.id } : {}),
        ...(q.status ? { status: q.status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        listing: { select: { id: true, title: true, slug: true } },
        agent: { select: { id: true, name: true } },
      },
    });
  }

  @Post('deals')
  async createDeal(@CurrentUser() user: RequestUser, @Body(new ZodPipe(dealInputSchema)) body: z.infer<typeof dealInputSchema>) {
    const lead = await this.leads.getScoped(body.leadId, user);
    const commissionAmount = body.commissionAmount ?? (body.commissionPct ? (body.dealValue * body.commissionPct) / 100 : null);
    const deal = await this.prisma.deal.create({
      data: {
        organizationId: lead.organizationId,
        leadId: lead.id,
        listingId: body.listingId,
        agentId: lead.assignedToId ?? user.id,
        title: body.title,
        dealValue: body.dealValue,
        commissionPct: body.commissionPct,
        commissionAmount,
        agentSharePct: body.agentSharePct,
        commissionReceived: body.commissionReceived ?? 0,
        notes: body.notes,
        status: body.closedAt ? 'CLOSED' : 'OPEN',
        closedAt: body.closedAt ? new Date(body.closedAt) : null,
      },
    });
    if (body.closedAt) {
      await this.leads.changeStage(lead.id, 'WON', user);
      if (body.listingId) {
        const listing = await this.prisma.listing.findFirst({ where: { id: body.listingId, organizationId: lead.organizationId } });
        if (listing) await this.prisma.listing.update({ where: { id: listing.id }, data: { status: listing.purpose === 'RENT' ? 'RENTED' : 'SOLD' } });
      }
      this.events.emit('deal.closed', { dealId: deal.id, orgId: lead.organizationId, userId: user.id });
    }
    return deal;
  }

  @Patch('deals/:id')
  async updateDeal(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(dealInputSchema.partial().extend({ status: z.enum(['OPEN', 'CLOSED', 'CANCELLED']).optional() }))) body: any,
  ) {
    const d = await this.prisma.deal.findFirst({ where: { id, organizationId: requireOrg(user) } });
    if (!d) throw new NotFoundException();
    const { leadId, closedAt, ...rest } = body;
    void leadId;
    const updated = await this.prisma.deal.update({
      where: { id },
      data: { ...rest, closedAt: closedAt ? new Date(closedAt) : rest.status === 'CLOSED' && !d.closedAt ? new Date() : undefined },
    });
    if (rest.status === 'CLOSED' && d.status !== 'CLOSED') {
      await this.leads.changeStage(d.leadId, 'WON', user);
      this.events.emit('deal.closed', { dealId: d.id, orgId: d.organizationId, userId: user.id });
    }
    return updated;
  }
}
