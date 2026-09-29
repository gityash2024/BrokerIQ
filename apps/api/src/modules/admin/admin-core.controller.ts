import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { INTEGRATIONS, getIntegration, renderSteps } from '@brokeriq/shared';
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

const integrationSaveSchema = z.object({ enabled: z.boolean().optional(), fields: z.record(z.string(), z.unknown()).default({}) });
const moderateSchema = z.object({ action: z.enum(['approve', 'reject']), reason: z.string().max(500).optional() });
const listingFlagsSchema = z.object({ isFeatured: z.boolean().optional(), featuredDays: z.number().int().min(1).max(365).optional(), isVerified: z.boolean().optional() });

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
  ) {}

  // ------------------------------------------------------------------ dashboard
  @Get('dashboard')
  async dashboard() {
    const day = 86400_000;
    const since30 = new Date(Date.now() - 30 * day);
    const [users, brokers, listings, pending, leads30, enquiries30, kycPending, reportsOpen, paid30, tickets, subs] = await Promise.all([
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
    ]);
    const mrr = subs.reduce((s, x) => s + (x.status === 'ACTIVE' ? (x.billingCycle === 'YEARLY' ? x.plan.priceYearly / 12 : x.plan.priceMonthly) : 0), 0);
    const planMix = Object.entries(subs.reduce<Record<string, number>>((acc, s) => ((acc[s.plan.name] = (acc[s.plan.name] ?? 0) + 1), acc), {})).map(([plan, count]) => ({ plan, count }));
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
      kpis: { users, brokers, listings, pendingListings: pending, leads30, enquiries30, kycPending, reportsOpen, revenue30: (paid30._sum.amount ?? 0) / 100, mrr: Math.round(mrr), openTickets: tickets },
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
    return Promise.all(defs.map(async (d) => ({ ...d, steps: renderSteps(d, apiUrl), state: d.scope === 'platform' ? await this.settings.view(d.key) : null })));
  }

  @Get('integrations/:key')
  async integration(@Param('key') key: string) {
    const def = getIntegration(key);
    if (!def || def.scope !== 'platform') throw new NotFoundException();
    return { ...def, steps: renderSteps(def, env().PUBLIC_API_URL), state: await this.settings.view(key) };
  }

  @Patch('integrations/:key')
  async saveIntegration(@CurrentUser() user: RequestUser, @Param('key') key: string, @Body(new ZodPipe(integrationSaveSchema)) body: any) {
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

  @Get('flags')
  flags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  @Patch('flags/:key')
  async flag(@CurrentUser() user: RequestUser, @Param('key') key: string, @Body(new ZodPipe(z.object({ enabled: z.boolean() }))) body: any) {
    const f = await this.prisma.featureFlag.upsert({ where: { key }, create: { key, enabled: body.enabled }, update: { enabled: body.enabled } });
    await this.audit.log(user, 'flag.update', 'FeatureFlag', key, body);
    return f;
  }

  // ------------------------------------------------------------------ users
  @Get('users')
  async users(@Query() q: { q?: string; role?: string; status?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.role ? { role: q.role as any } : {}),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 30,
        take: 30,
        select: { id: true, name: true, email: true, phone: true, role: true, status: true, emailVerified: true, createdAt: true, lastLoginAt: true, organization: { select: { id: true, name: true, slug: true } }, _count: { select: { listings: true, enquiries: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paged(items, total, page, 30);
  }

  @Patch('users/:id')
  async updateUser(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']).optional(), role: z.enum(['USER', 'SUPER_ADMIN']).optional() }))) body: any) {
    if (id === user.id) throw new BadRequestException('अपना account खुद नहीं बदल सकते');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException();
    const data: Prisma.UserUpdateInput = { status: body.status };
    if (body.role) {
      data.role = body.role;
      if (body.role === 'SUPER_ADMIN') data.organization = { disconnect: true };
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    if (body.status === 'SUSPENDED' || body.role) await this.auth.revokeAll(id);
    await this.audit.log(user, 'user.update', 'User', id, body);
    return { id: updated.id, status: updated.status, role: updated.role };
  }

  // ------------------------------------------------------------------ organizations (brokers)
  @Get('organizations')
  async orgs(@Query() q: { q?: string; status?: string; verification?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.OrganizationWhereInput = {
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.verification ? { verification: q.verification as any } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { slug: { contains: q.q } }, { phone: { contains: q.q } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 30,
        take: 30,
        include: { subscription: { include: { plan: { select: { name: true, code: true } } } }, _count: { select: { members: true, listings: true, leads: true } } },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return paged(items.map(({ webhookKey, ...o }) => (void webhookKey, o)), total, page, 30);
  }

  @Get('organizations/:id')
  async org(@Param('id') id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: { select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true } },
        subscription: { include: { plan: true } },
        kycDocuments: { orderBy: { createdAt: 'desc' } },
        localities: { select: { name: true } },
        connectors: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { listings: true, leads: true, automations: true } },
      },
    });
    if (!org) throw new NotFoundException();
    const { webhookKey, ...rest } = org;
    void webhookKey;
    return rest;
  }

  @Patch('organizations/:id')
  async updateOrg(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']).optional(), verification: z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED']).optional(), planCode: z.string().optional(), periodDays: z.number().int().min(1).max(3650).optional() }))) body: any,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException();
    await this.prisma.organization.update({ where: { id }, data: { status: body.status, verification: body.verification } });
    if (body.verification === 'VERIFIED') {
      await this.prisma.listing.updateMany({ where: { organizationId: id, deletedAt: null }, data: { isVerified: true } });
      await this.notifications.notifyOrg(id, { kind: 'KYC_UPDATE', title: '✅ आपकी firm verified हो गई है', link: '/broker/settings' }, { adminsOnly: true });
    }
    if (body.planCode) {
      const plan = await this.prisma.plan.findUnique({ where: { code: body.planCode } });
      if (!plan) throw new BadRequestException('Plan not found');
      const end = new Date(Date.now() + (body.periodDays ?? 30) * 86400_000);
      await this.prisma.subscription.upsert({
        where: { organizationId: id },
        create: { organizationId: id, planId: plan.id, status: 'ACTIVE', currentPeriodEnd: plan.priceMonthly === 0 ? null : end },
        update: { planId: plan.id, status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: plan.priceMonthly === 0 ? null : end, cancelAtPeriodEnd: false },
      });
    }
    if (body.status === 'SUSPENDED') {
      const members = await this.prisma.user.findMany({ where: { organizationId: id }, select: { id: true } });
      for (const m of members) await this.auth.revokeAll(m.id);
    }
    await this.audit.log(user, 'organization.update', 'Organization', id, body);
    return { ok: true };
  }

  // ------------------------------------------------------------------ moderation
  @Get('moderation/listings')
  async moderation(@Query() q: { status?: string; q?: string; page?: string; flagged?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      status: (q.status as any) || 'PENDING_REVIEW',
      ...(q.flagged === 'true' ? { NOT: { moderationFlags: { isEmpty: true } } } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { slug: { contains: q.q } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        skip: (page - 1) * 20,
        take: 20,
        include: {
          media: { orderBy: { sortOrder: 'asc' }, take: 6 },
          locality: { select: { name: true } },
          postedBy: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
          organization: { select: { id: true, name: true, verification: true } },
          _count: { select: { reports: true } },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);
    return paged(items, total, page, 20);
  }

  @Post('moderation/listings/:id')
  async moderate(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(moderateSchema)) body: any) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l) throw new NotFoundException();
    const app = await this.settings.getAppConfig();
    const approve = body.action === 'approve';
    if (!approve && !body.reason) throw new BadRequestException('Reject का कारण लिखें');
    const updated = await this.prisma.listing.update({
      where: { id },
      data: approve
        ? { status: 'ACTIVE', rejectionReason: null, moderationFlags: [], publishedAt: l.publishedAt ?? new Date(), expiresAt: new Date(Date.now() + app.listing.expiryDays * 86400_000) }
        : { status: 'REJECTED', rejectionReason: body.reason },
    });
    const link = approve ? `${env().PUBLIC_WEB_URL}/property/${l.slug}` : `${env().PUBLIC_WEB_URL}${l.organizationId ? '/broker/listings' : '/account/listings'}`;
    await this.notifications.notify(l.postedById, {
      kind: approve ? 'LISTING_APPROVED' : 'LISTING_REJECTED',
      title: approve ? '🎉 आपकी listing live है' : 'Listing में बदलाव ज़रूरी',
      body: approve ? l.title : `${l.title}: ${body.reason}`,
      link: approve ? `/property/${l.slug}` : l.organizationId ? '/broker/listings' : '/account/listings',
    });
    const poster = await this.prisma.user.findUnique({ where: { id: l.postedById } });
    if (poster) this.mail.trySendTemplate(approve ? 'listing.approved' : 'listing.rejected', poster.email, { listing: l, reason: body.reason, link }).catch(() => undefined);
    if (approve && l.status !== 'ACTIVE') this.events.emit('listing.published', { listingId: id });
    await this.audit.log(user, `listing.${body.action}`, 'Listing', id, { reason: body.reason });
    return updated;
  }

  @Patch('listings/:id/flags')
  async listingFlags(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(listingFlagsSchema)) body: any) {
    const data: Prisma.ListingUpdateInput = {};
    if (body.isFeatured !== undefined) {
      data.isFeatured = body.isFeatured;
      data.featuredUntil = body.isFeatured ? new Date(Date.now() + (body.featuredDays ?? 30) * 86400_000) : null;
    }
    if (body.isVerified !== undefined) data.isVerified = body.isVerified;
    const l = await this.prisma.listing.update({ where: { id }, data });
    await this.audit.log(user, 'listing.flags', 'Listing', id, body);
    return l;
  }

  @Get('listings')
  async allListings(@Query() q: { q?: string; status?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { slug: { contains: q.q } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 30, take: 30, include: { locality: { select: { name: true } }, organization: { select: { name: true } }, postedBy: { select: { name: true, email: true } } } }),
      this.prisma.listing.count({ where }),
    ]);
    return paged(items, total, page, 30);
  }

  @Get('reports')
  reports(@Query('status') status = 'OPEN') {
    return this.prisma.listingReport.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { listing: { select: { id: true, title: true, slug: true, status: true } }, user: { select: { name: true, email: true } } },
    });
  }

  @Patch('reports/:id')
  async resolveReport(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ status: z.enum(['RESOLVED', 'DISMISSED']), resolution: z.string().max(500).optional(), archiveListing: z.boolean().optional() }))) body: any) {
    const r = await this.prisma.listingReport.update({ where: { id }, data: { status: body.status, resolution: body.resolution, resolvedAt: new Date() } });
    if (body.archiveListing) await this.prisma.listing.update({ where: { id: r.listingId }, data: { status: 'ARCHIVED' } });
    await this.audit.log(user, 'report.resolve', 'ListingReport', id, body);
    return r;
  }

  // ------------------------------------------------------------------ KYC
  @Get('kyc')
  kyc(@Query('status') status = 'PENDING') {
    return this.prisma.kycDocument.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true } }, organization: { select: { id: true, name: true, reraNumber: true, verification: true } } },
    });
  }

  @Patch('kyc/:id')
  async reviewKyc(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ status: z.enum(['VERIFIED', 'REJECTED']), note: z.string().max(500).optional(), verifyOrganization: z.boolean().default(true) }))) body: any) {
    const doc = await this.prisma.kycDocument.update({ where: { id }, data: { status: body.status, reviewNote: body.note, reviewedById: user.id, reviewedAt: new Date() } });
    // A tenant's approved ID makes them a "Verified tenant" (brokers see the badge on enquiries).
    if (doc.userId && body.status === 'VERIFIED') await this.prisma.user.updateMany({ where: { id: doc.userId, role: 'USER', tenantVerifiedAt: null }, data: { tenantVerifiedAt: new Date() } });
    if (doc.organizationId && body.verifyOrganization) {
      await this.updateOrg(user, doc.organizationId, { verification: body.status } as any);
    }
    const target = doc.userId ?? (doc.organizationId ? (await this.prisma.user.findFirst({ where: { organizationId: doc.organizationId, role: 'BROKER_ADMIN' } }))?.id : null);
    if (target) await this.notifications.notify(target, { kind: 'KYC_UPDATE', title: body.status === 'VERIFIED' ? '✅ Document verified' : '❌ Document rejected', body: body.note, link: doc.organizationId ? '/broker/settings' : '/account/profile' });
    await this.audit.log(user, 'kyc.review', 'KycDocument', id, body);
    return doc;
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
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50, include: { actor: { select: { name: true, email: true } } } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paged(items, total, page, 50);
  }

  @Get('support')
  support(@Query('status') status = 'OPEN') {
    return this.prisma.contactMessage.findMany({ where: { status: status as any }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

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
    @Body(new ZodPipe(z.object({ audience: z.enum(['ALL', 'USERS', 'BROKERS']), channel: z.enum(['PUSH', 'EMAIL', 'IN_APP']), title: z.string().min(2).max(120), body: z.string().min(2).max(2000), link: z.string().max(300).optional().nullable() }))) body: any,
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
        await this.mail.send({ to: (await this.settings.resolve('smtp'))?.fromEmail as string, bcc: users.slice(i, i + 40).map((u) => u.email), subject: body.title, html: `<p>${escapeHtml(body.body).replace(/\n/g, '<br/>')}</p>${body.link ? `<p><a href="${body.link}">Open →</a></p>` : ''}` }).catch(() => undefined);
      }
    } else {
      for (let i = 0; i < users.length; i += 200) {
        await this.notifications.notify(users.slice(i, i + 200).map((u) => u.id), { kind: 'SYSTEM', title: body.title, body: body.body, link: body.link ?? undefined, push: body.channel === 'PUSH' });
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
