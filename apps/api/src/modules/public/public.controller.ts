import { Body, Controller, Get, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { Response } from 'express';
import {
  FURNISHING_LABELS,
  LISTING_STATUS_LABELS,
  POSSESSION_LABELS,
  PROPERTY_TYPE_CATEGORY,
  PROPERTY_TYPE_LABELS,
  FACING_LABELS,
  SEO_KIND_TYPES,
  buildSeoSlug,
  parseSeoSlug,
  seoTitle,
  type SeoCombo,
} from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicService } from './public.service';
import { CurrentUser, Public, type RequestUser, Feature } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { env } from '../../config/env';

const contactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  subject: z.string().max(140).optional(),
  message: z.string().min(5).max(3000),
});

@ApiTags('public')
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pub: PublicService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('config')
  config() {
    return this.pub.config();
  }

  @Get('homepage')
  homepage() {
    return this.pub.homepage();
  }

  @Get('stats')
  stats() {
    return this.pub.stats();
  }

  @Get('taxonomies')
  async taxonomies() {
    const amenities = await this.prisma.amenity.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    return {
      propertyTypes: Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
        category: PROPERTY_TYPE_CATEGORY[value as keyof typeof PROPERTY_TYPE_CATEGORY],
      })),
      furnishing: Object.entries(FURNISHING_LABELS).map(([value, label]) => ({ value, label })),
      possession: Object.entries(POSSESSION_LABELS).map(([value, label]) => ({ value, label })),
      facing: Object.entries(FACING_LABELS).map(([value, label]) => ({ value, label })),
      listingStatus: Object.entries(LISTING_STATUS_LABELS).map(([value, label]) => ({ value, label })),
      amenities,
      budgets: {
        SALE: [2500000, 5000000, 7500000, 10000000, 15000000, 20000000, 30000000, 50000000, 75000000, 100000000],
        RENT: [10000, 15000, 20000, 30000, 40000, 50000, 75000, 100000, 150000, 250000],
      },
    };
  }

  @Get('suggest')
  suggest(@Query('q') q = '') {
    return this.pub.suggest(q);
  }

  @Get('localities')
  localities(@Query() q: { zone?: string; popular?: string; q?: string }) {
    return this.pub.localitiesWithStats({
      ...(q.zone ? { zone: q.zone } : {}),
      ...(q.popular === 'true' ? { isPopular: true } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    });
  }

  @Get('localities/:slug')
  locality(@Param('slug') slug: string) {
    return this.pub.localityDetail(slug);
  }

  @Feature('sale_listings')
  @Get('projects')
  projects(@Query() q: { locality?: string; q?: string; featured?: string; possession?: string }) {
    return this.prisma.project.findMany({
      where: {
        isActive: true,
        ...(q.locality ? { locality: { slug: q.locality } } : {}),
        ...(q.featured === 'true' ? { isFeatured: true } : {}),
        ...(q.possession ? { possession: q.possession as any } : {}),
        ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { builder: { name: { contains: q.q, mode: 'insensitive' } } }] } : {}),
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 60,
      include: {
        builder: { select: { name: true, slug: true } },
        locality: { select: { name: true, slug: true } },
        _count: { select: { listings: { where: { status: 'ACTIVE' } } } },
      },
    });
  }

  @Feature('sale_listings')
  @Get('projects/:slug')
  async project(@Param('slug') slug: string) {
    const p = await this.prisma.project.findFirst({
      where: { slug, isActive: true },
      include: {
        builder: true,
        locality: true,
        listings: {
          where: { status: 'ACTIVE', deletedAt: null },
          take: 24,
          orderBy: { publishedAt: 'desc' },
          include: { locality: { select: { name: true, slug: true } } },
        },
      },
    });
    if (!p) throw new NotFoundException('Project नहीं मिला');
    await this.prisma.project.update({ where: { id: p.id }, data: { views: { increment: 1 } } });
    return p;
  }

  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    const p = await this.prisma.page.findFirst({ where: { slug, isPublished: true } });
    if (!p) throw new NotFoundException();
    return p;
  }

  @Get('faqs')
  faqs(@Query('category') category?: string) {
    return this.prisma.faq.findMany({ where: { isActive: true, ...(category ? { category } : {}) }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
  }

  @Get('blog')
  async blog(@Query() q: { tag?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where = { isPublished: true, ...(q.tag ? { tags: { has: q.tag } } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * 12,
        take: 12,
        select: { id: true, slug: true, title: true, excerpt: true, coverUrl: true, tags: true, publishedAt: true },
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / 12)) };
  }

  @Get('blog/:slug')
  async post(@Param('slug') slug: string) {
    const p = await this.prisma.blogPost.findFirst({ where: { slug, isPublished: true }, include: { author: { select: { name: true, avatarUrl: true } } } });
    if (!p) throw new NotFoundException();
    await this.prisma.blogPost.update({ where: { id: p.id }, data: { views: { increment: 1 } } });
    return p;
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('contact')
  async contact(@Body(new ZodPipe(contactSchema)) body: z.infer<typeof contactSchema>, @CurrentUser() user?: RequestUser) {
    const t = await this.prisma.contactMessage.create({ data: { ...body, email: body.email || null, userId: user?.id } });
    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await this.notifications.notify(
      admins.map((a) => a.id),
      { kind: 'SYSTEM', title: `Support: ${body.subject ?? body.name}`, link: '/admin/support', push: false },
    );
    return { ok: true, id: t.id };
  }

  /** Tracked share links (/s/:code on the web redirects here). */
  @Get('share/:code')
  async share(@Param('code') code: string) {
    const link = await this.prisma.shareLink.findUnique({ where: { code }, include: { listing: { select: { slug: true } } } });
    if (!link) throw new NotFoundException();
    await this.prisma.shareLink.update({ where: { id: link.id }, data: { opens: { increment: 1 }, lastOpenedAt: new Date() } });
    if (link.leadId && link.opens === 0) {
      await this.prisma.activity.create({
        data: { organizationId: link.organizationId, leadId: link.leadId, type: 'SYSTEM', content: '👀 Lead ने shared property link खोला' },
      });
      if (link.createdById)
        await this.notifications.notify(link.createdById, { kind: 'SYSTEM', title: 'Lead ने आपका shared link खोला', link: `/broker/leads/${link.leadId}` });
    }
    return { slug: link.listing.slug };
  }

  // ------------------------------------------------------------------ programmatic SEO pages (/rent/<slug>)
  /** Combos that have at least one live listing — used for the sitemap and internal links. */
  @Get('seo-combos')
  async seoCombos(@Query('locality') localitySlug?: string) {
    return this.combos(localitySlug);
  }

  private async combos(localitySlug?: string) {
    const kindOf = (t: string) => (Object.entries(SEO_KIND_TYPES).find(([, types]) => types.includes(t))?.[0] ?? null) as SeoCombo['kind'] | null;
    const rows = await this.prisma.listing.groupBy({
      by: ['localityId', 'propertyType', 'bedrooms', 'furnishing'],
      where: { status: 'ACTIVE', deletedAt: null, purpose: 'RENT', ...(localitySlug ? { locality: { slug: localitySlug } } : {}) },
      _count: { _all: true },
    });
    const locs = await this.prisma.locality.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.localityId))] } },
      select: { id: true, slug: true, name: true },
    });
    const out = new Map<string, { slug: string; title: string; count: number }>();
    for (const r of rows) {
      const kind = kindOf(r.propertyType);
      const loc = locs.find((l) => l.id === r.localityId);
      if (!kind || !loc) continue;
      const variants: SeoCombo[] = [{ kind, localitySlug: loc.slug }];
      if (kind !== 'pg' && r.bedrooms && r.bedrooms <= 5) variants.push({ kind, localitySlug: loc.slug, bedrooms: r.bedrooms });
      if (kind !== 'pg' && r.furnishing) variants.push({ kind, localitySlug: loc.slug, furnishing: r.furnishing as SeoCombo['furnishing'] });
      if (kind !== 'pg' && r.bedrooms && r.bedrooms <= 5 && r.furnishing)
        variants.push({ kind, localitySlug: loc.slug, bedrooms: r.bedrooms, furnishing: r.furnishing as SeoCombo['furnishing'] });
      for (const v of variants) {
        const slug = buildSeoSlug(v);
        const cur = out.get(slug);
        out.set(slug, { slug, title: seoTitle(v, loc.name), count: (cur?.count ?? 0) + r._count._all });
      }
    }
    return [...out.values()].sort((a, b) => b.count - a.count).slice(0, 5000);
  }

  /** Resolves a landing-page slug to search filters + copy; 404 for unknown or empty combos. */
  @Get('seo/:slug')
  async seo(@Param('slug') slug: string) {
    const combo = parseSeoSlug(slug);
    if (!combo) throw new NotFoundException();
    const locality = await this.prisma.locality.findUnique({
      where: { slug: combo.localitySlug },
      select: { id: true, name: true, slug: true, zone: true, avgRent2Bhk: true, highlights: true },
    });
    if (!locality) throw new NotFoundException();
    const where = {
      status: 'ACTIVE' as const,
      deletedAt: null,
      purpose: 'RENT' as const,
      localityId: locality.id,
      propertyType: { in: SEO_KIND_TYPES[combo.kind] as any[] },
      ...(combo.bedrooms ? { bedrooms: combo.bedrooms } : {}),
      ...(combo.furnishing ? { furnishing: combo.furnishing } : {}),
    };
    const [count, agg] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.aggregate({ where, _avg: { price: true }, _min: { price: true }, _max: { price: true } }),
    ]);
    const related = (await this.combos(locality.slug)).filter((c) => c.slug !== slug).slice(0, 12);
    return {
      combo,
      title: seoTitle(combo, locality.name),
      locality,
      count,
      rent: { avg: agg._avg.price ? Math.round(agg._avg.price) : null, min: agg._min.price, max: agg._max.price },
      filters: {
        localities: locality.slug,
        types: SEO_KIND_TYPES[combo.kind].join(','),
        ...(combo.bedrooms ? { bedrooms: String(combo.bedrooms) } : {}),
        ...(combo.furnishing ? { furnishing: combo.furnishing } : {}),
      },
      related,
    };
  }

  @Get('sitemap')
  async sitemap() {
    const [listings, localities, projects, brokers, posts] = await Promise.all([
      this.prisma.listing.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { slug: true, updatedAt: true },
        take: 45000,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.locality.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
      this.prisma.project.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
      this.prisma.organization.findMany({ where: { status: 'ACTIVE', onboarded: true }, select: { slug: true, updatedAt: true } }),
      this.prisma.blogPost.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    ]);
    return { listings, localities, projects, brokers, posts, seo: (await this.combos()).map((c) => c.slug) };
  }

  /** Meta / WhatsApp webhook verification needs to know the public URL of the API. */
  @Get('api-url')
  apiUrl() {
    return { apiUrl: env().PUBLIC_API_URL };
  }

  @Get('robots-check')
  robots(@Res() res: Response) {
    res.type('text/plain').send('ok');
  }
}
