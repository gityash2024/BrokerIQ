import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanLimitException } from '../../common/exceptions';
import { monthKey } from '../../common/utils';

export interface PlanLimits {
  agents: number;
  activeListings: number;
  leadsPerMonth: number;
  aiCredits: number;
  automations: number;
  connectors: number;
}

const FALLBACK: PlanLimits = { agents: 1, activeListings: 10, leadsPerMonth: 100, aiCredits: 20, automations: 1, connectors: 1 };

/** Plan limits & monthly usage counters for broker organizations. */
@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async limits(orgId: string): Promise<{ plan: string; status: string; limits: PlanLimits }> {
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId: orgId }, include: { plan: true } });
    const active = sub && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status) && (!sub.currentPeriodEnd || sub.currentPeriodEnd > new Date() || sub.status !== 'ACTIVE');
    if (!sub || !active) {
      const free = await this.prisma.plan.findFirst({ where: { priceMonthly: 0, isActive: true }, orderBy: { sortOrder: 'asc' } });
      return { plan: free?.code ?? 'FREE', status: sub?.status ?? 'NONE', limits: { ...FALLBACK, ...((free?.limits as object) ?? {}) } };
    }
    return { plan: sub.plan.code, status: sub.status, limits: { ...FALLBACK, ...(sub.plan.limits as object) } };
  }

  async count(orgId: string, metric: string, period = monthKey()) {
    const row = await this.prisma.usageCounter.findUnique({ where: { organizationId_metric_period: { organizationId: orgId, metric, period } } });
    return row?.count ?? 0;
  }

  async increment(orgId: string, metric: string, by = 1) {
    const period = monthKey();
    await this.prisma.usageCounter.upsert({
      where: { organizationId_metric_period: { organizationId: orgId, metric, period } },
      create: { organizationId: orgId, metric, period, count: by },
      update: { count: { increment: by } },
    });
  }

  /** Throws PLAN_LIMIT_REACHED when `current + adding` exceeds the plan limit. */
  async assert(orgId: string, key: keyof PlanLimits, current: number, adding = 1) {
    const { limits } = await this.limits(orgId);
    if (current + adding > limits[key]) throw new PlanLimitException(key, limits[key]);
  }

  async assertAiCredit(orgId: string | null | undefined) {
    if (!orgId) return;
    await this.assert(orgId, 'aiCredits', await this.count(orgId, 'ai'), 1);
    await this.increment(orgId, 'ai');
  }
}
