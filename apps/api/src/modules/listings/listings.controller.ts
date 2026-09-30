import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { listingInputSchema, listingSearchSchema, listingUpdateSchema, reportSchema, PROPERTY_TYPE_LABELS } from '@brokeriq/shared';
import { ListingsService } from './listings.service';
import { CurrentUser, Public, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../core/ai/ai.service';
import { UsageService } from '../../core/usage/usage.service';
import { AccessService } from '../../core/access/access.service';
import { descriptionSystem } from '../../core/ai/prompts';

const statusSchema = z.object({ status: z.enum(['SOLD', 'RENTED', 'ARCHIVED', 'ACTIVE']) });
const aiDescSchema = listingInputSchema.partial().extend({ tone: z.enum(['professional', 'friendly', 'luxury']).default('professional'), language: z.enum(['en', 'hi']).default('en') });

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly access: AccessService,
    private readonly listings: ListingsService,
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly usage: UsageService,
  ) {}

  @Public()
  @Get()
  search(@Query(new ZodPipe(listingSearchSchema)) q: any) {
    return this.listings.search(q);
  }

  @Public()
  @Get('map')
  map(@Query(new ZodPipe(listingSearchSchema)) q: any) {
    return this.listings.mapPoints(q);
  }

  @Get('mine')
  mine(@CurrentUser() user: RequestUser, @Query() q: any) {
    return this.listings.mine(user, q);
  }

  @Get('saved')
  saved(@CurrentUser() user: RequestUser) {
    return this.listings.saved(user.id);
  }

  @Get('saved/ids')
  savedIds(@CurrentUser() user: RequestUser) {
    return this.listings.savedIds(user.id);
  }

  @Get('recent')
  recent(@CurrentUser() user: RequestUser) {
    return this.listings.recent(user.id);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string, @CurrentUser() user?: RequestUser, @Query('track') track?: string) {
    return this.listings.detail(slug, user, track !== '0');
  }

  @Public()
  @Get(':id/similar')
  similar(@Param('id') id: string) {
    return this.listings.similar(id);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/contact')
  contact(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.listings.revealContact(id, user);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodPipe(listingInputSchema)) body: any) {
    return this.listings.create(body, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body(new ZodPipe(listingUpdateSchema)) body: any) {
    return this.listings.update(id, body, user);
  }

  @Patch(':id/status')
  status(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body(new ZodPipe(statusSchema)) body: any) {
    return this.listings.setStatus(id, body.status, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.listings.remove(id, user);
  }

  @Post(':id/save')
  save(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.listings.toggleSave(id, user.id, true);
  }

  @Delete(':id/save')
  unsave(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.listings.toggleSave(id, user.id, false);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':id/report')
  async report(@Param('id') id: string, @CurrentUser() user: RequestUser | undefined, @Body(new ZodPipe(reportSchema.omit({ listingId: true }))) body: any) {
    await this.prisma.listingReport.create({ data: { listingId: id, userId: user?.id, reason: body.reason, details: body.details } });
    await this.listings.autoHideIfReported(id);
    return { ok: true };
  }

  /** AI property description writer. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('ai/description')
  async aiDescription(@CurrentUser() user: RequestUser, @Body(new ZodPipe(aiDescSchema)) body: any) {
    await this.access.assertAllowed(user, 'ai');
    await this.usage.assertAiCredit(user.orgId);
    const locality = body.localityId ? await this.prisma.locality.findUnique({ where: { id: body.localityId } }) : null;
    const facts = {
      type: body.propertyType ? PROPERTY_TYPE_LABELS[body.propertyType as keyof typeof PROPERTY_TYPE_LABELS] : undefined,
      purpose: body.purpose,
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms,
      area: body.superArea ?? body.carpetArea ?? body.builtUpArea ?? body.plotArea,
      price: body.price,
      furnishing: body.furnishing,
      floor: body.floor,
      totalFloors: body.totalFloors,
      facing: body.facing,
      society: body.societyName,
      locality: locality ? `${locality.name}, Gurgaon (${locality.zone ?? ''})` : undefined,
      amenities: body.amenities,
      possession: body.possession,
    };
    const text = await this.ai.chat(
      [
        {
          role: 'system',
          content: descriptionSystem(body.tone, body.language),
        },
        { role: 'user', content: JSON.stringify(facts) },
      ],
      { feature: 'listing_description', orgId: user.orgId, userId: user.id, maxTokens: 600, temperature: 0.6, cacheMs: 10 * 60_000 },
    );
    return { description: text.trim() };
  }
}
