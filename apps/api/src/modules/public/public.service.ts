import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { RENTAL_ONLY } from '@brokeriq/shared';
import { LISTING_CARD_SELECT } from '../listings/listings.service';

@Injectable()
export class PublicService {
  private homepageCache: { at: number; value: unknown } | null = null;
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async config() {
    const [app, flags, integrations] = await Promise.all([this.settings.getAppConfig(), this.prisma.featureFlag.findMany(), this.settings.publicIntegrations()]);
    return { app, flags: Object.fromEntries(flags.map((f) => [f.key, f.enabled])), integrations, apiVersion: '2.0.0' };
  }

  async stats() {
    const [listings, sale, rent, brokers, localities, projects] = await Promise.all([
      this.prisma.listing.count({ where: { status: 'ACTIVE', deletedAt: null, ...(RENTAL_ONLY ? { purpose: 'RENT' as const } : {}) } }),
      this.prisma.listing.count({ where: { status: 'ACTIVE', deletedAt: null, purpose: 'SALE' } }),
      this.prisma.listing.count({ where: { status: 'ACTIVE', deletedAt: null, purpose: 'RENT' } }),
      this.prisma.organization.count({ where: { status: 'ACTIVE', onboarded: true } }),
      this.prisma.locality.count({ where: { isActive: true } }),
      this.prisma.project.count({ where: { isActive: true } }),
    ]);
    return { listings, sale: RENTAL_ONLY ? 0 : sale, rent, brokers, localities, projects: RENTAL_ONLY ? 0 : projects };
  }

  /** Localities with live listing counts, average rent (2 BHK) and — for legacy clients — average sale ₹/sqft. */
  async localitiesWithStats(where: Prisma.LocalityWhereInput, take = 200) {
    const locs = await this.prisma.locality.findMany({ where: { isActive: true, ...where }, orderBy: [{ isPopular: 'desc' }, { sortOrder: 'asc' }], take });
    if (!locs.length) return [];
    const ids = locs.map((l) => l.id);
    const [counts, psf, rent2] = await Promise.all([
      this.prisma.listing.groupBy({ by: ['localityId', 'purpose'], where: { localityId: { in: ids }, status: 'ACTIVE', deletedAt: null }, _count: { _all: true } }),
      this.prisma.listing.groupBy({ by: ['localityId'], where: { localityId: { in: ids }, status: 'ACTIVE', deletedAt: null, purpose: 'SALE', category: 'RESIDENTIAL', pricePerSqft: { not: null } }, _avg: { pricePerSqft: true }, _count: { _all: true } }),
      this.prisma.listing.groupBy({ by: ['localityId'], where: { localityId: { in: ids }, status: 'ACTIVE', deletedAt: null, purpose: 'RENT', category: 'RESIDENTIAL', bedrooms: 2 }, _avg: { price: true }, _count: { _all: true } }),
    ]);
    return locs.map((l) => {
      const sale = RENTAL_ONLY ? 0 : (counts.find((c) => c.localityId === l.id && c.purpose === 'SALE')?._count._all ?? 0);
      const rent = counts.find((c) => c.localityId === l.id && c.purpose === 'RENT')?._count._all ?? 0;
      const p = psf.find((x) => x.localityId === l.id);
      const computed = p && p._count._all >= 3 ? Math.round(p._avg.pricePerSqft ?? 0) : null;
      const r = rent2.find((x) => x.localityId === l.id);
      const avgRent = r && r._count._all >= 3 ? Math.round(r._avg.price ?? 0) : (l.avgRent2Bhk ?? null);
      return { ...l, listingsSale: sale, listingsRent: rent, avgRent, avgPsf: RENTAL_ONLY ? null : (computed ?? l.avgPriceSale ?? null) };
    });
  }

  async homepage() {
    if (this.homepageCache && Date.now() - this.homepageCache.at < 60_000) return this.homepageCache.value;
    const sections = await this.prisma.homepageSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    const out = [];
    for (const s of sections) {
      const cfg = (s.config ?? {}) as Record<string, any>;
      let data: unknown = null;
      switch (s.type) {
        case 'HERO':
          data = await this.stats();
          break;
        case 'LOCALITIES':
          data = await this.localitiesWithStats(cfg.popularOnly ? { isPopular: true } : {}, cfg.limit ?? 12);
          break;
        case 'FEATURED_LISTINGS': {
          const ids: string[] = Array.isArray(cfg.listingIds) ? cfg.listingIds : [];
          data = await this.prisma.listing.findMany({
            where: { status: 'ACTIVE', deletedAt: null, ...(ids.length ? { id: { in: ids } } : {}), ...(RENTAL_ONLY ? { purpose: 'RENT' as const } : cfg.purpose === 'SALE' || cfg.purpose === 'RENT' ? { purpose: cfg.purpose } : {}) },
            orderBy: [{ isFeatured: 'desc' }, { isVerified: 'desc' }, { publishedAt: 'desc' }],
            take: cfg.limit ?? 8,
            select: LISTING_CARD_SELECT,
          });
          break;
        }
        case 'FEATURED_PROJECTS':
          // New-launch projects are sale inventory — hidden on the rental marketplace.
          data = RENTAL_ONLY ? [] : await this.prisma.project.findMany({
            where: { isActive: true },
            orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
            take: cfg.limit ?? 6,
            include: { builder: { select: { name: true, slug: true } }, locality: { select: { name: true, slug: true } } },
          });
          break;
        case 'TOP_BROKERS':
          data = await this.prisma.organization.findMany({
            where: { status: 'ACTIVE', onboarded: true },
            orderBy: [{ rankScore: 'desc' }, { verification: 'desc' }, { rating: 'desc' }, { reviewCount: 'desc' }],
            take: cfg.limit ?? 8,
            select: { id: true, name: true, slug: true, logoUrl: true, verification: true, rating: true, reviewCount: true, experienceYears: true, responseMinutes: true, _count: { select: { listings: { where: { status: 'ACTIVE', deletedAt: null } } } } },
          });
          break;
        case 'BLOG':
          data = await this.prisma.blogPost.findMany({ where: { isPublished: true }, orderBy: { publishedAt: 'desc' }, take: cfg.limit ?? 3, select: { id: true, slug: true, title: true, excerpt: true, coverUrl: true, publishedAt: true, tags: true } });
          break;
        case 'MAP_EXPLORER':
          data = await this.localitiesWithStats({}, 200);
          break;
      }
      out.push({ id: s.id, type: s.type, title: s.title, subtitle: s.subtitle, config: cfg, data });
    }
    this.homepageCache = { at: Date.now(), value: out };
    return out;
  }

