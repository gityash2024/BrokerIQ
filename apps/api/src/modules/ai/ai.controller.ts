import { BadRequestException, Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { PROPERTY_TYPES, PROPERTY_TYPE_CATEGORY, pricePerSqft, slugify, normalizeIndianPhone } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService, parseJsonLoose } from '../../core/ai/ai.service';
import { UsageService } from '../../core/usage/usage.service';
import { MediaService } from '../../core/media/media.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg, shortCode } from '../../common/utils';

const scanSchema = z.object({ image: z.string().startsWith('data:image/').max(12_000_000), hint: z.string().max(300).optional() });
const rowSchema = z.object({
  purpose: z.enum(['SALE', 'RENT']).default('SALE'),
  propertyType: z.enum(PROPERTY_TYPES).default('APARTMENT'),
  localityId: z.string().nullable().optional(),
  societyName: z.string().max(120).nullable().optional(),
  unit: z.string().max(60).nullable().optional(),
  floor: z.number().int().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  area: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  furnishing: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).nullable().optional(),
  contactName: z.string().max(80).nullable().optional(),
  contactPhone: z.string().max(20).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const SCAN_PROMPT = `You are reading a photo of an Indian real-estate broker's handwritten or printed listing register (Gurgaon).
Extract every property row. Respond ONLY with JSON: {"rows":[{"purpose":"SALE"|"RENT","propertyType":"APARTMENT"|"BUILDER_FLOOR"|"VILLA"|"INDEPENDENT_HOUSE"|"RESIDENTIAL_PLOT"|"COMMERCIAL_PLOT"|"OFFICE"|"SHOP"|"SHOWROOM"|"WAREHOUSE"|"COWORKING"|"PENTHOUSE"|"STUDIO","sector":string|null,"society":string|null,"unit":string|null,"floor":number|null,"bedrooms":number|null,"areaSqft":number|null,"priceInr":number|null,"furnishing":"UNFURNISHED"|"SEMI_FURNISHED"|"FULLY_FURNISHED"|null,"contactName":string|null,"contactPhone":string|null,"notes":string|null,"confidence":0-1}]}
Rules: convert "1.2 Cr" → 12000000, "85 L" → 8500000, "45k" (rent) → 45000. "Sec 65"/"S-65" → "Sector 65". If rent is mentioned use RENT. Never invent values — use null when unreadable.`;

@ApiTags('ai')
@Roles('BROKER_ADMIN', 'BROKER_AGENT')
@Controller('ai')
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly usage: UsageService,
    private readonly media: MediaService,
  ) {}

  private async localityIndex() {
    return this.prisma.locality.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  }

  private matchLocality(locs: { id: string; name: string }[], text?: string | null) {
    if (!text) return null;
    const t = text.toLowerCase().replace(/sec(tor)?\.?\s*-?\s*/g, 'sector ').replace(/\s+/g, ' ').trim();
    const num = t.match(/sector (\d+[a-z]?)/)?.[1];
    if (num) {
      const hit = locs.find((l) => l.name.toLowerCase() === `sector ${num}`);
      if (hit) return hit;
    }
    return locs.find((l) => t.includes(l.name.toLowerCase())) ?? locs.find((l) => l.name.toLowerCase().includes(t)) ?? null;
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('scan')
  async scan(@CurrentUser() user: RequestUser, @Body(new ZodPipe(scanSchema)) body: any) {
    const orgId = requireOrg(user);
    const flag = await this.prisma.featureFlag.findUnique({ where: { key: 'ai_scanner' } });
    if (flag && !flag.enabled) throw new ForbiddenException('AI scanner अभी बंद है');
    await this.usage.assertAiCredit(orgId);
    const text = await this.ai.vision(body.image, `${SCAN_PROMPT}${body.hint ? `\nHint from broker: ${body.hint}` : ''}`, { feature: 'scanner', orgId, userId: user.id, json: true, maxTokens: 3000 });
    const parsed = parseJsonLoose<{ rows?: any[] }>(text);
    const locs = await this.localityIndex();
    const rows = (parsed.rows ?? []).map((r) => {
      const loc = this.matchLocality(locs, r.sector ?? r.society);
      return {
        purpose: r.purpose === 'RENT' ? 'RENT' : 'SALE',
        propertyType: PROPERTY_TYPES.includes(r.propertyType) ? r.propertyType : 'APARTMENT',
        localityId: loc?.id ?? null,
        localityName: loc?.name ?? r.sector ?? null,
        societyName: r.society ?? null,
        unit: r.unit ?? null,
        floor: Number.isFinite(r.floor) ? r.floor : null,
        bedrooms: Number.isFinite(r.bedrooms) ? r.bedrooms : null,
        area: Number.isFinite(r.areaSqft) ? r.areaSqft : null,
        price: Number.isFinite(r.priceInr) ? r.priceInr : null,
        furnishing: r.furnishing ?? null,
        contactName: r.contactName ?? null,
        contactPhone: r.contactPhone ? normalizeIndianPhone(r.contactPhone) ?? r.contactPhone : null,
        notes: r.notes ?? null,
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.6,
      };
    });
    const imageUrl = await this.media.uploadDataUrl(body.image, 'scan', orgId).catch(() => null);
    return { rows, imageUrl };
  }

  /** Imports scanned rows as private DRAFT listings in the broker's inventory. */
  @Post('scan/import')
  async importRows(@CurrentUser() user: RequestUser, @Body(new ZodPipe(z.object({ rows: z.array(rowSchema).min(1).max(100) }))) body: any) {
    const orgId = requireOrg(user);
    const locs = await this.localityIndex();
    const created: string[] = [];
    const errors: { index: number; error: string }[] = [];
    for (const [i, r] of body.rows.entries()) {
      if (!r.localityId || !locs.some((l) => l.id === r.localityId)) {
        errors.push({ index: i, error: 'Locality select करें' });
        continue;
      }
      if (!r.price) {
        errors.push({ index: i, error: 'Price ज़रूरी है' });
        continue;
      }
      const loc = locs.find((l) => l.id === r.localityId)!;
      const title = `${r.bedrooms ? `${r.bedrooms} BHK ` : ''}${r.propertyType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())} for ${r.purpose === 'SALE' ? 'Sale' : 'Rent'} in ${loc.name}${r.societyName ? `, ${r.societyName}` : ''}`;
      const l = await this.prisma.listing.create({
        data: {
          slug: `${slugify(title)}-${shortCode(6).toLowerCase()}`,
          purpose: r.purpose,
          propertyType: r.propertyType,
          category: PROPERTY_TYPE_CATEGORY[r.propertyType as keyof typeof PROPERTY_TYPE_CATEGORY],
          status: 'DRAFT',
          title,
          description: [r.unit ? `Unit: ${r.unit}` : null, r.notes].filter(Boolean).join('\n') || null,
          localityId: r.localityId,
          societyName: r.societyName,
          floor: r.floor,
          bedrooms: r.bedrooms,
          superArea: r.area,
          price: r.price,
          pricePerSqft: pricePerSqft(r.price, r.area),
          furnishing: r.furnishing,
          contactName: r.contactName,
          contactPhone: r.contactPhone,
          postedByType: 'BROKER',
          postedById: user.id,
          organizationId: orgId,
          moderationFlags: ['FROM_SCANNER'],
        },
      });
      created.push(l.id);
    }
    if (!created.length && errors.length) throw new BadRequestException(errors[0].error);
    return { created: created.length, ids: created, errors };
  }
}
