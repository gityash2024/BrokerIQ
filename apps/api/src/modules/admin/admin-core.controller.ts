import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { GROWTH_FEATURES, INTEGRATIONS, featureDefault, getIntegration, renderSteps } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { AuditService } from '../../core/audit/audit.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { EventsService } from '../../core/events/events.service';
import { IntegrationTesterService } from '../integrations/integration-tester.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { paged } from '../../common/utils';
import { env } from '../../config/env';
import { FeaturesService } from '../../core/features/features.service';

const integrationSaveSchema = z.object({ enabled: z.boolean().optional(), fields: z.record(z.string(), z.unknown()).default({}) });

@ApiTags('admin')
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminCoreController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly tester: IntegrationTesterService,
    private readonly auth: AuthService,
    private readonly events: EventsService,
    private readonly features: FeaturesService,
  ) {}

  // ------------------------------------------------------------------ dashboard
  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
  @Get('dashboard')
  async dashboard() {
    const day = 86400_000;
    const since30 = new Date(Date.now() - 30 * day);
    const [users, brokers, listings, pending, leads30, enquiries30, kycPending, reportsOpen, paid30, tickets, subs, chatReports] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, role: 'USER' } }),
      this.prisma.organization.count({ where: { status: 'ACTIVE' } }),
      this.prisma.listing.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.listing.count({ where: { status: 'PENDING_REVIEW', deletedAt: null } }),
      this.prisma.lead.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.enquiry.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.kycDocument.count({ where: { status: 'PENDING' } }),
      this.prisma.listingReport.count({ where: { status: 'OPEN' } }),
      this.prisma.payment.aggregate({ where: { status: 'PAID', paidAt: { gte: since30 } }, _sum: { amount: true } }),
      this.prisma.contactMessage.count({ where: { status: 'OPEN' } }),
      this.prisma.subscription.findMany({ where: { status: { in: ['ACTIVE', 'TRIALING'] } }, include: { plan: true } }),
      this.prisma.contentReport.count({ where: { type: 'CHAT', status: 'OPEN' } }),
    ]);
    const mrr = subs.reduce((s, x) => s + (x.status === 'ACTIVE' ? (x.billingCycle === 'YEARLY' ? x.plan.priceYearly / 12 : x.plan.priceMonthly) : 0), 0);
    const planMix = Object.entries(subs.reduce<Record<string, number>>((acc, s) => ((acc[s.plan.name] = (acc[s.plan.name] ?? 0) + 1), acc), {})).map(
      ([plan, count]) => ({ plan, count }),
    );
    const series = await this.prisma.$queryRaw<{ day: Date; users: bigint; listings: bigint; leads: bigint }[]>`
      WITH days AS (SELECT generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') AS day)
      SELECT d.day,
        (SELECT COUNT(*) FROM "User" u WHERE date_trunc('day', u."createdAt") = d.day) AS users,
        (SELECT COUNT(*) FROM "Listing" l WHERE date_trunc('day', l."createdAt") = d.day) AS listings,
        (SELECT COUNT(*) FROM "Lead" x WHERE date_trunc('day', x."createdAt") = d.day) AS leads
      FROM days d ORDER BY d.day`;
    const revenue = await this.prisma.$queryRaw<{ month: Date; amount: bigint }[]>`
      SELECT date_trunc('month', "paidAt") AS month, SUM(amount) AS amount FROM "Payment"
      WHERE status = 'PAID' AND "paidAt" >= now() - interval '12 months' GROUP BY 1 ORDER BY 1`;
    const leadSources = await this.prisma.lead.groupBy({ by: ['source'], where: { createdAt: { gte: since30 } }, _count: { _all: true } });
    const integrations = await this.settings.platformOverview();
    return {
      kpis: {
        users,
        brokers,
        listings,
        pendingListings: pending,
        leads30,
        enquiries30,
        kycPending,
        reportsOpen,
        chatReports,
        revenue30: (paid30._sum.amount ?? 0) / 100,
        mrr: Math.round(mrr),
        openTickets: tickets,
      },
      series: series.map((s) => ({ day: s.day, users: Number(s.users), listings: Number(s.listings), leads: Number(s.leads) })),
      revenue: revenue.map((r) => ({ month: r.month, amount: Number(r.amount) / 100 })),
      planMix,
      leadSources: leadSources.map((l) => ({ source: l.source, count: l._count._all })),
      integrations: integrations.map((i) => ({ key: i.key, configured: i.configured, lastTestOk: i.lastTestOk })),
    };
  }

  // ------------------------------------------------------------------ credentials center
  @Get('integrations')
  async integrations(@Query('scope') scope?: string) {
    const apiUrl = env().PUBLIC_API_URL;
    const defs = INTEGRATIONS.filter((d) => (scope ? d.scope === scope : d.scope === 'platform'));
    return Promise.all(
      defs.map(async (d) => ({ ...d, steps: renderSteps(d, apiUrl), state: d.scope === 'platform' ? await this.settings.view(d.key) : null })),
    );
  }

  @Get('integrations/:key')
  async integration(@Param('key') key: string) {
    const def = getIntegration(key);
    if (!def || def.scope !== 'platform') throw new NotFoundException();
    return { ...def, steps: renderSteps(def, env().PUBLIC_API_URL), state: await this.settings.view(key) };
  }

  @Patch('integrations/:key')
  async saveIntegration(
    @CurrentUser() user: RequestUser,
    @Param('key') key: string,
    @Body(new ZodPipe(integrationSaveSchema)) body: z.infer<typeof integrationSaveSchema>,
  ) {
    const def = getIntegration(key);
    if (!def || def.scope !== 'platform') throw new NotFoundException();
    const state = await this.settings.save(key, body, { userId: user.id });
    await this.audit.log(user, 'credentials.update', 'Integration', key, { fields: Object.keys(body.fields ?? {}), enabled: body.enabled });
    return state;
  }

  @Post('integrations/:key/test')
  async testIntegration(@CurrentUser() user: RequestUser, @Param('key') key: string) {
    const r = await this.tester.test(key, null, user.email);
    await this.audit.log(user, 'credentials.test', 'Integration', key, r);
    return r;
  }

  @Delete('integrations/:key')
  async removeIntegration(@CurrentUser() user: RequestUser, @Param('key') key: string) {
    await this.settings.remove(key);
    await this.audit.log(user, 'credentials.delete', 'Integration', key);
    return { ok: true };
  }

  // ------------------------------------------------------------------ app config & flags
  @Get('app-config')
  appConfig() {
    return this.settings.getAppConfig();
  }

  @Patch('app-config')
  async updateAppConfig(@CurrentUser() user: RequestUser, @Body() body: any) {
    const cfg = await this.settings.updateAppConfig(body ?? {}, user.id);
    await this.audit.log(user, 'app_config.update', 'SystemSetting', 'app.config', { keys: Object.keys(body ?? {}) });
    return cfg;
  }

  /** Stored flags plus every known feature that has no row yet (shown with its default state). */
  @Get('flags')
  async flags() {
    const rows = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    const missing = GROWTH_FEATURES.filter((f) => !rows.some((r) => r.key === f.key)).map((f) => ({
      key: f.key,
      enabled: featureDefault(f.key),
      description: f.description,
      updatedAt: null,
    }));
    return [...rows.map((r) => ({ ...r, description: r.description ?? GROWTH_FEATURES.find((f) => f.key === r.key)?.description ?? null })), ...missing].sort(
      (a, b) => a.key.localeCompare(b.key),
    );
  }

  @Patch('flags/:key')
  async flag(@CurrentUser() user: RequestUser, @Param('key') key: string, @Body(new ZodPipe(z.object({ enabled: z.boolean() }))) body: any) {
    const f = await this.prisma.featureFlag.upsert({ where: { key }, create: { key, enabled: body.enabled }, update: { enabled: body.enabled } });
    await this.audit.log(user, 'flag.update', 'FeatureFlag', key, body);
    this.features.invalidate();
    return f;
  }

  // ------------------------------------------------------------------ audit, support, broadcasts
  @Get('audit')
  async auditLogs(@Query() q: { action?: string; actorId?: string; entity?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.AuditLogWhereInput = {
      ...(q.action ? { action: { contains: q.action } } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.entity ? { entity: q.entity } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 50,
        take: 50,
        include: { actor: { select: { name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paged(items, total, page, 50);
  }

  @Roles('SUPER_ADMIN', 'SUPPORT')
  @Get('support')
  support(@Query('status') status = 'OPEN') {
    return this.prisma.contactMessage.findMany({ where: { status: status as any }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  @Roles('SUPER_ADMIN', 'SUPPORT')
  @Patch('support/:id')
  updateTicket(@Param('id') id: string, @Body(new ZodPipe(z.object({ status: z.enum(['OPEN', 'CLOSED']), note: z.string().max(2000).optional() }))) body: any) {
    return this.prisma.contactMessage.update({ where: { id }, data: body });
  }

  @Get('broadcasts')
  broadcasts() {
    return this.prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  @Post('broadcasts')
  async broadcast(
    @CurrentUser() user: RequestUser,
    @Body(
      new ZodPipe(
        z.object({
          audience: z.enum(['ALL', 'USERS', 'BROKERS']),
          channel: z.enum(['PUSH', 'EMAIL', 'IN_APP']),
          title: z.string().min(2).max(120),
          body: z.string().min(2).max(2000),
          link: z.string().max(300).optional().nullable(),
        }),
      ),
    )
    body: any,
  ) {
    const where: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      ...(body.audience === 'USERS' ? { role: 'USER' } : body.audience === 'BROKERS' ? { role: { in: ['BROKER_ADMIN', 'BROKER_AGENT'] } } : {}),
    };
    const users = await this.prisma.user.findMany({ where, select: { id: true, email: true } });
    if (body.channel === 'EMAIL') {
      await this.settings.require('smtp');
      for (let i = 0; i < users.length; i += 40) {
        await this.mail
          .send({
            to: (await this.settings.resolve('smtp'))?.fromEmail as string,
            bcc: users.slice(i, i + 40).map((u) => u.email),
            subject: body.title,
            html: `<p>${escapeHtml(body.body).replace(/\n/g, '<br/>')}</p>${body.link ? `<p><a href="${body.link}">Open →</a></p>` : ''}`,
          })
          .catch(() => undefined);
      }
    } else {
      for (let i = 0; i < users.length; i += 200) {
        await this.notifications.notify(
          users.slice(i, i + 200).map((u) => u.id),
          { kind: 'SYSTEM', title: body.title, body: body.body, link: body.link ?? undefined, push: body.channel === 'PUSH' },
        );
      }
    }
    const b = await this.prisma.broadcast.create({ data: { ...body, sentCount: users.length, createdById: user.id } });
    await this.audit.log(user, 'broadcast.send', 'Broadcast', b.id, { audience: body.audience, channel: body.channel, count: users.length });
    return b;
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
