import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { BrokerInvite, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { shortCode } from '../../common/utils';
import { env } from '../../config/env';

type Tx = Prisma.TransactionClient | PrismaService;

/**
 * Invite codes for new broker firms. While open broker signup is off (Super Admin → App settings),
 * a valid code is the only way in; a code may grant a free plan for N months. Brokers also get a
 * personal code to bring other brokers (referrals).
 */
@Injectable()
export class BrokerInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  normalize(code?: string | null) {
    return (code ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  }

  /** Returns the usable invite for a code, or throws with a clear reason. */
  async validate(code: string): Promise<BrokerInvite> {
    const invite = await this.prisma.brokerInvite.findUnique({ where: { code: this.normalize(code) } });
    if (!invite || !invite.isActive) throw new BadRequestException('Invite code सही नहीं है।');
    if (invite.expiresAt && invite.expiresAt < new Date()) throw new BadRequestException('यह invite code expire हो चुका है।');
    if (invite.uses >= invite.maxUses) throw new BadRequestException('यह invite code पूरा इस्तेमाल हो चुका है।');
    return invite;
  }

  /** Gate for every "become a broker" path: open signup, or a valid invite code. */
  async gate(code?: string | null): Promise<BrokerInvite | null> {
    const invite = this.normalize(code) ? await this.validate(code!) : null;
    if (invite) return invite;
    const app = await this.settings.getAppConfig();
    if (!app.auth.allowBrokerSignup) throw new ForbiddenException('Broker account अभी सिर्फ़ invite से बनता है — invite code डालें।');
    return null;
  }

  /** Marks the invite used by a new firm and links the referral. */
  async consume(invite: BrokerInvite, orgId: string, tx: Tx = this.prisma) {
    await tx.brokerInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
    await tx.organization.update({ where: { id: orgId }, data: { brokerInviteId: invite.id, referredByOrgId: invite.createdByOrgId ?? undefined } });
  }

  /** The plan a new firm gets from an invite (null → normal default plan). */
  async grantedPlan(invite: BrokerInvite | null, tx: Tx = this.prisma) {
    if (!invite?.grantPlanCode) return null;
    const plan = await tx.plan.findUnique({ where: { code: invite.grantPlanCode } });
    if (!plan?.isActive) return null;
    return { plan, periodEnd: invite.grantMonths > 0 ? new Date(Date.now() + invite.grantMonths * 30 * 86400_000) : null };
  }

  async uniqueCode(prefix = '') {
    for (;;) {
      const code = `${prefix}${shortCode(6).toUpperCase()}`;
      if (!(await this.prisma.brokerInvite.findUnique({ where: { code } }))) return code;
    }
  }

  inviteLink(code: string) {
    return `${env().PUBLIC_WEB_URL.replace(/\/$/, '')}/for-brokers?invite=${encodeURIComponent(code)}`;
  }

  // ------------------------------------------------------------------ broker referrals
  async myReferrals(orgId: string, userId: string) {
    const app = await this.settings.getAppConfig();
    const cfg = app.brokerReferrals;
    let invite = await this.prisma.brokerInvite.findFirst({ where: { createdByOrgId: orgId, note: 'referral' }, orderBy: { createdAt: 'asc' } });
    if (!invite && cfg.enabled) {
      invite = await this.prisma.brokerInvite.create({
        data: { code: await this.uniqueCode('BIQ'), note: 'referral', createdById: userId, createdByOrgId: orgId, grantPlanCode: cfg.planCode, grantMonths: cfg.months, maxUses: cfg.maxUsesPerBroker },
      });
    }
    const joined = await this.prisma.organization.findMany({
      where: { referredByOrgId: orgId },
      select: { id: true, name: true, slug: true, logoUrl: true, verification: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      enabled: cfg.enabled,
      code: invite?.isActive ? invite.code : null,
      link: invite?.isActive ? this.inviteLink(invite.code) : null,
      usesLeft: invite ? Math.max(0, invite.maxUses - invite.uses) : 0,
      grant: invite?.grantPlanCode ? { planCode: invite.grantPlanCode, months: invite.grantMonths } : null,
      joined,
      leaderboard: await this.leaderboard(),
    };
  }

  async leaderboard(limit = 10) {
    const rows = await this.prisma.organization.groupBy({ by: ['referredByOrgId'], where: { referredByOrgId: { not: null } }, _count: { _all: true }, orderBy: { _count: { referredByOrgId: 'desc' } }, take: limit });
    const orgs = await this.prisma.organization.findMany({ where: { id: { in: rows.map((r) => r.referredByOrgId!) } }, select: { id: true, name: true, slug: true, logoUrl: true } });
    return rows.map((r) => ({ org: orgs.find((o) => o.id === r.referredByOrgId) ?? null, count: r._count._all })).filter((r) => r.org);
  }
}
