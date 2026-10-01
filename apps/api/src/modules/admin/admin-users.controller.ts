import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { paged } from '../../common/utils';

/** Staff views of users, broker firms and KYC documents. */
@ApiTags('admin')
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly auth: AuthService,
  ) {}

  // ------------------------------------------------------------------ users
  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
  @Get('users')
  async users(@Query() q: { q?: string; role?: string; status?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.role ? { role: q.role as any } : {}),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.q
        ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 30,
        take: 30,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          blockedReason: true,
          restrictions: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          _count: { select: { listings: true, enquiries: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paged(items, total, page, 30);
  }

  @Patch('users/:id')
  async updateUser(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(
      new ZodPipe(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']).optional(), role: z.enum(['USER', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT']).optional() })),
    )
    body: any,
  ) {
    if (id === user.id) throw new BadRequestException('अपना account खुद नहीं बदल सकते');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException();
    const data: Prisma.UserUpdateInput = { status: body.status };
    if (body.role) {
      data.role = body.role;
      // BrokerIQ staff never belong to a broker firm.
      if (['SUPER_ADMIN', 'MODERATOR', 'SUPPORT'].includes(body.role)) data.organization = { disconnect: true };
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    if (body.status === 'SUSPENDED' || body.role) await this.auth.revokeAll(id);
    await this.audit.log(user, 'user.update', 'User', id, body);
    return { id: updated.id, status: updated.status, role: updated.role };
  }

  // ------------------------------------------------------------------ organizations (brokers)
  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
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
        include: {
          subscription: { include: { plan: { select: { name: true, code: true } } } },
          _count: { select: { members: true, listings: true, leads: true } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return paged(
      items.map(({ webhookKey, ...o }) => (void webhookKey, o)),
      total,
      page,
      30,
    );
  }

  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
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
    @Body(
      new ZodPipe(
        z.object({
          status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
          verification: z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED']).optional(),
          planCode: z.string().optional(),
          periodDays: z.number().int().min(1).max(3650).optional(),
        }),
      ),
    )
    body: any,
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
        update: {
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: plan.priceMonthly === 0 ? null : end,
          cancelAtPeriodEnd: false,
        },
      });
    }
    if (body.status === 'SUSPENDED') {
      const members = await this.prisma.user.findMany({ where: { organizationId: id }, select: { id: true } });
      for (const m of members) await this.auth.revokeAll(m.id);
    }
    await this.audit.log(user, 'organization.update', 'Organization', id, body);
    return { ok: true };
  }

  // ------------------------------------------------------------------ KYC
  @Get('kyc')
  kyc(@Query('status') status = 'PENDING') {
    return this.prisma.kycDocument.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true, reraNumber: true, verification: true } },
      },
    });
  }

  @Patch('kyc/:id')
  async reviewKyc(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(
      new ZodPipe(z.object({ status: z.enum(['VERIFIED', 'REJECTED']), note: z.string().max(500).optional(), verifyOrganization: z.boolean().default(true) })),
    )
    body: any,
  ) {
    const doc = await this.prisma.kycDocument.update({
      where: { id },
      data: { status: body.status, reviewNote: body.note, reviewedById: user.id, reviewedAt: new Date() },
    });
    // A tenant's approved ID makes them a "Verified tenant" (brokers see the badge on enquiries).
    if (doc.userId && body.status === 'VERIFIED')
      await this.prisma.user.updateMany({ where: { id: doc.userId, role: 'USER', tenantVerifiedAt: null }, data: { tenantVerifiedAt: new Date() } });
    if (doc.organizationId && body.verifyOrganization) {
      await this.updateOrg(user, doc.organizationId, { verification: body.status } as any);
    }
    const target =
      doc.userId ??
      (doc.organizationId ? (await this.prisma.user.findFirst({ where: { organizationId: doc.organizationId, role: 'BROKER_ADMIN' } }))?.id : null);
    if (target)
      await this.notifications.notify(target, {
        kind: 'KYC_UPDATE',
        title: body.status === 'VERIFIED' ? '✅ Document verified' : '❌ Document rejected',
        body: body.note,
        link: doc.organizationId ? '/broker/settings' : '/account/profile',
      });
    await this.audit.log(user, 'kyc.review', 'KycDocument', id, body);
    return doc;
  }
}
