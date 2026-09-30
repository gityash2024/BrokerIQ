import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CoBrokeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { AuditService } from '../../core/audit/audit.service';
import { LISTING_CARD_SELECT } from '../listings/listings.service';
import { requireOrg } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';

export interface NetworkQuery {
  q?: string;
  localityIds?: string;
  bedrooms?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
}

const ORG_PUBLIC = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  verification: true,
  rating: true,
  responseMinutes: true,
} satisfies Prisma.OrganizationSelect;
const ORG_CONTACT = { ...ORG_PUBLIC, phone: true, whatsapp: true, email: true } satisfies Prisma.OrganizationSelect;

/**
 * Co-broking network: firms mark listings as open to co-broking; other BrokerIQ brokers can
 * request to work them for their clients at an agreed commission split. Contacts are exchanged
 * only after the listing firm accepts. The landlord's own number is never shared.
 */
@Injectable()
export class CoBrokingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async network(user: RequestUser, q: NetworkQuery) {
    const orgId = requireOrg(user);
    const page = Math.max(1, Number(q.page) || 1);
    const take = 24;
    const bedrooms = (q.bedrooms ?? '')
      .split(',')
      .map(Number)
      .filter((n) => n > 0);
    const where: Prisma.ListingWhereInput = {
      coBroking: true,
      status: 'ACTIVE',
      deletedAt: null,
      organizationId: { not: orgId },
      ...(q.localityIds ? { localityId: { in: q.localityIds.split(',').filter(Boolean) } } : {}),
      ...(bedrooms.length ? { bedrooms: { in: bedrooms } } : {}),
      ...(q.minPrice || q.maxPrice
        ? { price: { ...(q.minPrice ? { gte: Number(q.minPrice) } : {}), ...(q.maxPrice ? { lte: Number(q.maxPrice) } : {}) } }
        : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { societyName: { contains: q.q, mode: 'insensitive' } },
              { locality: { name: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: [{ rankBoost: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * take,
        take,
        select: { ...LISTING_CARD_SELECT, coBrokingSharePct: true },
      }),
      this.prisma.listing.count({ where }),
    ]);
    const mine = await this.prisma.coBrokeRequest.findMany({
      where: { requesterOrgId: orgId, listingId: { in: items.map((i) => i.id) } },
      select: { listingId: true, status: true, id: true },
    });
    return { items: items.map((l) => ({ ...l, myRequest: mine.find((m) => m.listingId === l.id) ?? null })), total, page, pageSize: take };
  }

  async request(user: RequestUser, body: { listingId: string; leadId?: string | null; sharePct?: number | null; message?: string | null }) {
    const orgId = requireOrg(user);
    const listing = await this.prisma.listing.findFirst({
      where: { id: body.listingId, deletedAt: null },
      select: { id: true, title: true, coBroking: true, coBrokingSharePct: true, status: true, organizationId: true },
    });
    if (!listing?.organizationId) throw new NotFoundException('Listing नहीं मिली');
    if (listing.organizationId === orgId) throw new BadRequestException('यह आपकी अपनी listing है');
    if (!listing.coBroking || listing.status !== 'ACTIVE') throw new BadRequestException('यह listing अभी co-broking के लिए खुली नहीं है');
    if (body.leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { id: body.leadId, organizationId: orgId }, select: { id: true } });
      if (!lead) throw new BadRequestException('Lead नहीं मिली');
    }
    const sharePct = body.sharePct ?? listing.coBrokingSharePct ?? 50;
    const existing = await this.prisma.coBrokeRequest.findUnique({ where: { listingId_requesterOrgId: { listingId: listing.id, requesterOrgId: orgId } } });
    if (existing && ['PENDING', 'ACCEPTED'].includes(existing.status)) return existing;
    const data = {
      requesterUserId: user.id,
      leadId: body.leadId ?? null,
      sharePct,
      message: body.message ?? null,
      status: 'PENDING' as CoBrokeStatus,
      respondedAt: null,
      respondedById: null,
    };
    const req = existing
      ? await this.prisma.coBrokeRequest.update({ where: { id: existing.id }, data })
      : await this.prisma.coBrokeRequest.create({ data: { ...data, listingId: listing.id, ownerOrgId: listing.organizationId, requesterOrgId: orgId } });
    const requester = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    await this.notifications.notifyOrg(
      listing.organizationId,
      {
        kind: 'COBROKE_REQUEST',
        title: `🤝 Co-broke request: ${requester?.name ?? 'Broker'}`,
        body: `${listing.title} — ${sharePct}% share`,
        link: '/broker/network?tab=incoming',
      },
      { adminsOnly: true },
    );
    if (req.leadId) await this.leadNote(orgId, req.leadId, user.id, `Co-broke request भेजी: ${listing.title} (${sharePct}% share)`);
    await this.audit.log(user, 'cobroke.request', 'CoBrokeRequest', req.id, { listingId: listing.id });
    return req;
  }

  async list(user: RequestUser, box: 'incoming' | 'outgoing') {
    const orgId = requireOrg(user);
    const rows = await this.prisma.coBrokeRequest.findMany({
      where: box === 'incoming' ? { ownerOrgId: orgId } : { requesterOrgId: orgId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
      include: {
        listing: { select: { id: true, slug: true, title: true, price: true, coverUrl: true, bedrooms: true, locality: { select: { name: true } } } },
        ownerOrg: { select: ORG_CONTACT },
        requester: { select: ORG_CONTACT },
        lead: { select: { id: true, name: true } },
      },
    });
    // Phone / WhatsApp of the other firm only after acceptance.
    const strip = (o: any) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      logoUrl: o.logoUrl,
      verification: o.verification,
      rating: o.rating,
      responseMinutes: o.responseMinutes,
    });
    return rows.map((r) => {
      const open = r.status === 'ACCEPTED' || r.status === 'CLOSED';
      return {
        ...r,
        ownerOrg: open ? r.ownerOrg : strip(r.ownerOrg),
        requester: open ? r.requester : strip(r.requester),
        lead: box === 'outgoing' ? r.lead : null,
      };
    });
  }

  async respond(user: RequestUser, id: string, action: 'accept' | 'reject' | 'cancel' | 'close') {
    const orgId = requireOrg(user);
    const r = await this.prisma.coBrokeRequest.findUnique({ where: { id }, include: { listing: { select: { title: true } } } });
    if (!r) throw new NotFoundException();
    const isOwner = r.ownerOrgId === orgId;
    const isRequester = r.requesterOrgId === orgId;
    if (!isOwner && !isRequester) throw new ForbiddenException();
    const next: Record<string, { status: CoBrokeStatus; allowed: boolean; from: CoBrokeStatus[] }> = {
      accept: { status: 'ACCEPTED', allowed: isOwner, from: ['PENDING'] },
      reject: { status: 'REJECTED', allowed: isOwner, from: ['PENDING', 'ACCEPTED'] },
      cancel: { status: 'CANCELLED', allowed: isRequester, from: ['PENDING', 'ACCEPTED'] },
      close: { status: 'CLOSED', allowed: isOwner || isRequester, from: ['ACCEPTED'] },
    };
    const step = next[action];
    if (!step?.allowed) throw new ForbiddenException('यह action आप नहीं कर सकते');
    if (!step.from.includes(r.status)) throw new BadRequestException('Request इस stage में नहीं है');
    const updated = await this.prisma.coBrokeRequest.update({ where: { id }, data: { status: step.status, respondedAt: new Date(), respondedById: user.id } });
    const actor = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    const otherOrg = isOwner ? r.requesterOrgId : r.ownerOrgId;
    const titles: Record<string, string> = {
      accept: '✅ Co-broke request accept हुई',
      reject: 'Co-broke request मना हुई',
      cancel: 'Co-broke request वापस ली गई',
      close: 'Co-broke deal बंद',
    };
    await this.notifications.notifyOrg(
      otherOrg,
      {
        kind: 'COBROKE_UPDATE',
        title: titles[action],
        body: `${r.listing.title} · ${actor?.name ?? ''}`,
        link: `/broker/network?tab=${isOwner ? 'outgoing' : 'incoming'}`,
      },
      { adminsOnly: false },
    );
    if (r.leadId && action === 'accept')
      await this.leadNote(
        r.requesterOrgId,
        r.leadId,
        null,
        `${actor?.name ?? 'Listing firm'} ने co-broke accept किया: ${r.listing.title} (${r.sharePct}% share)`,
      );
    await this.audit.log(user, `cobroke.${action}`, 'CoBrokeRequest', id);
    return updated;
  }

  private async leadNote(orgId: string, leadId: string, userId: string | null, content: string) {
    await this.prisma.activity.create({ data: { organizationId: orgId, leadId, userId, type: 'NOTE', content } }).catch(() => undefined);
  }
}
