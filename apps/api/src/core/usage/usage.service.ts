import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AppException, PlanLimitException } from '../../common/exceptions';
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

/**
 * Plan limits & usage counters for broker organizations. In free mode (app-config
 * `monetization.freeMode`) plan limits are not enforced; only the AI fair-use cap applies.
 */
@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async freeMode() {
    return (await this.settings.getAppConfig()).monetization.freeMode;
  }

  async limits(orgId: string): Promise<{ plan: string; status: string; limits: PlanLimits }> {
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId: orgId }, include: { plan: true } });
    const active =
      sub && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status) && (!sub.currentPeriodEnd || sub.currentPeriodEnd > new Date() || sub.status !== 'ACTIVE');
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

  async increment(orgId: string, metric: string, by = 1, period = monthKey()) {
    await this.prisma.usageCounter.upsert({
      where: { organizationId_metric_period: { organizationId: orgId, metric, period } },
      create: { organizationId: orgId, metric, period, count: by },
      update: { count: { increment: by } },
    });
  }

  /** Throws PLAN_LIMIT_REACHED when `current + adding` exceeds the plan limit. */
  async assert(orgId: string, key: keyof PlanLimits, current: number, adding = 1) {
    if (await this.freeMode()) return;
    const { limits } = await this.limits(orgId);
    if (current + adding > limits[key]) throw new PlanLimitException(key, limits[key]);
  }

  async assertAiCredit(orgId: string | null | undefined) {
    if (!orgId) return;
    const app = await this.settings.getAppConfig();
    if (app.monetization.freeMode) {
      const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); // IST day
      const used = await this.count(orgId, 'ai-day', day);
      if (app.ai.dailyCap > 0 && used >= app.ai.dailyCap)
        throw new AppException(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, `आज की AI limit (${app.ai.dailyCap}) पूरी हो गई — कल फिर इस्तेमाल करें।`, {
          cap: app.ai.dailyCap,
        });
      await this.increment(orgId, 'ai-day', 1, day);
    } else {
      await this.assert(orgId, 'aiCredits', await this.count(orgId, 'ai'), 1);
    }
    await this.increment(orgId, 'ai');
  }
}
