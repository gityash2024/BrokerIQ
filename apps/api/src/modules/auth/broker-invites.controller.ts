import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { BrokerInvitesService } from './broker-invites.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { AuditService } from '../../core/audit/audit.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';

const inviteSchema = z.object({
  code: z.string().trim().max(40).optional(),
  note: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  grantPlanCode: z.string().trim().max(40).optional().nullable(),
  grantMonths: z.number().int().min(0).max(60).default(12),
  maxUses: z.number().int().min(1).max(10_000).default(1),
  expiresAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

@ApiTags('broker-invites')
@Controller()
export class BrokerInvitesController {
  constructor(
    private readonly invites: BrokerInvitesService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Lets signup screens show whether signup is open and what an invite code grants. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('broker-invites/check/:code')
  async check(@Param('code') code: string) {
    const app = await this.settings.getAppConfig();
    try {
      const invite = await this.invites.validate(code);
      const plan = invite.grantPlanCode
        ? await this.prisma.plan.findUnique({ where: { code: invite.grantPlanCode }, select: { code: true, name: true } })
        : null;
      const by = invite.createdByOrgId ? await this.prisma.organization.findUnique({ where: { id: invite.createdByOrgId }, select: { name: true } }) : null;
      return { valid: true, openSignup: app.auth.allowBrokerSignup, plan, months: invite.grantMonths, invitedBy: by?.name ?? null };
    } catch (e) {
      return { valid: false, openSignup: app.auth.allowBrokerSignup, message: (e as Error).message };
    }
  }

  @Public()
  @Get('broker-invites/status')
  async status() {
    const app = await this.settings.getAppConfig();
    return { openSignup: app.auth.allowBrokerSignup };
  }

  // ------------------------------------------------------------------ broker: refer other brokers
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/referrals')
  referrals(@CurrentUser() user: RequestUser) {
    return this.invites.myReferrals(requireOrg(user), user.id);
  }

  // ------------------------------------------------------------------ super admin
  @Roles('SUPER_ADMIN')
  @Get('admin/broker-invites')
  async list() {
    const items = await this.prisma.brokerInvite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { createdByOrg: { select: { name: true } }, _count: { select: { orgs: true } } },
    });
    return { items: items.map((i) => ({ ...i, link: this.invites.inviteLink(i.code) })), leaderboard: await this.invites.leaderboard(20) };
  }

  @Roles('SUPER_ADMIN')
  @Post('admin/broker-invites')
  async create(@CurrentUser() user: RequestUser, @Body(new ZodPipe(inviteSchema)) body: z.infer<typeof inviteSchema>) {
    const code = this.invites.normalize(body.code) || (await this.invites.uniqueCode('BIQ'));
    const invite = await this.prisma.brokerInvite.create({
      data: {
        code,
        note: body.note || null,
        email: body.email || null,
        grantPlanCode: body.grantPlanCode || null,
        grantMonths: body.grantMonths,
        maxUses: body.maxUses,
        expiresAt: body.expiresAt ?? null,
        isActive: body.isActive,
        createdById: user.id,
      },
    });
    await this.audit.log(user, 'broker_invite.create', 'BrokerInvite', invite.id, { code });
    return { ...invite, link: this.invites.inviteLink(invite.code) };
  }

  @Roles('SUPER_ADMIN')
  @Patch('admin/broker-invites/:id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(inviteSchema.partial())) body: Partial<z.infer<typeof inviteSchema>>,
  ) {
    const { code: _code, ...rest } = body;
    const invite = await this.prisma.brokerInvite.update({ where: { id }, data: { ...rest, email: rest.email === '' ? null : rest.email } });
    await this.audit.log(user, 'broker_invite.update', 'BrokerInvite', id);
    return invite;
  }

  @Roles('SUPER_ADMIN')
  @Delete('admin/broker-invites/:id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.prisma.brokerInvite.update({ where: { id }, data: { isActive: false } });
    await this.audit.log(user, 'broker_invite.disable', 'BrokerInvite', id);
    return { ok: true };
  }
}
