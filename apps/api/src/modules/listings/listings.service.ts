import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Listing } from '@prisma/client';
import {
  PROPERTY_TYPE_CATEGORY,
  PROPERTY_TYPE_LABELS,
  RENTAL_ONLY,
  maskPhone,
  normalizeIndianPhone,
  pricePerSqft,
  slugify,
  type ListingInput,
  type ListingSearchInput,
  commuteRadiusKm,
  estimateCommute,
  officeHub,
  type OfficeHub,
} from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { UsageService } from '../../core/usage/usage.service';
import { EventsService } from '../../core/events/events.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { AuditService } from '../../core/audit/audit.service';
import { paged, shortCode } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';
import { FeaturesService } from '../../core/features/features.service';

export const LISTING_CARD_SELECT = {
  id: true,
  refNo: true,
  slug: true,
  purpose: true,
  category: true,
  propertyType: true,
  status: true,
  title: true,
  price: true,
  pricePerSqft: true,
  maintenance: true,
  priceNegotiable: true,
  bedrooms: true,
  bathrooms: true,
  carpetArea: true,
  builtUpArea: true,
  superArea: true,
  plotArea: true,
  furnishing: true,
  brokerageType: true,
  brokerageAmount: true,
  securityDeposit: true,
  possession: true,
  floor: true,
  totalFloors: true,
  societyName: true,
  latitude: true,
  longitude: true,
  coverUrl: true,
  postedByType: true,
  isVerified: true,
  isFeatured: true,
  coBroking: true,
  visitVerifiedAt: true,
  tokenReceivedAt: true,
  views: true,
  enquiryCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  locality: { select: { id: true, name: true, slug: true, zone: true } },
  project: { select: { id: true, name: true, slug: true } },
  organization: { select: { id: true, name: true, slug: true, logoUrl: true, verification: true, rating: true, responseMinutes: true } },
  _count: { select: { media: true } },
} satisfies Prisma.ListingSelect;

