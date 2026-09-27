import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Listing } from '@prisma/client';
import {
  PROPERTY_TYPE_CATEGORY,
  PROPERTY_TYPE_LABELS,
  maskPhone,
  normalizeIndianPhone,
  pricePerSqft,
  slugify,
  type ListingInput,
  type ListingSearchInput,
} from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { UsageService } from '../../core/usage/usage.service';
import { EventsService } from '../../core/events/events.service';
import { AuditService } from '../../core/audit/audit.service';
import { paged, shortCode } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';

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
  views: true,
  enquiryCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  locality: { select: { id: true, name: true, slug: true, zone: true } },
  project: { select: { id: true, name: true, slug: true } },
  organization: { select: { id: true, name: true, slug: true, logoUrl: true, verification: true, rating: true } },
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
  ) {}

  // ------------------------------------------------------------------ search
  buildWhere(f: Partial<ListingSearchInput>, opts: { publicOnly?: boolean } = { publicOnly: true }): Prisma.ListingWhereInput {
    const and: Prisma.ListingWhereInput[] = [{ deletedAt: null }];
    if (opts.publicOnly) and.push({ status: 'ACTIVE' });
    if (f.purpose) and.push({ purpose: f.purpose });
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
        return [{ isFeatured: 'desc' }, { isVerified: 'desc' }, { publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
    }
  }

  async search(f: ListingSearchInput) {
    await this.expireFeatured();
    const where = this.buildWhere(f);
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({ where, orderBy: this.orderBy(f.sort), skip: (f.page - 1) * f.pageSize, take: f.pageSize, select: LISTING_CARD_SELECT }),
      this.prisma.listing.count({ where }),
    ]);
    return paged(items, total, f.page, f.pageSize);
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
    const phone = l.contactPhone ?? l.organization?.phone ?? l.postedBy.phone;
    const whatsapp = l.organization?.whatsapp ?? phone;
    return { name: l.contactName ?? l.organization?.name ?? l.postedBy.name, phone, whatsapp };
  }

  // ------------------------------------------------------------------ write
  private autoTitle(input: ListingInput, localityName: string) {
    const typeLabel = PROPERTY_TYPE_LABELS[input.propertyType];
    const bhk = input.bedrooms && PROPERTY_TYPE_CATEGORY[input.propertyType] === 'RESIDENTIAL' && input.propertyType !== 'PG' ? `${input.bedrooms} BHK ` : '';
    return `${bhk}${typeLabel} for ${input.purpose === 'SALE' ? 'Sale' : 'Rent'} in ${localityName}, Gurgaon`;
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
    const autoApprove = !app.listing.requireModeration || user.role === 'SUPER_ADMIN';
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
        coverUrl: input.photos[0]?.url ?? null,
        status,
        moderationFlags: flags,
        postedByType: user.role === 'SUPER_ADMIN' ? 'BUILDER' : isBroker ? 'BROKER' : 'OWNER',
        postedById: user.id,
        organizationId: isBroker ? user.orgId : null,
        publishedAt: status === 'ACTIVE' ? new Date() : null,
        expiresAt: status === 'ACTIVE' ? new Date(Date.now() + app.listing.expiryDays * 86400_000) : null,
        media: { create: input.photos.map((p, i) => ({ url: p.url, caption: p.caption, publicId: p.publicId, sortOrder: i })) },
      } as Prisma.ListingUncheckedCreateInput,
    });
    if (status === 'ACTIVE') this.events.emit('listing.published', { listingId: listing.id });
    await this.audit.log(user, 'listing.create', 'Listing', listing.id, { status });
    return listing;
  }

  async update(id: string, input: Partial<ListingInput>, user: RequestUser) {
    const existing = await this.prisma.listing.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException();
    if (!this.canEdit(existing, user)) throw new ForbiddenException();
    const app = await this.settings.getAppConfig();
    const contentChanged = CONTENT_FIELDS.some((k) => input[k] !== undefined);
    let status = existing.status;
    if (input.submit && existing.status === 'DRAFT') status = app.listing.requireModeration && user.role !== 'SUPER_ADMIN' ? 'PENDING_REVIEW' : 'ACTIVE';
    else if (existing.status === 'REJECTED' && input.submit !== false) status = 'PENDING_REVIEW';
    else if (existing.status === 'ACTIVE' && contentChanged && app.listing.requireModeration && user.role !== 'SUPER_ADMIN') status = 'PENDING_REVIEW';

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
        await tx.listingMedia.createMany({ data: input.photos.map((p, i) => ({ listingId: id, url: p.url, caption: p.caption, publicId: p.publicId, sortOrder: i })) });
        data.coverUrl = input.photos[0]?.url ?? null;
      }
      const updated = await tx.listing.update({ where: { id }, data });
      if (status === 'ACTIVE' && existing.status !== 'ACTIVE') this.events.emit('listing.published', { listingId: id });
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
      next = existing.publishedAt || !app.listing.requireModeration ? 'ACTIVE' : 'PENDING_REVIEW';
      if (next === 'ACTIVE') data.expiresAt = new Date(Date.now() + app.listing.expiryDays * 86400_000);
    }
    return this.prisma.listing.update({ where: { id }, data: { ...data, status: next } });
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
