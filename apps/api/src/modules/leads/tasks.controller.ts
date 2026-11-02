import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { dealInputSchema, followUpInputSchema, visitInputSchema, visitUpdateSchema } from '@brokeriq/shared';
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

function range(q: { from?: string; to?: string }) {
  return q.from || q.to ? { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } : undefined;
}

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
  async followUps(@CurrentUser() user: RequestUser, @Query() q: { status?: string; from?: string; to?: string; assignedToId?: string; view?: string }) {
    const orgId = requireOrg(user);
    const where: Prisma.FollowUpWhereInput = {
      organizationId: orgId,
      AND: [this.mineFilter(user), ...(q.assignedToId ? [{ assignedToId: q.assignedToId }] : [])],
      ...(q.status ? { status: q.status as any } : {}),
      ...(range(q) ? { dueAt: range(q) } : {}),
      ...(q.view === 'overdue' ? { status: 'PENDING', dueAt: { lt: new Date() } } : {}),
      ...(q.view === 'today' ? { status: 'PENDING', dueAt: { lte: endOfDay() } } : {}),
      lead: { organizationId: orgId, deletedAt: null, ...this.mineFilter(user) },
    };
    return this.prisma.followUp.findMany({
      where,
      orderBy: { dueAt: 'asc' },
      take: 500,
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true, stage: true, source: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
  }

  @Post('follow-ups')
  async createFollowUp(@CurrentUser() user: RequestUser, @Body(new ZodPipe(followUpInputSchema)) body: z.infer<typeof followUpInputSchema>) {
    const lead = await this.leads.getScoped(body.leadId, user);
    const assignedToId = await this.taskAssignee(user, lead.organizationId, body.assignedToId, lead.assignedToId);
    const fu = await this.prisma.followUp.create({
      data: {
        organizationId: lead.organizationId,
        leadId: lead.id,
        type: body.type,
        dueAt: new Date(body.dueAt),
        note: body.note,
        assignedToId,
        createdById: user.id,
      },
    });
    await this.prisma.activity.create({
      data: {
        organizationId: lead.organizationId,
        leadId: lead.id,
        userId: user.id,
        type: 'FOLLOW_UP',
        content: `Follow-up scheduled: ${new Date(body.dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}${body.note ? ` — ${body.note}` : ''}`,
      },
    });
    await this.leads.refreshNextFollowUp(lead.id);
    return fu;
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

function endOfDay() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
