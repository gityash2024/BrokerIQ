import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  blogPostSchema,
  faqSchema,
  homepageSectionSchema,
  localitySchema,
  pageSchema,
  planSchema,
  projectSchema,
  slugify,
  templateSchema,
} from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PublicService } from '../public/public.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { paged, shortCode } from '../../common/utils';

const amenitySchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(2).max(60),
  icon: z.string().max(40).optional().nullable(),
  category: z.enum(['society', 'flat', 'commercial']).default('society'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
const couponSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_-]{3,30}$/),
  percentOff: z.number().min(0).max(100).optional().nullable(),
  amountOff: z.number().min(0).optional().nullable(),
  maxRedemptions: z.number().int().min(1).optional().nullable(),
  validUntil: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
const builderSchema = z.object({
  name: z.string().min(2).max(120),
  logoUrl: z.string().url().optional().nullable().or(z.literal('')),
  description: z.string().max(5000).optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
});

@ApiTags('admin')
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pub: PublicService,
  ) {}

  // ------------------------------------------------------------------ homepage builder
  @Get('homepage')
  sections() {
    return this.prisma.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @Post('homepage')
  async addSection(@Body(new ZodPipe(homepageSectionSchema)) body: any) {
    const max = await this.prisma.homepageSection.aggregate({ _max: { sortOrder: true } });
    const s = await this.prisma.homepageSection.create({ data: { ...body, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    this.pub.invalidateHomepage();
    return s;
  }

  @Patch('homepage/:id')
  async updateSection(@Param('id') id: string, @Body(new ZodPipe(homepageSectionSchema.partial())) body: any) {
    const s = await this.prisma.homepageSection.update({ where: { id }, data: body });
    this.pub.invalidateHomepage();
    return s;
  }

  @Put('homepage/order')
  async reorder(@Body(new ZodPipe(z.object({ ids: z.array(z.string()) }))) body: any) {
    await this.prisma.$transaction(body.ids.map((id: string, i: number) => this.prisma.homepageSection.update({ where: { id }, data: { sortOrder: i } })));
    this.pub.invalidateHomepage();
    return { ok: true };
  }

  @Delete('homepage/:id')
  async deleteSection(@Param('id') id: string) {
    await this.prisma.homepageSection.delete({ where: { id } });
    this.pub.invalidateHomepage();
    return { ok: true };
  }

  // ------------------------------------------------------------------ pages / blog / faqs / templates
  @Get('pages')
  pages() {
    return this.prisma.page.findMany({ orderBy: { slug: 'asc' } });
  }
  @Post('pages')
  createPage(@Body(new ZodPipe(pageSchema)) body: any) {
    return this.prisma.page.create({ data: body });
  }
  @Patch('pages/:id')
  updatePage(@Param('id') id: string, @Body(new ZodPipe(pageSchema.partial())) body: any) {
    return this.prisma.page.update({ where: { id }, data: body });
  }
  @Delete('pages/:id')
  async deletePage(@Param('id') id: string) {
    await this.prisma.page.delete({ where: { id } });
    return { ok: true };
  }

  @Get('blog')
  blog() {
    return this.prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, slug: true, title: true, isPublished: true, publishedAt: true, views: true, tags: true, coverUrl: true, updatedAt: true },
    });
  }
  @Get('blog/:id')
  async blogPost(@Param('id') id: string) {
    const p = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    return p;
  }
  @Post('blog')
  createPost(@CurrentUser() user: RequestUser, @Body(new ZodPipe(blogPostSchema)) body: any) {
    return this.prisma.blogPost.create({
      data: { ...body, coverUrl: body.coverUrl || null, authorId: user.id, publishedAt: body.isPublished ? new Date() : null },
    });
  }
  @Patch('blog/:id')
  async updatePost(@Param('id') id: string, @Body(new ZodPipe(blogPostSchema.partial())) body: any) {
    const existing = await this.prisma.blogPost.findUniqueOrThrow({ where: { id } });
    return this.prisma.blogPost.update({
      where: { id },
      data: { ...body, ...(body.coverUrl === '' ? { coverUrl: null } : {}), publishedAt: body.isPublished && !existing.publishedAt ? new Date() : undefined },
    });
  }
  @Delete('blog/:id')
  async deletePost(@Param('id') id: string) {
    await this.prisma.blogPost.delete({ where: { id } });
    return { ok: true };
  }

  @Get('faqs')
  faqs() {
    return this.prisma.faq.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
  }
  @Post('faqs')
  createFaq(@Body(new ZodPipe(faqSchema)) body: any) {
    return this.prisma.faq.create({ data: body });
  }
  @Patch('faqs/:id')
  updateFaq(@Param('id') id: string, @Body(new ZodPipe(faqSchema.partial())) body: any) {
    return this.prisma.faq.update({ where: { id }, data: body });
  }
  @Delete('faqs/:id')
  async deleteFaq(@Param('id') id: string) {
    await this.prisma.faq.delete({ where: { id } });
    return { ok: true };
  }

  @Get('templates')
  templates() {
    return this.prisma.template.findMany({ orderBy: [{ channel: 'asc' }, { key: 'asc' }] });
  }
  @Post('templates')
  createTemplate(@Body(new ZodPipe(templateSchema)) body: any) {
    return this.prisma.template.create({ data: body });
  }
  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body(new ZodPipe(templateSchema.partial())) body: any) {
    return this.prisma.template.update({ where: { id }, data: body });
  }

  // ------------------------------------------------------------------ master data
  @Get('localities')
  localities(@Query('q') q?: string) {
    return this.prisma.locality.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
      orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { listings: { where: { status: 'ACTIVE' } }, projects: true } } },
    });
  }
  @Post('localities')
  async createLocality(@CurrentUser() user: RequestUser, @Body(new ZodPipe(localitySchema)) body: any) {
    const l = await this.prisma.locality.create({ data: { ...body, coverUrl: body.coverUrl || null, slug: body.slug || slugify(`${body.name} gurgaon`) } });
    await this.audit.log(user, 'locality.create', 'Locality', l.id);
    return l;
  }
  @Patch('localities/:id')
  updateLocality(@Param('id') id: string, @Body(new ZodPipe(localitySchema.partial())) body: any) {
    return this.prisma.locality.update({ where: { id }, data: { ...body, ...(body.coverUrl === '' ? { coverUrl: null } : {}) } });
  }
  @Delete('localities/:id')
  async deleteLocality(@Param('id') id: string) {
    const used = await this.prisma.listing.count({ where: { localityId: id } });
    if (used) throw new BadRequestException(`${used} listings इस locality में हैं — delete की जगह inactive करें`);
    await this.prisma.locality.delete({ where: { id } });
    return { ok: true };
  }

  @Get('amenities')
  amenities() {
    return this.prisma.amenity.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
  }
  @Post('amenities')
  createAmenity(@Body(new ZodPipe(amenitySchema)) body: any) {
    return this.prisma.amenity.create({ data: body });
  }
  @Patch('amenities/:id')
  updateAmenity(@Param('id') id: string, @Body(new ZodPipe(amenitySchema.partial())) body: any) {
    return this.prisma.amenity.update({ where: { id }, data: body });
  }

  @Get('builders')
  builders() {
    return this.prisma.builder.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { projects: true } } } });
  }
  @Post('builders')
  createBuilder(@Body(new ZodPipe(builderSchema)) body: any) {
    return this.prisma.builder.create({ data: { ...body, logoUrl: body.logoUrl || null, website: body.website || null, slug: slugify(body.name) } });
  }
  @Patch('builders/:id')
  updateBuilder(@Param('id') id: string, @Body(new ZodPipe(builderSchema.partial())) body: any) {
    return this.prisma.builder.update({ where: { id }, data: body });
  }

  @Get('projects')
  projects(@Query('q') q?: string) {
    return this.prisma.project.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
      orderBy: { createdAt: 'desc' },
      include: { builder: { select: { name: true } }, locality: { select: { name: true } }, _count: { select: { listings: true, enquiries: true } } },
    });
  }
  @Get('projects/:id')
  async project(@Param('id') id: string) {
    const p = await this.prisma.project.findUnique({ where: { id }, include: { builder: true } });
    if (!p) throw new NotFoundException();
    return p;
  }
  @Post('projects')
  async createProject(@CurrentUser() user: RequestUser, @Body(new ZodPipe(projectSchema)) body: any) {
    const builder = await this.prisma.builder.upsert({
      where: { name: body.builderName },
      create: { name: body.builderName, slug: slugify(body.builderName) },
      update: {},
    });
    const { builderName, possessionDate, brochureUrl, ...rest } = body;
    void builderName;
    const p = await this.prisma.project.create({
      data: {
        ...rest,
        builderId: builder.id,
        slug: `${slugify(body.name)}-${shortCode(4).toLowerCase()}`,
        possessionDate: possessionDate ? new Date(possessionDate) : null,
        brochureUrl: brochureUrl || null,
        configurations: body.configurations as Prisma.InputJsonValue,
      },
    });
    await this.audit.log(user, 'project.create', 'Project', p.id);
    this.pub.invalidateHomepage();
    return p;
  }
  @Patch('projects/:id')
  async updateProject(@Param('id') id: string, @Body(new ZodPipe(projectSchema.partial())) body: any) {
    const { builderName, possessionDate, brochureUrl, ...rest } = body;
    const data: Prisma.ProjectUncheckedUpdateInput = { ...rest };
    if (builderName)
      data.builderId = (
        await this.prisma.builder.upsert({ where: { name: builderName }, create: { name: builderName, slug: slugify(builderName) }, update: {} })
      ).id;
    if (possessionDate !== undefined) data.possessionDate = possessionDate ? new Date(possessionDate) : null;
    if (brochureUrl !== undefined) data.brochureUrl = brochureUrl || null;
    if (rest.configurations) data.configurations = rest.configurations as Prisma.InputJsonValue;
    const p = await this.prisma.project.update({ where: { id }, data });
    this.pub.invalidateHomepage();
    return p;
  }
  @Delete('projects/:id')
  async deleteProject(@Param('id') id: string) {
    await this.prisma.project.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  // ------------------------------------------------------------------ billing admin
  @Get('plans')
  plans() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { subscriptions: true } } } });
  }
  @Post('plans')
  async createPlan(@CurrentUser() user: RequestUser, @Body(new ZodPipe(planSchema)) body: any) {
    const p = await this.prisma.plan.create({ data: { ...body, limits: body.limits as Prisma.InputJsonValue } });
    await this.audit.log(user, 'plan.create', 'Plan', p.id);
    return p;
  }
  @Patch('plans/:id')
  async updatePlan(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(planSchema.partial())) body: any) {
    const p = await this.prisma.plan.update({ where: { id }, data: { ...body, ...(body.limits ? { limits: body.limits as Prisma.InputJsonValue } : {}) } });
    await this.audit.log(user, 'plan.update', 'Plan', id, body);
    return p;
  }

  @Get('subscriptions')
  async subscriptions(@Query() q: { status?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.SubscriptionWhereInput = q.status ? { status: q.status as any } : {};
    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * 30,
        take: 30,
        include: { plan: true, organization: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return paged(items, total, page, 30);
  }

  @Get('payments')
  async payments(@Query() q: { status?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.PaymentWhereInput = q.status ? { status: q.status as any } : {};
    const [items, total, sum] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 30,
        take: 30,
        include: { organization: { select: { name: true, slug: true } } },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    ]);
    return { ...paged(items, total, page, 30), totalPaid: (sum._sum.amount ?? 0) / 100 };
  }

  @Get('coupons')
  coupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }
  @Post('coupons')
  createCoupon(@Body(new ZodPipe(couponSchema)) body: any) {
    return this.prisma.coupon.create({ data: { ...body, validUntil: body.validUntil ? new Date(body.validUntil) : null } });
  }
  @Patch('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body(new ZodPipe(couponSchema.partial())) body: any) {
    return this.prisma.coupon.update({
      where: { id },
      data: { ...body, ...(body.validUntil !== undefined ? { validUntil: body.validUntil ? new Date(body.validUntil) : null } : {}) },
    });
  }
}