  invalidateHomepage() {
    this.homepageCache = null;
  }

  async localityDetail(slug: string) {
    const loc = await this.prisma.locality.findFirst({ where: { slug, isActive: true } });
    if (!loc) throw new NotFoundException('Locality नहीं मिली');
    const [withStats] = await this.localitiesWithStats({ id: loc.id }, 1);
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const trend = await this.prisma.$queryRaw<{ month: Date; avg: number; count: bigint }[]>`
      SELECT date_trunc('month', "createdAt") AS month, AVG("pricePerSqft")::float AS avg, COUNT(*) AS count
      FROM "Listing"
      WHERE "localityId" = ${loc.id} AND purpose = 'RENT' AND category = 'RESIDENTIAL' AND "pricePerSqft" IS NOT NULL
        AND "createdAt" >= ${since} AND "deletedAt" IS NULL
      GROUP BY 1 ORDER BY 1`;
    const [projects, brokers, rentAgg, bhkMix] = await Promise.all([
      RENTAL_ONLY ? Promise.resolve([]) : this.prisma.project.findMany({ where: { localityId: loc.id, isActive: true }, take: 12, include: { builder: { select: { name: true } } } }),
      this.prisma.organization.findMany({
        where: { status: 'ACTIVE', onboarded: true, OR: [{ localities: { some: { id: loc.id } } }, { listings: { some: { localityId: loc.id, status: 'ACTIVE' } } }] },
        orderBy: [{ rankScore: 'desc' }, { verification: 'desc' }, { rating: 'desc' }],
        take: 8,
        select: { id: true, name: true, slug: true, logoUrl: true, verification: true, rating: true, reviewCount: true, responseMinutes: true, _count: { select: { listings: { where: { status: 'ACTIVE', deletedAt: null } } } } },
      }),
      this.prisma.listing.groupBy({ by: ['bedrooms'], where: { localityId: loc.id, purpose: 'RENT', status: 'ACTIVE', deletedAt: null, bedrooms: { not: null } }, _avg: { price: true }, _count: { _all: true } }),
      this.prisma.listing.groupBy({ by: ['bedrooms'], where: { localityId: loc.id, status: 'ACTIVE', deletedAt: null, bedrooms: { not: null } }, _count: { _all: true } }),
    ]);
    const nearby = await this.prisma.$queryRaw<{ id: string; name: string; slug: string; zone: string | null; km: number }[]>`
      SELECT id, name, slug, zone,
        (6371 * acos(least(1, cos(radians(${loc.latitude})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${loc.longitude})) + sin(radians(${loc.latitude})) * sin(radians(latitude))))) AS km
      FROM "Locality" WHERE id <> ${loc.id} AND "isActive" = true ORDER BY km ASC LIMIT 8`;
    return {
      ...withStats,
      priceTrend: trend.map((t) => ({ month: t.month, avgPsf: Math.round(t.avg), count: Number(t.count) })),
      rentByBhk: rentAgg.map((r) => ({ bedrooms: r.bedrooms, avgRent: Math.round(r._avg.price ?? 0), count: r._count._all })),
      bhkMix: bhkMix.map((b) => ({ bedrooms: b.bedrooms, count: b._count._all })),
      projects,
      brokers,
      nearby: nearby.map((n) => ({ ...n, km: Math.round(n.km * 10) / 10 })),
    };
  }

  async suggest(q: string) {
    const s = q.trim();
    if (s.length < 2) return { localities: [], projects: [], brokers: [] };
    const [localities, projects, brokers] = await Promise.all([
      this.prisma.locality.findMany({ where: { isActive: true, OR: [{ name: { contains: s, mode: 'insensitive' } }, { zone: { contains: s, mode: 'insensitive' } }] }, take: 8, orderBy: [{ isPopular: 'desc' }], select: { id: true, name: true, slug: true, zone: true } }),
      RENTAL_ONLY ? Promise.resolve([]) : this.prisma.project.findMany({ where: { isActive: true, OR: [{ name: { contains: s, mode: 'insensitive' } }, { builder: { name: { contains: s, mode: 'insensitive' } } }] }, take: 6, select: { id: true, name: true, slug: true, builder: { select: { name: true } }, locality: { select: { name: true } } } }),
      this.prisma.organization.findMany({ where: { status: 'ACTIVE', onboarded: true, name: { contains: s, mode: 'insensitive' } }, take: 4, select: { id: true, name: true, slug: true, logoUrl: true } }),
    ]);
    return { localities, projects, brokers };
  }
}
