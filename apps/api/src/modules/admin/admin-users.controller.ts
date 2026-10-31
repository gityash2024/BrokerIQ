import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Res } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
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
import { resolveDateRange } from '../../common/utils/dates';
import { createExcelReport } from '../../common/excel';
import { renderPdf, pdfText, pdfTable } from '../../common/pdf';
import { generateCsv } from '../../common/csv';

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
  @Post('organizations')
  async createBroker(
    @CurrentUser() actor: RequestUser,
    @Body(
      new ZodPipe(
        z.object({
          name: z.string().trim().min(2).max(80),
          firmName: z.string().trim().min(2).max(120),
          email: z
            .string()
            .email()
            .transform((s) => s.toLowerCase()),
          password: z.string().min(8).max(128),
          phone: z.string().max(20).optional(),
        }),
      ),
    )
    body: { name: string; firmName: string; email: string; password: string; phone?: string },
  ) {
    const passwordHash = await bcrypt.hash(body.password, 12);
    const org = await this.prisma.$transaction(async (tx) => {
      if (await tx.user.findUnique({ where: { email: body.email } })) throw new BadRequestException('Email already registered');
      const slug = `${
        body.firmName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'firm'
      }-${randomBytes(4).toString('hex')}`;
      const firm = await tx.organization.create({ data: { name: body.firmName, slug, phone: body.phone, email: body.email, onboarded: true } });
      await tx.user.create({
        data: { name: body.name, email: body.email, phone: body.phone, role: 'BROKER_ADMIN', organizationId: firm.id, passwordHash, emailVerified: true },
      });
      const plan = await tx.plan.findFirst({ where: { isActive: true, priceMonthly: 0 }, orderBy: { sortOrder: 'asc' } });
      if (plan) await tx.subscription.create({ data: { organizationId: firm.id, planId: plan.id, status: 'ACTIVE' } });
      return firm;
    });
    await this.audit.log(actor, 'broker.create', 'Organization', org.id, { name: org.name });
    return org;
  }

  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
  @Get('users')
  async users(@Query() q: { q?: string; role?: string; status?: string; page?: string; organizationId?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.organizationId ? { organizationId: q.organizationId } : {}),
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
  private buildKycWhereClause(filters: {
    status?: string;
    role?: string;
    search?: string;
    brokerId?: string;
    agentId?: string;
    datePreset?: string;
    from?: string;
    to?: string;
    ids?: string;
  }): Prisma.KycDocumentWhereInput {
    const where: Prisma.KycDocumentWhereInput = {};

    if (filters.brokerId) {
      where.OR = [
        { organizationId: filters.brokerId },
        { user: { organizationId: filters.brokerId } },
      ];
    }

    if (filters.ids) {
      const idList = filters.ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (idList.length > 0) {
        where.id = { in: idList };
      }
    }

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status as any;
    }

    if (filters.agentId) {
      where.userId = filters.agentId;
    }

    if (filters.role && filters.role !== 'ALL') {
      where.user = { role: filters.role as any };
    }

    const { startDate, endDate } = resolveDateRange(filters.datePreset, filters.from, filters.to);
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { docNumber: { contains: term, mode: 'insensitive' } },
            { user: { name: { contains: term, mode: 'insensitive' } } },
            { user: { email: { contains: term, mode: 'insensitive' } } },
            { user: { phone: { contains: term, mode: 'insensitive' } } },
            { organization: { name: { contains: term, mode: 'insensitive' } } },
            { organization: { reraNumber: { contains: term, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    return where;
  }

  @Get('kyc')
  kyc(
    @Query('status') status = 'PENDING',
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('brokerId') brokerId?: string,
    @Query('agentId') agentId?: string,
    @Query('datePreset') datePreset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where = this.buildKycWhereClause({ status, role, search, brokerId, agentId, datePreset, from, to });
    return this.prisma.kycDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        organization: { select: { id: true, name: true, reraNumber: true, verification: true } },
      },
    });
  }

  @Roles('SUPER_ADMIN', 'BROKER_ADMIN')
  @Get('kyc/export')
  async exportKyc(
    @Query('format') format = 'csv',
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('brokerId') brokerId?: string,
    @Query('agentId') agentId?: string,
    @Query('datePreset') datePreset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('ids') ids?: string,
    @Res() res?: any,
    @CurrentUser() user?: RequestUser,
  ) {
    let effectiveBrokerId = brokerId;
    if (user && user.role !== 'SUPER_ADMIN') {
      if (!user.orgId) {
        throw new ForbiddenException('Organization context missing for broker export');
      }
      effectiveBrokerId = user.orgId;
    }
    const where = this.buildKycWhereClause({
      status: status ?? 'ALL',
      role,
      search,
      brokerId: effectiveBrokerId,
      agentId,
      datePreset,
      from,
      to,
      ids,
    });

    const docs = await this.prisma.kycDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        organization: { select: { id: true, name: true, reraNumber: true, verification: true } },
      },
    });

    const filename = `kyc-export-${new Date().toISOString().slice(0, 10)}`;
    const normalized = (format || 'csv').toLowerCase();

    if (normalized === 'xlsx') {
      const buffer = await createExcelReport({
        sheetName: 'KYC Documents',
        title: 'BrokerIQ — KYC Verification Report',
        metadata: { Status: status || 'ALL', Role: role || 'ALL', Date: datePreset || 'ALL' },
        columns: [
          { header: 'ID', key: 'id', width: 26 },
          { header: 'Name / Entity', key: 'name', width: 22 },
          { header: 'Email', key: 'email', width: 26 },
          { header: 'Phone', key: 'phone', width: 16 },
          { header: 'Role / Type', key: 'role', width: 16 },
          { header: 'Organization', key: 'orgName', width: 22 },
          { header: 'RERA Number', key: 'reraNumber', width: 18 },
          { header: 'Document Type', key: 'docType', width: 18 },
          { header: 'Document Number', key: 'docNumber', width: 20 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Submitted At', key: 'createdAt', width: 20, type: 'date' },
          { header: 'Reviewed Note', key: 'reviewNote', width: 28 },
        ],
        data: docs.map((d) => ({
          id: d.id,
          name: d.user?.name ?? d.organization?.name ?? '—',
          email: d.user?.email ?? '—',
          phone: d.user?.phone ?? '—',
          role: d.user?.role ?? (d.organization ? 'BROKER_FIRM' : '—'),
          orgName: d.organization?.name ?? '—',
          reraNumber: d.organization?.reraNumber ?? '—',
          docType: d.docType?.replace(/_/g, ' ') ?? '—',
          docNumber: d.docNumber ?? '—',
          status: d.status,
          createdAt: d.createdAt,
          reviewNote: d.reviewNote ?? '—',
        })),
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(buffer);
    }

    if (normalized === 'pdf') {
      const buffer = await renderPdf(
        (doc) => {
          doc.font('B').fontSize(16).fillColor('#0f172a').text('BrokerIQ — KYC Verification Report');
          doc.moveDown(0.3);
          doc.font('R').fontSize(9).fillColor('#64748b');
          const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
          doc.text(`Generated: ${istTime} (IST)   |   Status: ${status || 'ALL'}   |   Total Records: ${docs.length}`);
          doc.moveDown(0.8);

          const headers = ['#', 'Name / Entity', 'Role', 'Document Type', 'Doc Number', 'Status', 'Submitted Date'];
          const weights = [0.8, 3.5, 2.5, 3, 2.8, 2.2, 2.8];
          const rows = docs.map((d, i) => [
            String(i + 1),
            pdfText(d.user?.name ?? d.organization?.name ?? '—'),
            pdfText(d.user?.role ?? (d.organization ? 'BROKER_FIRM' : '—')),
            pdfText(d.docType?.replace(/_/g, ' ') ?? '—'),
            pdfText(d.docNumber ?? '—'),
            pdfText(d.status ?? '—'),
            d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : '—',
          ]);

          pdfTable(doc, headers, rows, weights);

          const verified = docs.filter((d) => d.status === 'VERIFIED').length;
          const pending = docs.filter((d) => d.status === 'PENDING').length;
          const rejected = docs.filter((d) => d.status === 'REJECTED').length;
          doc.moveDown(0.5);
          doc.font('B').fontSize(9).fillColor('#1e293b');
          doc.text(`Summary: Verified: ${verified}   |   Pending: ${pending}   |   Rejected: ${rejected}   |   Total: ${docs.length}`);
        },
        { layout: 'landscape', size: 'A4', margin: 36 },
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(buffer);
    }

    // Default CSV
    const csvContent = generateCsv(
      ['ID', 'Name', 'Email', 'Phone', 'Role', 'Organization', 'RERA', 'Doc Type', 'Doc Number', 'Status', 'Submitted At', 'Review Note'],
      docs.map((d) => [
        d.id,
        d.user?.name ?? d.organization?.name ?? '',
        d.user?.email ?? '',
        d.user?.phone ?? '',
        d.user?.role ?? (d.organization ? 'BROKER_FIRM' : ''),
        d.organization?.name ?? '',
        d.organization?.reraNumber ?? '',
        d.docType,
        d.docNumber ?? '',
        d.status,
        d.createdAt ? new Date(d.createdAt).toISOString() : '',
        (d.reviewNote ?? '').replace(/\s+/g, ' '),
      ]),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csvContent);
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