const CONTENT_FIELDS: (keyof ListingInput)[] = ['title', 'description', 'photos', 'videoUrl', 'floorPlanUrl', 'propertyType', 'localityId', 'purpose'];

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly usage: UsageService,
    private readonly events: EventsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly features: FeaturesService,
  ) {}

  /** Tell every Super Admin that a listing is waiting for approval. */
  async notifyReviewers(listing: { id: string; title: string }) {
    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    await this.notifications
      .notify(admins.map((a) => a.id), { kind: 'MODERATION', title: 'नई listing approval के लिए', body: listing.title, link: '/admin/moderation', data: { listingId: listing.id } })
      .catch(() => undefined);
  }

  // ------------------------------------------------------------------ search
  buildWhere(f: Partial<ListingSearchInput>, opts: { publicOnly?: boolean } = { publicOnly: true }): Prisma.ListingWhereInput {
    const and: Prisma.ListingWhereInput[] = [{ deletedAt: null }];
    if (opts.publicOnly) and.push({ status: 'ACTIVE' });
    // Rental marketplace: public search only ever shows rent listings (legacy sale listings stay hidden).
    if (opts.publicOnly && RENTAL_ONLY) and.push({ purpose: 'RENT' });
    else if (f.purpose) and.push({ purpose: f.purpose });
    if (f.category) and.push({ category: f.category });
    const types = csv(f.types);
    if (types.length) and.push({ propertyType: { in: types as any } });
    const locs = csv(f.localities);
    if (locs.length) and.push({ locality: { slug: { in: locs } } });
    if (f.projectId) and.push({ projectId: f.projectId });
    if (f.orgId) and.push({ organizationId: f.orgId });
    if (f.minPrice != null) and.push({ price: { gte: f.minPrice } });
    if (f.maxPrice != null) and.push({ price: { lte: f.maxPrice } });
    const beds = csv(f.bedrooms);
    if (beds.length) {
      const exact = beds.filter((b) => !b.endsWith('+')).map(Number).filter(Number.isFinite);
      const plus = beds.filter((b) => b.endsWith('+')).map((b) => Number(b.slice(0, -1)));
      const or: Prisma.ListingWhereInput[] = [];
      if (exact.length) or.push({ bedrooms: { in: exact } });
      if (plus.length) or.push({ bedrooms: { gte: Math.min(...plus) } });
      and.push({ OR: or });
    }
    const furn = csv(f.furnishing);
    if (furn.length) and.push({ furnishing: { in: furn as any } });
    if (f.possession) and.push({ possession: f.possession });
    if (f.postedBy) and.push({ postedByType: f.postedBy });
    if (f.verified) and.push({ isVerified: true });
    if (f.visitVerified) and.push({ visitVerifiedAt: { not: null } });
    if (f.preferredTenant) and.push({ preferredTenants: { has: f.preferredTenant } });
    // PG gender: "ANY" listings suit everyone; a food preference also matches "BOTH".
    if (f.pgGender && f.pgGender !== 'ANY') and.push({ OR: [{ pgGender: f.pgGender }, { pgGender: 'ANY' }, { pgGender: null }] });
    if (f.pgFood) and.push({ pgFood: { in: [f.pgFood, 'BOTH'] } });
    if (f.minArea != null || f.maxArea != null) {
      const range = { ...(f.minArea != null ? { gte: f.minArea } : {}), ...(f.maxArea != null ? { lte: f.maxArea } : {}) };
      and.push({ OR: [{ carpetArea: range }, { superArea: range }, { builtUpArea: range }, { plotArea: range }] });
    }
    const amen = csv(f.amenities);
    if (amen.length) and.push({ amenities: { hasEvery: amen } });
    if (f.bbox) {
      const [minLng, minLat, maxLng, maxLat] = f.bbox.split(',').map(Number);
      if ([minLng, minLat, maxLng, maxLat].every(Number.isFinite)) and.push({ latitude: { gte: minLat, lte: maxLat }, longitude: { gte: minLng, lte: maxLng } });
    }
    if (f.q) {
      const q = f.q.trim();
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { societyName: { contains: q, mode: 'insensitive' } },
          { locality: { name: { contains: q, mode: 'insensitive' } } },
          { project: { name: { contains: q, mode: 'insensitive' } } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    return { AND: and };
  }

  orderBy(sort: ListingSearchInput['sort']): Prisma.ListingOrderByWithRelationInput[] {
    switch (sort) {
      case 'newest':
        return [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
      case 'price_asc':
        return [{ price: 'asc' }];
      case 'price_desc':
        return [{ price: 'desc' }];
      case 'area_desc':
        return [{ superArea: { sort: 'desc', nulls: 'last' } }, { carpetArea: { sort: 'desc', nulls: 'last' } }];
      case 'psf_asc':
        return [{ pricePerSqft: { sort: 'asc', nulls: 'last' } }];
      default:
        // Relevance: paid boost → verified → broker quality (rating + response speed) → newest.
        return [{ isFeatured: 'desc' }, { isVerified: 'desc' }, { rankBoost: 'desc' }, { publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
    }
  }

  async search(f: ListingSearchInput) {
    await this.expireFeatured();
    const hub = officeHub(f.officeHub);
    if (hub && (await this.features.isEnabled('commute'))) return this.searchByCommute(f, hub);
    const where = this.buildWhere(f);
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({ where, orderBy: this.orderBy(f.sort), skip: (f.page - 1) * f.pageSize, take: f.pageSize, select: LISTING_CARD_SELECT }),
      this.prisma.listing.count({ where }),
    ]);
    return paged(items, total, f.page, f.pageSize);
  }

  /**
   * "Office के पास": pre-filter by a radius around the hub, estimate each listing's commute (listing pin,
   * else locality centre), keep those within maxCommute, sort by time (or the chosen sort) and paginate.
   */
  private async searchByCommute(f: ListingSearchInput, hub: OfficeHub) {
    const max = f.maxCommute ?? 45;
    const r = commuteRadiusKm(max);
    const dLat = r / 111;
    const dLng = r / (111 * Math.cos((hub.lat * Math.PI) / 180));
    const near: Prisma.ListingWhereInput = {
      OR: [
        { latitude: { gte: hub.lat - dLat, lte: hub.lat + dLat }, longitude: { gte: hub.lng - dLng, lte: hub.lng + dLng } },
        { latitude: null, locality: { latitude: { gte: hub.lat - dLat, lte: hub.lat + dLat }, longitude: { gte: hub.lng - dLng, lte: hub.lng + dLng } } },
      ],
    };
    const rows = await this.prisma.listing.findMany({
      where: { AND: [this.buildWhere({ ...f, bbox: undefined }), near] },
      orderBy: this.orderBy(f.sort === 'commute' ? 'relevance' : f.sort),
      take: 1500,
      select: { ...LISTING_CARD_SELECT, locality: { select: { id: true, name: true, slug: true, zone: true, latitude: true, longitude: true } } },
    });
    const scored = rows
      .map((l) => {
        const from = l.latitude != null && l.longitude != null ? { lat: l.latitude, lng: l.longitude } : { lat: l.locality.latitude, lng: l.locality.longitude };
        const c = estimateCommute(from, hub);
        return { ...l, commute: { hub: hub.name, minutes: c.bestMin, mode: c.mode, carMin: c.carMin, metroMin: c.metroMin } };
      })
      .filter((l) => l.commute.minutes <= max);
    if (f.sort === 'commute') scored.sort((a, b) => a.commute.minutes - b.commute.minutes);
    const items = scored.slice((f.page - 1) * f.pageSize, f.page * f.pageSize);
    return paged(items, scored.length, f.page, f.pageSize);
  }

  async mapPoints(f: ListingSearchInput) {
    const where = { AND: [this.buildWhere({ ...f, bbox: f.bbox }), { latitude: { not: null } }, { longitude: { not: null } }] };
    return this.prisma.listing.findMany({
      where,
      take: 600,
      orderBy: this.orderBy(f.sort),
      select: { id: true, slug: true, price: true, purpose: true, propertyType: true, bedrooms: true, latitude: true, longitude: true, title: true, coverUrl: true },
    });
  }

  /** Scam protection: enough distinct pending reports send a live listing back to admin review. */
  async autoHideIfReported(listingId: string) {
    const app = await this.settings.getAppConfig();
    const threshold = app.listing.autoHideReports ?? 3;
    if (!threshold) return false;
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, status: true, title: true, moderationFlags: true } });
    if (!listing || listing.status !== 'ACTIVE') return false;
    const reports = await this.prisma.listingReport.findMany({ where: { listingId, status: 'OPEN' }, select: { userId: true } });
    // Logged-in reporters count individually; all anonymous reports together count once (limits abuse).
    const reporters = new Set(reports.map((r) => r.userId ?? 'anon'));
    if (reporters.size < threshold) return false;
    await this.prisma.listing.update({ where: { id: listingId }, data: { status: 'PENDING_REVIEW', moderationFlags: [...new Set([...listing.moderationFlags, 'REPORTED'])] } });
    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await this.notifications.notify(admins.map((a) => a.id), { kind: 'LISTING_REPORTED', title: `🚩 ${reporters.size} reports — listing review में भेजी`, body: listing.title, link: '/admin/moderation' });
    return true;
  }

  private lastFeaturedCheck = 0;
  private async expireFeatured() {
    if (Date.now() - this.lastFeaturedCheck < 60_000) return;
    this.lastFeaturedCheck = Date.now();
    await this.prisma.listing.updateMany({ where: { isFeatured: true, featuredUntil: { lt: new Date() } }, data: { isFeatured: false } });
  }

  // ------------------------------------------------------------------ detail
  private canManage(listing: Pick<Listing, 'postedById' | 'organizationId'>, user?: RequestUser) {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    if (listing.postedById === user.id) return true;
    return !!listing.organizationId && listing.organizationId === user.orgId && user.role === 'BROKER_ADMIN';
  }

  private canEdit(listing: Pick<Listing, 'postedById' | 'organizationId'>, user?: RequestUser) {
    if (this.canManage(listing, user)) return true;
    return !!user && !!listing.organizationId && listing.organizationId === user.orgId;
  }

  async detail(slugOrId: string, user?: RequestUser, track = true) {
    const listing = await this.prisma.listing.findFirst({
      where: { OR: [{ slug: slugOrId }, { id: slugOrId }], deletedAt: null },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        locality: true,
        project: { include: { builder: { select: { name: true, slug: true } } } },
        organization: { select: { id: true, name: true, slug: true, logoUrl: true, verification: true, rating: true, reviewCount: true, phone: true, whatsapp: true, experienceYears: true, reraNumber: true } },
        postedBy: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
      },
    });
    if (!listing) throw new NotFoundException('Property नहीं मिली');
    const manage = this.canEdit(listing, user);
    if (listing.status !== 'ACTIVE' && !manage && !['SOLD', 'RENTED'].includes(listing.status)) throw new NotFoundException('Property नहीं मिली');
    // Legacy sale listings stay visible to their owners/admins only.
    if (RENTAL_ONLY && listing.purpose === 'SALE' && !manage && user?.role !== 'SUPER_ADMIN') throw new NotFoundException('Property नहीं मिली');

    if (!manage && track) {
      await this.prisma.listing.update({ where: { id: listing.id }, data: { views: { increment: 1 } } });
      if (user) {
        await this.prisma.recentView.upsert({ where: { userId_listingId: { userId: user.id, listingId: listing.id } }, create: { userId: user.id, listingId: listing.id }, update: { viewedAt: new Date() } });
      }
    }
    const saved = user ? !!(await this.prisma.savedListing.findUnique({ where: { userId_listingId: { userId: user.id, listingId: listing.id } } })) : false;
    const localityStats = await this.localityPsf(listing.localityId, listing.purpose, listing.category);
    const phone = listing.contactPhone ?? listing.organization?.phone ?? null;
    return {
      ...listing,
      contactPhone: manage ? phone : maskPhone(phone),
      organization: listing.organization ? { ...listing.organization, phone: manage ? listing.organization.phone : maskPhone(listing.organization.phone), whatsapp: undefined } : null,
      canManage: manage,
      saved,
      localityAvgPsf: localityStats,
    };
  }

  async localityPsf(localityId: string, purpose: 'SALE' | 'RENT', category: string) {
    const agg = await this.prisma.listing.aggregate({
      where: { localityId, purpose, category: category as any, status: 'ACTIVE', pricePerSqft: { not: null } },
      _avg: { pricePerSqft: true },
      _count: true,
    });
    return agg._count >= 3 ? Math.round(agg._avg.pricePerSqft ?? 0) : null;
  }

  async similar(id: string) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l) throw new NotFoundException();
    return this.prisma.listing.findMany({
      where: {
        id: { not: l.id },
        status: 'ACTIVE',
        deletedAt: null,
        purpose: l.purpose,
        category: l.category,
        OR: [{ localityId: l.localityId }, { bedrooms: l.bedrooms ?? undefined, price: { gte: l.price * 0.75, lte: l.price * 1.25 } }],
      },
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
      take: 8,
      select: LISTING_CARD_SELECT,
    });
  }

  /** Reveals the real contact number (and records it as an enquiry signal). */
  async revealContact(id: string, user?: RequestUser) {
    const app = await this.settings.getAppConfig();
    if (app.listing.contactRevealRequiresLogin && !user) throw new ForbiddenException('Number देखने के लिए login करें');
    const l = await this.prisma.listing.findFirst({ where: { id, status: 'ACTIVE', deletedAt: null }, include: { organization: true, postedBy: true } });
    if (!l) throw new NotFoundException();
    // Firms using Exotel show their tracked ExoPhone: calls are recorded as leads and routed to an agent.
    const exotel = l.organizationId ? await this.settings.resolve('exotel', l.organizationId).catch(() => null) : null;
    if (exotel?.exoPhone) return { name: l.organization?.name ?? l.contactName ?? l.postedBy.name, phone: String(exotel.exoPhone), whatsapp: l.organization?.whatsapp ?? l.organization?.phone ?? null, tracked: true };
    const phone = l.contactPhone ?? l.organization?.phone ?? l.postedBy.phone;
    const whatsapp = l.organization?.whatsapp ?? phone;
    return { name: l.contactName ?? l.organization?.name ?? l.postedBy.name, phone, whatsapp };
  }

  // ------------------------------------------------------------------ write
  private autoTitle(input: ListingInput, localityName: string) {
    const typeLabel = PROPERTY_TYPE_LABELS[input.propertyType];
    const bhk = input.bedrooms && PROPERTY_TYPE_CATEGORY[input.propertyType] === 'RESIDENTIAL' && input.propertyType !== 'PG' ? `${input.bedrooms} BHK ` : '';
    return `${bhk}${typeLabel} for Rent in ${localityName}, Gurgaon`;
  }

  private area(input: Partial<ListingInput>) {
    return input.carpetArea ?? input.builtUpArea ?? input.superArea ?? input.plotArea ?? null;
  }

  private moderationFlags(input: Partial<ListingInput>, localityAvgPsf: number | null): string[] {
    const flags: string[] = [];
    const text = `${input.title ?? ''} ${input.description ?? ''}`;
    if (/(\+?91[\s-]?)?[6-9]\d{9}/.test(text.replace(/\s/g, ''))) flags.push('PHONE_IN_TEXT');
    if (/https?:\/\//i.test(text)) flags.push('LINK_IN_TEXT');
    if (!input.photos?.length) flags.push('NO_PHOTOS');
    const psf = pricePerSqft(input.price ?? null, this.area(input));
    if (psf && localityAvgPsf && (psf < localityAvgPsf * 0.4 || psf > localityAvgPsf * 2.5)) flags.push('PRICE_OUTLIER');
    return flags;
  }

  private toData(input: Partial<ListingInput>) {
    const { photos, submit, possessionDate, availableFrom, contactPhone, ...rest } = input as ListingInput;
    void photos;
    void submit;
    return {
      ...rest,
      videoUrl: rest.videoUrl || null,
      floorPlanUrl: rest.floorPlanUrl || null,
      possessionDate: possessionDate ? new Date(possessionDate) : possessionDate === null ? null : undefined,
      availableFrom: availableFrom ? new Date(availableFrom) : availableFrom === null ? null : undefined,
      contactPhone: contactPhone ? normalizeIndianPhone(contactPhone) ?? contactPhone : contactPhone,
    };
  }

  private async uniqueSlug(title: string) {
    const base = slugify(title).slice(0, 70);
    return `${base}-${shortCode(6).toLowerCase()}`;
  }

  async create(input: ListingInput, user: RequestUser) {
    const locality = await this.prisma.locality.findUnique({ where: { id: input.localityId } });
    if (!locality) throw new BadRequestException('Locality select करें');
    const isBroker = user.role === 'BROKER_ADMIN' || user.role === 'BROKER_AGENT';
    if (isBroker && user.orgId) {
      const active = await this.prisma.listing.count({ where: { organizationId: user.orgId, status: { in: ['ACTIVE', 'PENDING_REVIEW'] }, deletedAt: null } });
      if (input.submit) await this.usage.assert(user.orgId, 'activeListings', active);
    }
    const app = await this.settings.getAppConfig();
    if (input.photos.length > app.listing.maxPhotos) throw new BadRequestException(`ज़्यादा से ज़्यादा ${app.listing.maxPhotos} photos`);
    const title = input.title?.trim() || this.autoTitle(input, locality.name);
    const flags = this.moderationFlags({ ...input, title }, await this.localityPsf(locality.id, input.purpose, PROPERTY_TYPE_CATEGORY[input.propertyType]));
    // Every listing goes live only after Super Admin approval (the approver's own listings are live at once).
    const autoApprove = user.role === 'SUPER_ADMIN';
    const status = !input.submit ? 'DRAFT' : autoApprove ? 'ACTIVE' : 'PENDING_REVIEW';

    const listing = await this.prisma.listing.create({
      data: {
        ...this.toData(input),
        title,
        slug: await this.uniqueSlug(title),
        category: PROPERTY_TYPE_CATEGORY[input.propertyType],
        pricePerSqft: pricePerSqft(input.price, this.area(input)),
        latitude: input.latitude ?? locality.latitude,
        longitude: input.longitude ?? locality.longitude,
        coverUrl: (input.photos.find((p) => p.kind !== 'PANORAMA') ?? input.photos[0])?.url ?? null,
        status,
        moderationFlags: flags,
        postedByType: user.role === 'SUPER_ADMIN' ? 'BUILDER' : isBroker ? 'BROKER' : 'OWNER',
        postedById: user.id,
        organizationId: isBroker ? user.orgId : null,
        publishedAt: status === 'ACTIVE' ? new Date() : null,
        expiresAt: status === 'ACTIVE' ? new Date(Date.now() + app.listing.expiryDays * 86400_000) : null,
        media: { create: input.photos.map((p, i) => ({ url: p.url, caption: p.caption, publicId: p.publicId, sortOrder: i, kind: p.kind ?? 'PHOTO' })) },
      } as Prisma.ListingUncheckedCreateInput,
    });
    if (status === 'ACTIVE') this.events.emit('listing.published', { listingId: listing.id });
    if (status === 'PENDING_REVIEW') await this.notifyReviewers(listing);
    await this.audit.log(user, 'listing.create', 'Listing', listing.id, { status });
    return listing;
  }

  async update(id: string, input: Partial<ListingInput>, user: RequestUser) {
    const existing = await this.prisma.listing.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException();
    if (!this.canEdit(existing, user)) throw new ForbiddenException();
    const app = await this.settings.getAppConfig();
    const contentChanged = CONTENT_FIELDS.some((k) => input[k] !== undefined);
    const isAdmin = user.role === 'SUPER_ADMIN';
    let status = existing.status;
    if (input.submit && existing.status === 'DRAFT') status = isAdmin ? 'ACTIVE' : 'PENDING_REVIEW';
    else if (existing.status === 'REJECTED' && input.submit !== false) status = 'PENDING_REVIEW';
    else if (existing.status === 'ACTIVE' && contentChanged && !isAdmin) status = 'PENDING_REVIEW';

    const merged = { ...existing, ...input } as any;
    const data: any = {
      ...this.toData(input),
      status,
      pricePerSqft: pricePerSqft(merged.price, this.area(merged)),
      rejectionReason: status === 'PENDING_REVIEW' ? null : existing.rejectionReason,
    };
    if (input.localityId) {
      const loc = await this.prisma.locality.findUnique({ where: { id: input.localityId } });
      if (!loc) throw new BadRequestException('Invalid locality');
    }
    if (input.propertyType) data.category = PROPERTY_TYPE_CATEGORY[input.propertyType];
    if (status === 'ACTIVE' && !existing.publishedAt) {
      data.publishedAt = new Date();
      data.expiresAt = new Date(Date.now() + app.listing.expiryDays * 86400_000);
    }
    return this.prisma.$transaction(async (tx) => {
      if (input.photos) {
        await tx.listingMedia.deleteMany({ where: { listingId: id } });
        await tx.listingMedia.createMany({ data: input.photos.map((p, i) => ({ listingId: id, url: p.url, caption: p.caption, publicId: p.publicId, sortOrder: i, kind: p.kind ?? 'PHOTO' })) });
        data.coverUrl = (input.photos.find((p) => p.kind !== 'PANORAMA') ?? input.photos[0])?.url ?? null;
      }
      const updated = await tx.listing.update({ where: { id }, data });
      if (status === 'ACTIVE' && existing.status !== 'ACTIVE') this.events.emit('listing.published', { listingId: id });
      return updated;
    }).then(async (updated) => {
      if (status === 'PENDING_REVIEW' && existing.status !== 'PENDING_REVIEW') await this.notifyReviewers(updated);
      return updated;
    });
  }

  async setStatus(id: string, status: 'SOLD' | 'RENTED' | 'ARCHIVED' | 'ACTIVE', user: RequestUser) {
    const existing = await this.prisma.listing.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException();
    if (!this.canEdit(existing, user)) throw new ForbiddenException();
    const app = await this.settings.getAppConfig();
    let next: any = status;
    const data: any = {};
    if (status === 'ACTIVE') {
      if (existing.organizationId && ['ARCHIVED', 'EXPIRED', 'SOLD', 'RENTED'].includes(existing.status)) {
        const active = await this.prisma.listing.count({ where: { organizationId: existing.organizationId, status: { in: ['ACTIVE', 'PENDING_REVIEW'] }, deletedAt: null } });
        await this.usage.assert(existing.organizationId, 'activeListings', active);
      }
      // Re-activating (after archive/rented/rejection) always goes back through admin review.
      next = user.role === 'SUPER_ADMIN' ? 'ACTIVE' : existing.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_REVIEW';
      if (next === 'ACTIVE') data.expiresAt = new Date(Date.now() + app.listing.expiryDays * 86400_000);
    }
    const updated = await this.prisma.listing.update({ where: { id }, data: { ...data, status: next } });
    if (next === 'PENDING_REVIEW' && existing.status !== 'PENDING_REVIEW') await this.notifyReviewers(updated);
    return updated;
  }

  async remove(id: string, user: RequestUser) {
    const existing = await this.prisma.listing.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException();
    if (!this.canManage(existing, user)) throw new ForbiddenException();
    await this.prisma.listing.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    await this.audit.log(user, 'listing.delete', 'Listing', id);
    return { ok: true };
  }

  async mine(user: RequestUser, q: { status?: string; page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Number(q.pageSize) || 20);
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      ...(user.orgId ? { organizationId: user.orgId } : { postedById: user.id }),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.search ? { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { societyName: { contains: q.search, mode: 'insensitive' } }] } : {}),
    };
    const [items, total, counts] = await Promise.all([
      this.prisma.listing.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: { ...LISTING_CARD_SELECT, rejectionReason: true, moderationFlags: true, expiresAt: true, shortlistCount: true } }),
      this.prisma.listing.count({ where }),
      this.prisma.listing.groupBy({ by: ['status'], where: { deletedAt: null, ...(user.orgId ? { organizationId: user.orgId } : { postedById: user.id }) }, _count: { _all: true } }),
    ]);
    return { ...paged(items, total, page, pageSize), statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
  }

  // ------------------------------------------------------------------ saved / recent
  async toggleSave(listingId: string, userId: string, save: boolean) {
    const exists = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } });
    if (!exists) throw new NotFoundException();
    if (save) {
      const created = await this.prisma.savedListing.upsert({ where: { userId_listingId: { userId, listingId } }, create: { userId, listingId }, update: {} });
      await this.prisma.listing.update({ where: { id: listingId }, data: { shortlistCount: { increment: 1 } } }).catch(() => undefined);
      return { saved: true, at: created.createdAt };
    }
    const del = await this.prisma.savedListing.deleteMany({ where: { userId, listingId } });
    if (del.count) await this.prisma.listing.update({ where: { id: listingId }, data: { shortlistCount: { decrement: 1 } } }).catch(() => undefined);
    return { saved: false };
  }

  async saved(userId: string) {
    const rows = await this.prisma.savedListing.findMany({ where: { userId, listing: { deletedAt: null } }, orderBy: { createdAt: 'desc' }, include: { listing: { select: LISTING_CARD_SELECT } } });
    return rows.map((r) => ({ ...r.listing, savedAt: r.createdAt }));
  }

  async savedIds(userId: string) {
    return (await this.prisma.savedListing.findMany({ where: { userId }, select: { listingId: true } })).map((r) => r.listingId);
  }

  async recent(userId: string) {
    const rows = await this.prisma.recentView.findMany({ where: { userId, listing: { status: 'ACTIVE', deletedAt: null } }, orderBy: { viewedAt: 'desc' }, take: 20, include: { listing: { select: LISTING_CARD_SELECT } } });
    return rows.map((r) => r.listing);
  }
}

function csv(v?: string): string[] {
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
}
