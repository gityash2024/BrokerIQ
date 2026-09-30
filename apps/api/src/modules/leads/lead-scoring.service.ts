import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../core/events/events.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { env } from '../../config/env';
import { scoreLead, type LeadScore } from './lead-score';

const OPEN_STAGES = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION'] as const;

/**
 * Keeps Lead.score / scoreReasons / temperature up to date: after lead events (debounced through
 * the job queue) and once a night for every open lead (recency changes even when nothing happens).
 */
@Injectable()
export class LeadScoringService implements OnModuleInit {
  private readonly logger = new Logger(LeadScoringService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit() {
    this.jobs.register('lead.score', async (p) => void (await this.rescore(p.leadId)));
    const later = (leadId?: string | null) => leadId && this.queue(leadId);
    this.events.on('lead.created', (p) => later(p.leadId));
    this.events.on('lead.stage_changed', (p) => later(p.leadId));
    this.events.on('message.inbound', (p) => later(p.leadId));
    this.events.on('visit.scheduled', (p) => later(p.leadId));
    this.events.on('lead.updated', (p) => later(p.leadId));
  }

  /** Coalesces bursts (e.g. 5 WhatsApp messages in a row) into one recompute ~20 s later. */
  async queue(leadId: string) {
    await this.jobs.enqueue('lead.score', { leadId }, { key: `lead-score:${leadId}`, runAt: new Date(Date.now() + 20_000), maxAttempts: 2 });
  }

  async compute(leadId: string, now = new Date()): Promise<LeadScore | null> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        requirement: true,
        _count: { select: { visits: { where: { status: { in: ['SCHEDULED', 'CONFIRMED'] } } } } },
      },
    });
    if (!lead || lead.deletedAt) return null;
    const r = lead.requirement;
    const requirementFields = r ? [r.maxBudget || r.minBudget, r.localityIds.length, r.bedrooms.length, r.propertyTypes.length].filter(Boolean).length : 0;
    const [matchingListings, inboundMessages, connectedCalls, visitsCompleted, shareOpens] = await Promise.all([
      r && requirementFields
        ? this.prisma.listing.count({
            where: {
              organizationId: lead.organizationId,
              status: 'ACTIVE',
              deletedAt: null,
              ...(r.localityIds.length ? { localityId: { in: r.localityIds } } : {}),
              ...(r.bedrooms.length ? { bedrooms: { in: r.bedrooms } } : {}),
              ...(r.maxBudget ? { price: { lte: r.maxBudget * 1.1 } } : {}),
            },
          })
        : 0,
      this.prisma.message.count({ where: { direction: 'INBOUND', conversation: { leadId } } }),
      // Manual call logs and Exotel calls both end up as CALL activities with an outcome.
      this.prisma.activity.count({ where: { leadId, type: 'CALL', callOutcome: 'CONNECTED' } }),
      this.prisma.siteVisit.count({ where: { leadId, status: 'COMPLETED' } }),
      this.prisma.shareLink.aggregate({ where: { leadId }, _sum: { opens: true } }).then((a) => a._sum.opens ?? 0),
    ]);
    return scoreLead(
      {
        stage: lead.stage,
        source: lead.source,
        lastActivityAt: lead.lastActivityAt,
        createdAt: lead.createdAt,
        repeatCount: lead.repeatCount,
        requirementFields,
        matchingListings,
        inboundMessages,
        connectedCalls,
        visitsScheduled: lead._count.visits,
        visitsCompleted,
        shareOpens,
        optedOut: !!lead.optedOutAt,
      },
      now,
    );
  }

  async rescore(leadId: string, now = new Date()) {
    const result = await this.compute(leadId, now);
    if (!result) return null;
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { temperatureManual: true } });
    const data: Prisma.LeadUpdateInput = { score: result.score, scoreReasons: result.reasons, scoredAt: now };
    if (!lead?.temperatureManual) data.temperature = result.temperature;
    await this.prisma.lead.update({ where: { id: leadId }, data });
    return result;
  }

  @Cron('0 30 20 * * *') // 02:00 IST
  async nightly() {
    if (!env().JOBS_ENABLED) return;
    let cursor: string | undefined;
    let done = 0;
    for (;;) {
      const batch = await this.prisma.lead.findMany({
        where: { deletedAt: null, stage: { in: [...OPEN_STAGES] } },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!batch.length) break;
      for (const l of batch) await this.rescore(l.id).catch((e) => this.logger.warn(`score ${l.id}: ${(e as Error).message}`));
      done += batch.length;
      cursor = batch[batch.length - 1].id;
    }
    this.logger.log(`lead scores refreshed: ${done}`);
  }
}
