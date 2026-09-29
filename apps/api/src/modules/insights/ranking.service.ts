import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';

const WINDOW_DAYS = 30;

/** Points for how fast a firm answers new leads (median first response). */
export function responsePoints(minutes: number | null | undefined) {
  if (minutes == null) return 0;
  if (minutes <= 15) return 30;
  if (minutes <= 60) return 20;
  if (minutes <= 240) return 10;
  return 0;
}

/** 0–100: rating (weighted by review count), response speed, verification, live inventory. */
export function rankScore(o: { rating: number; reviewCount: number; responseMinutes: number | null; verified: boolean; activeListings: number }) {
  const ratingPts = (o.rating / 5) * 40 * Math.min(1, o.reviewCount / 5);
  return Math.round((ratingPts + responsePoints(o.responseMinutes) + (o.verified ? 20 : 0) + (o.activeListings > 0 ? 10 : 0)) * 10) / 10;
}

/**
 * Nightly broker ranking: median lead response time (last 30 days), response rate and a merit
 * score used to order search results, the broker directory and "top brokers of this sector".
 */
@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 21 * * *') // 02:30 IST
  async nightly() {
    if (!env().JOBS_ENABLED) return;
    await this.recomputeAll();
  }

  async recomputeAll() {
    const orgs = await this.prisma.organization.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    for (const o of orgs) await this.recompute(o.id).catch((e) => this.logger.warn(`rank ${o.id}: ${(e as Error).message}`));
    // Denormalise onto listings so search can sort without joins; owner listings stay at 0.
    await this.prisma.$executeRaw`UPDATE "Listing" l SET "rankBoost" = o."rankScore" FROM "Organization" o WHERE l."organizationId" = o.id AND l."rankBoost" IS DISTINCT FROM o."rankScore"`;
    this.logger.log(`ranked ${orgs.length} firms`);
    return orgs.length;
  }

  async recompute(orgId: string) {
    const since = new Date(Date.now() - WINDOW_DAYS * 86400_000);
    const [org, leads, activeListings] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { rating: true, reviewCount: true, verification: true } }),
      this.prisma.lead.findMany({ where: { organizationId: orgId, createdAt: { gte: since }, deletedAt: null }, select: { createdAt: true, firstResponseAt: true }, take: 5000 }),
      this.prisma.listing.count({ where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null } }),
    ]);
    const mins = leads
      .filter((l) => l.firstResponseAt)
      .map((l) => (l.firstResponseAt!.getTime() - l.createdAt.getTime()) / 60_000)
      .filter((m) => m >= 0)
      .sort((a, b) => a - b);
    const responseMinutes = mins.length >= 3 ? Math.round(mins[Math.floor(mins.length / 2)]) : null;
    const responseRate = leads.length ? Math.round((mins.filter((m) => m <= 24 * 60).length / leads.length) * 100) / 100 : null;
    const score = rankScore({ rating: org.rating, reviewCount: org.reviewCount, responseMinutes, verified: org.verification === 'VERIFIED', activeListings });
    return this.prisma.organization.update({ where: { id: orgId }, data: { responseMinutes, responseRate, rankScore: score, rankUpdatedAt: new Date() }, select: { responseMinutes: true, responseRate: true, rankScore: true } });
  }
}
