import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { AuditService } from '../../core/audit/audit.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { EventsService } from '../../core/events/events.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { paged } from '../../common/utils';
import { env } from '../../config/env';

const moderateSchema = z.object({ action: z.enum(['approve', 'reject']), reason: z.string().max(500).optional() });
const listingFlagsSchema = z.object({
  isFeatured: z.boolean().optional(),
  featuredDays: z.number().int().min(1).max(365).optional(),
  isVerified: z.boolean().optional(),
});

/** Listing moderation queue, featured/verified flags, all-listings search and reported listings. */
@ApiTags('admin')
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminListingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly events: EventsService,
  ) {}

  // ------------------------------------------------------------------ moderation
  @Roles('SUPER_ADMIN', 'MODERATOR')
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

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Post('moderation/listings/:id')
  async moderate(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(moderateSchema)) body: z.infer<typeof moderateSchema>) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l) throw new NotFoundException();
    const app = await this.settings.getAppConfig();
    const approve = body.action === 'approve';
    if (!approve && !body.reason) throw new BadRequestException('Reject का कारण लिखें');
    const updated = await this.prisma.listing.update({
      where: { id },
      data: approve
        ? {
            status: 'ACTIVE',
            rejectionReason: null,
            moderationFlags: [],
            publishedAt: l.publishedAt ?? new Date(),
            expiresAt: new Date(Date.now() + app.listing.expiryDays * 86400_000),
          }
        : { status: 'REJECTED', rejectionReason: body.reason },
    });
    const link = approve
      ? `${env().PUBLIC_WEB_URL}/property/${l.slug}`
      : `${env().PUBLIC_WEB_URL}${l.organizationId ? '/broker/listings' : '/account/listings'}`;
    await this.notifications.notify(l.postedById, {
      kind: approve ? 'LISTING_APPROVED' : 'LISTING_REJECTED',
      title: approve ? '🎉 आपकी listing live है' : 'Listing में बदलाव ज़रूरी',
      body: approve ? l.title : `${l.title}: ${body.reason}`,
      link: approve ? `/property/${l.slug}` : l.organizationId ? '/broker/listings' : '/account/listings',
    });
    const poster = await this.prisma.user.findUnique({ where: { id: l.postedById } });
    if (poster)
      this.mail
        .trySendTemplate(approve ? 'listing.approved' : 'listing.rejected', poster.email, { listing: l, reason: body.reason, link })
        .catch(() => undefined);
    if (approve && l.status !== 'ACTIVE') this.events.emit('listing.published', { listingId: id });
    await this.audit.log(user, `listing.${body.action}`, 'Listing', id, { reason: body.reason });
    return updated;
  }

  @Patch('listings/:id/flags')
  async listingFlags(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(listingFlagsSchema)) body: z.infer<typeof listingFlagsSchema>,
  ) {
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

  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
  @Get('listings')
  async allListings(@Query() q: { q?: string; status?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    // status=DELETED lists soft-deleted listings (restorable).
    const where: Prisma.ListingWhereInput = {
      deletedAt: q.status === 'DELETED' ? { not: null } : null,
      ...(q.status && q.status !== 'DELETED' ? { status: q.status as any } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { slug: { contains: q.q } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 30,
        take: 30,
        include: { locality: { select: { name: true } }, organization: { select: { name: true } }, postedBy: { select: { name: true, email: true } } },
      }),
      this.prisma.listing.count({ where }),
    ]);
    return paged(items, total, page, 30);
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Get('reports')
  reports(@Query('status') status = 'OPEN') {
    return this.prisma.listingReport.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { listing: { select: { id: true, title: true, slug: true, status: true } }, user: { select: { name: true, email: true } } },
    });
  }

  @Roles('SUPER_ADMIN', 'MODERATOR')
  @Patch('reports/:id')
  async resolveReport(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(
      new ZodPipe(z.object({ status: z.enum(['RESOLVED', 'DISMISSED']), resolution: z.string().max(500).optional(), archiveListing: z.boolean().optional() })),
    )
    body: any,
  ) {
    const r = await this.prisma.listingReport.update({ where: { id }, data: { status: body.status, resolution: body.resolution, resolvedAt: new Date() } });
    if (body.archiveListing) await this.prisma.listing.update({ where: { id: r.listingId }, data: { status: 'ARCHIVED' } });
    await this.audit.log(user, 'report.resolve', 'ListingReport', id, body);
    return r;
  }
}
