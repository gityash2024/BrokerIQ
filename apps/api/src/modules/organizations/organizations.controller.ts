import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { brokerOnboardingSchema, inviteMemberSchema, kycSubmitSchema, normalizeIndianPhone, reviewSchema } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UsageService } from '../../core/usage/usage.service';
import { MailService } from '../../core/mail/mail.service';
import { AuditService } from '../../core/audit/audit.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { paged, randomToken, requireOrg, sha256 } from '../../common/utils';
import { LISTING_CARD_SELECT } from '../listings/listings.service';
import { env } from '../../config/env';
import { FeaturesService } from '../../core/features/features.service';
import { AccessService } from '../../core/access/access.service';
import { readBrokerTeam } from './team-query';

const PUBLIC_ORG_SELECT = {
  id: true,
  responseMinutes: true,
  name: true,
  slug: true,
  logoUrl: true,
  coverUrl: true,
  about: true,
  address: true,
  website: true,
  reraNumber: true,
  experienceYears: true,
  verification: true,
  rating: true,
  reviewCount: true,
  createdAt: true,
  localities: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.OrganizationSelect;

const meta = (req: any) => ({ ip: (req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip)?.trim(), userAgent: req.headers['user-agent'] });

@ApiTags('brokers')
@Controller()
export class OrganizationsController {
  constructor(
    private readonly access: AccessService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly usage: UsageService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly features: FeaturesService,
  ) {}

  // ------------------------------------------------------------------ onboarding & profile
  /** Turns a USER into a broker firm owner (or updates the firm profile). Returns fresh tokens. */
  @Post('broker/onboarding')
  async onboarding(@CurrentUser() user: RequestUser, @Body(new ZodPipe(brokerOnboardingSchema)) body: z.infer<typeof brokerOnboardingSchema>, @Req() req: any) {
    if (user.role === 'SUPER_ADMIN') throw new BadRequestException('Super Admin broker account नहीं बना सकता');
    if (user.role === 'BROKER_AGENT') throw new ForbiddenException('सिर्फ firm admin profile बदल सकता है');
    let orgId = user.orgId;
    if (!orgId) {
      const invite = await this.auth.brokerGate(body.inviteCode);
      orgId = (await this.auth.createBrokerOrg(user.id, body.firmName, undefined, invite)).id;
    }
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        name: body.firmName,
        reraNumber: body.reraNumber,
        gstNumber: body.gstNumber,
        phone: normalizeIndianPhone(body.phone) ?? body.phone,
        whatsapp: body.whatsapp ? (normalizeIndianPhone(body.whatsapp) ?? body.whatsapp) : normalizeIndianPhone(body.phone),
        about: body.about,
        address: body.address,
        website: body.website || null,
        experienceYears: body.experienceYears,
        logoUrl: body.logoUrl,
        coverUrl: body.coverUrl,
        onboarded: true,
        localities: { set: body.localityIds.map((id: string) => ({ id })) },
      },
    });
    await this.audit.log({ ...user, orgId }, 'broker.onboarding', 'Organization', orgId);
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { organization: true } });
    return this.auth.issue(fresh, meta(req));
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/profile')
  async profile(@CurrentUser() user: RequestUser) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: requireOrg(user) },
      include: { localities: { select: { id: true, name: true, slug: true } }, subscription: { include: { plan: true } } },
    });
    const usage = await this.usage.limits(org.id);
    const [agents, activeListings, leadsThisMonth, aiThisMonth] = await Promise.all([
      this.prisma.user.count({ where: { organizationId: org.id, status: 'ACTIVE' } }),
      this.prisma.listing.count({ where: { organizationId: org.id, status: { in: ['ACTIVE', 'PENDING_REVIEW'] }, deletedAt: null } }),
      this.usage.count(org.id, 'leads'),
      this.usage.count(org.id, 'ai'),
    ]);
    return {
      ...org,
      webhookKey: user.role === 'BROKER_ADMIN' ? org.webhookKey : undefined,
      plan: usage,
      usage: { agents, activeListings, leadsThisMonth, aiThisMonth },
    };
  }

  @Roles('BROKER_ADMIN')
  @Post('broker/webhook-key/rotate')
  async rotateWebhookKey(@CurrentUser() user: RequestUser) {
    const org = await this.prisma.organization.update({ where: { id: requireOrg(user) }, data: { webhookKey: randomToken(18) } });
    await this.audit.log(user, 'broker.webhook_key.rotate', 'Organization', org.id);
    return { webhookKey: org.webhookKey };
  }

  @Roles('BROKER_ADMIN')
  @Patch('broker/business-hours')
  async businessHours(@CurrentUser() user: RequestUser, @Body() body: { start?: string; end?: string; days?: number[]; enabled?: boolean }) {
    const value = { enabled: body.enabled ?? true, start: body.start ?? '09:00', end: body.end ?? '20:00', days: body.days ?? [1, 2, 3, 4, 5, 6] };
    await this.prisma.organization.update({ where: { id: requireOrg(user) }, data: { businessHours: value } });
    return value;
  }

  // ------------------------------------------------------------------ team
  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get('broker/team')
  async team(@CurrentUser() user: RequestUser) {
    return readBrokerTeam(this.prisma, user);
  }

  @Roles('BROKER_ADMIN')
  @Post('broker/team/invite')
  async invite(@CurrentUser() user: RequestUser, @Body(new ZodPipe(inviteMemberSchema)) body: z.infer<typeof inviteMemberSchema>) {
    const orgId = requireOrg(user);
    const [members, pending] = await Promise.all([
      this.prisma.user.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      this.prisma.invite.count({ where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    await this.usage.assert(orgId, 'agents', members + pending);
    const existing = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (existing?.organizationId) throw new BadRequestException('यह user पहले से किसी broker team में है');
    const token = randomToken(24);
    const invite = await this.prisma.invite.create({
      data: {
        organizationId: orgId,
        email: body.email,
        name: body.name,
        role: body.role,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 7 * 86400_000),
        invitedById: user.id,
      },
    });
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const inviter = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const link = `${env().PUBLIC_WEB_URL}/invite/${token}`;
    const emailed = await this.mail.trySendTemplate('team.invite', body.email, { name: body.name, inviter: inviter.name, orgName: org.name, link });
    await this.audit.log(user, 'team.invite', 'Invite', invite.id, { email: body.email });
    return { id: invite.id, link, emailed };
  }

  @Roles('BROKER_ADMIN')
  @Delete('broker/team/invites/:id')
  async cancelInvite(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.prisma.invite.deleteMany({ where: { id, organizationId: requireOrg(user) } });
    return { ok: true };
  }

  @Roles('BROKER_ADMIN')
  @Patch('broker/team/:userId')
  async updateMember(
    @CurrentUser() user: RequestUser,
    @Param('userId') userId: string,
    @Body(new ZodPipe(z.object({ role: z.enum(['BROKER_ADMIN', 'BROKER_AGENT']).optional(), status: z.enum(['ACTIVE', 'SUSPENDED']).optional() }))) body: any,
  ) {
    const orgId = requireOrg(user);
    if (userId === user.id) throw new BadRequestException('अपना role/status खुद नहीं बदल सकते');
    const member = await this.prisma.user.findFirst({ where: { id: userId, organizationId: orgId } });
    if (!member) throw new NotFoundException();
    const updated = await this.prisma.user.update({ where: { id: userId }, data: body });
    if (body.status === 'SUSPENDED' || body.role) await this.auth.revokeAll(userId);
    await this.audit.log(user, 'team.update', 'User', userId, body);
    return { id: updated.id, role: updated.role, status: updated.status };
  }

  @Roles('BROKER_ADMIN')
  @Delete('broker/team/:userId')
  async removeMember(@CurrentUser() user: RequestUser, @Param('userId') userId: string) {
    const orgId = requireOrg(user);
    if (userId === user.id) throw new BadRequestException('खुद को remove नहीं कर सकते');
    const member = await this.prisma.user.findFirst({ where: { id: userId, organizationId: orgId } });
    if (!member) throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.lead.updateMany({ where: { organizationId: orgId, assignedToId: userId }, data: { assignedToId: null } }),
      this.prisma.followUp.updateMany({ where: { organizationId: orgId, assignedToId: userId, status: 'PENDING' }, data: { assignedToId: null } }),
      this.prisma.user.update({ where: { id: userId }, data: { organizationId: null, role: 'USER' } }),
    ]);
    await this.auth.revokeAll(userId);
    await this.audit.log(user, 'team.remove', 'User', userId);
    return { ok: true };
  }

  @Public()
  @Get('invites/:token')
  async invitePreview(@Param('token') token: string) {
    const inv = await this.prisma.invite.findUnique({
      where: { tokenHash: sha256(token) },
      include: { organization: { select: { name: true, logoUrl: true } } },
    });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw new NotFoundException('Invite expire हो गया है');
    return { email: inv.email, name: inv.name, role: inv.role, organization: inv.organization };
  }

  @Post('invites/:token/accept')
  async acceptInvite(@CurrentUser() user: RequestUser, @Param('token') token: string, @Req() req: any) {
    const inv = await this.prisma.$transaction(async (tx) => {
      const tokenHash = sha256(token);
      await tx.$queryRaw`SELECT id FROM "Invite" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      const invitation = await tx.invite.findUnique({ where: { tokenHash } });
      if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) throw new NotFoundException('Invite expire हो गया है');
      const member = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (invitation.email.toLowerCase() !== member.email.toLowerCase()) throw new ForbiddenException('Log in with the invited email address');
      if (!['USER', 'BROKER_ADMIN', 'BROKER_AGENT'].includes(member.role)) throw new ForbiddenException('Platform staff cannot join a broker firm');
      if (member.organizationId && member.organizationId !== invitation.organizationId) throw new BadRequestException('आप पहले से किसी दूसरी team में हैं');
      const firm = await tx.organization.findUniqueOrThrow({ where: { id: invitation.organizationId } });
      if (firm.status !== 'ACTIVE') throw new ForbiddenException('Firm is not active');
      await tx.user.update({ where: { id: user.id }, data: { organizationId: invitation.organizationId, role: invitation.role, emailVerified: true } });
      await tx.invite.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      return invitation;
    });
    await this.auth.revokeAll(user.id);
    await this.notifications.notifyOrg(
      inv.organizationId,
      { kind: 'SYSTEM', title: `${inv.name} team में शामिल हुए`, link: '/broker/team' },
      { adminsOnly: true },
    );
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { organization: true } });
    return this.auth.issue(fresh, meta(req));
  }

  // ------------------------------------------------------------------ public directory & microsite
  @Public()
  @Get('brokers')
  async directory(@Query() q: { q?: string; locality?: string; verified?: string; page?: string; sort?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.OrganizationWhereInput = {
      status: 'ACTIVE',
      onboarded: true,
      ...(q.verified === 'true' ? { verification: 'VERIFIED' } : {}),
      ...(q.locality ? { localities: { some: { slug: q.locality } } } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy:
          q.sort === 'top'
            ? [{ rankScore: 'desc' }, { verification: 'desc' }, { rating: 'desc' }]
            : [{ verification: 'desc' }, { rankScore: 'desc' }, { rating: 'desc' }, { reviewCount: 'desc' }, { createdAt: 'asc' }],
        skip: (page - 1) * 24,
        take: 24,
        select: { ...PUBLIC_ORG_SELECT, _count: { select: { listings: { where: { status: 'ACTIVE', deletedAt: null } } } } },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return paged(items, total, page, 24);
  }

  @Public()
  @Get('brokers/:slug')
  async microsite(@Param('slug') slug: string) {
    const rentalOnly = await this.features.rentalOnly();
    const org = await this.prisma.organization.findFirst({ where: { slug, status: 'ACTIVE' }, select: { ...PUBLIC_ORG_SELECT, phone: true, whatsapp: true } });
    if (!org) throw new NotFoundException('Broker नहीं मिला');
    const [listings, reviews, team, stats] = await Promise.all([
      this.prisma.listing.findMany({
        where: { organizationId: org.id, status: 'ACTIVE', deletedAt: null, ...(rentalOnly ? { purpose: 'RENT' as const } : {}) },
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
        take: 24,
        select: LISTING_CARD_SELECT,
      }),
      this.prisma.review.findMany({
        where: { organizationId: org.id, status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true, avatarUrl: true } } },
      }),
      this.prisma.user.findMany({ where: { organizationId: org.id, status: 'ACTIVE' }, select: { id: true, name: true, avatarUrl: true, role: true } }),
      this.prisma.listing.groupBy({ by: ['purpose'], where: { organizationId: org.id, status: 'ACTIVE', deletedAt: null }, _count: { _all: true } }),
    ]);
    return { ...org, listings, reviews, team, stats: Object.fromEntries(stats.map((s) => [s.purpose, s._count._all])) };
  }

  @Post('brokers/:id/reviews')
  async review(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(reviewSchema.omit({ organizationId: true }))) body: any) {
    await this.access.assertAllowed(user, 'review');
    if (user.orgId === id) throw new ForbiddenException('अपनी firm को review नहीं कर सकते');
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException();
    await this.prisma.review.upsert({
      where: { organizationId_userId: { organizationId: id, userId: user.id } },
      create: { organizationId: id, userId: user.id, rating: body.rating, comment: body.comment },
      update: { rating: body.rating, comment: body.comment },
    });
    await this.recomputeRating(id);
    return { ok: true };
  }

  @Roles('BROKER_ADMIN')
  @Get('broker/reviews')
  brokerReviews(@CurrentUser() user: RequestUser) {
    return this.prisma.review.findMany({
      where: { organizationId: requireOrg(user) },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, avatarUrl: true } } },
    });
  }

  @Roles('BROKER_ADMIN')
  @Patch('broker/reviews/:id')
  async replyReview(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ reply: z.string().max(1500) }))) body: any) {
    const r = await this.prisma.review.findFirst({ where: { id, organizationId: requireOrg(user) } });
    if (!r) throw new NotFoundException();
    return this.prisma.review.update({ where: { id }, data: { reply: body.reply } });
  }

  async recomputeRating(orgId: string) {
    const agg = await this.prisma.review.aggregate({ where: { organizationId: orgId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: true });
    await this.prisma.organization.update({ where: { id: orgId }, data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count } });
  }

  // ------------------------------------------------------------------ KYC
  @Post('kyc')
  async submitKyc(@CurrentUser() user: RequestUser, @Body(new ZodPipe(kycSubmitSchema)) body: z.infer<typeof kycSubmitSchema>) {
    const forOrg = !!user.orgId && user.role === 'BROKER_ADMIN';
    const doc = await this.prisma.kycDocument.create({ data: { ...body, userId: forOrg ? null : user.id, organizationId: forOrg ? user.orgId : null } });
    if (forOrg) await this.prisma.organization.update({ where: { id: user.orgId! }, data: { verification: 'PENDING' } });
    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await this.notifications.notify(
      admins.map((a) => a.id),
      { kind: 'KYC_UPDATE', title: 'नया KYC document review के लिए', link: '/admin/kyc', push: false },
    );
    return doc;
  }

  @Get('kyc/mine')
  myKyc(@CurrentUser() user: RequestUser) {
    return this.prisma.kycDocument.findMany({
      where: user.orgId && user.role === 'BROKER_ADMIN' ? { organizationId: user.orgId } : { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
