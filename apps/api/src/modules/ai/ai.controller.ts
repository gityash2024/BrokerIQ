import { BadRequestException, Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { BROKERAGE_TYPES, PROPERTY_TYPES, PROPERTY_TYPE_CATEGORY, RENTABLE_TYPES, pricePerSqft, slugify, normalizeIndianPhone } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService, parseJsonLoose } from '../../core/ai/ai.service';
import { UsageService } from '../../core/usage/usage.service';
import { MediaService } from '../../core/media/media.service';
import { ListingsService } from '../listings/listings.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg, shortCode } from '../../common/utils';

const scanSchema = z.object({
  image: z.string().startsWith('data:image/').max(12_000_000),
  hint: z.string().max(300).optional(),
  /** 1-based page number when a multi-page scan is processed page by page. */
  page: z.number().int().min(1).max(50).optional(),
});
const rowSchema = z.object({
  purpose: z.enum(['SALE', 'RENT']).default('RENT'),
  propertyType: z.enum(PROPERTY_TYPES).refine((t) => RENTABLE_TYPES.includes(t), 'यह property type rent के लिए नहीं है').default('APARTMENT'),
  localityId: z.string().nullable().optional(),
  societyName: z.string().max(120).nullable().optional(),
  unit: z.string().max(60).nullable().optional(),
  floor: z.number().int().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  area: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  securityDeposit: z.number().min(0).nullable().optional(),
  brokerageType: z.enum(BROKERAGE_TYPES).nullable().optional(),
  brokerageAmount: z.number().min(0).nullable().optional(),
  availableFrom: z.string().max(40).nullable().optional(),
  furnishing: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).nullable().optional(),
  contactName: z.string().max(80).nullable().optional(),
  contactPhone: z.string().max(20).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

/** OCR + structuring prompt for a Gurgaon rental broker's listing register (handwritten or printed, Hindi/English/Hinglish). */
const SCAN_PROMPT = `You are an OCR and data-entry assistant for a RENTAL property broker in Gurgaon (Gurugram), Haryana, India.
The image is one page of the broker's listing register / diary — handwritten or printed, in Hindi, English or Hinglish, often with abbreviations.

Step 1 (OCR): transcribe the page faithfully, line by line, into "rawText" (keep numbers and names exactly as written; unreadable parts → "[?]").
Step 2 (structure): turn every property entry into one row. Respond ONLY with JSON:
{"rawText": string,
 "rows":[{"propertyType":"APARTMENT"|"BUILDER_FLOOR"|"INDEPENDENT_HOUSE"|"VILLA"|"PENTHOUSE"|"STUDIO"|"SERVICE_APARTMENT"|"PG"|"OFFICE"|"COWORKING"|"SHOP"|"SHOWROOM"|"WAREHOUSE",
  "sector":string|null,"society":string|null,"unit":string|null,"floor":number|null,"bedrooms":number|null,"areaSqft":number|null,
  "rentInr":number|null,"depositInr":number|null,"brokerage":"NONE"|"DAYS_15"|"MONTH_1"|"FIXED"|null,"brokerageInr":number|null,
  "furnishing":"UNFURNISHED"|"SEMI_FURNISHED"|"FULLY_FURNISHED"|null,"availableFrom":string|null,
  "contactName":string|null,"contactPhone":string|null,"notes":string|null,"confidence":0-1}]}
Rules:
- Every listing is for RENT (monthly). "45k"/"45 हज़ार"/"45000 pm" → 45000. "1.2 L" rent → 120000.
- Deposit: "2 month deposit" → depositInr = 2 × rent; "dep 1L" → 100000.
- Brokerage: "1 month"/"full month" → MONTH_1, "15 days"/"half month" → DAYS_15, "no brokerage"/"NB" → NONE, a fixed ₹ amount → FIXED with brokerageInr.
- "Sec 65"/"S-65"/"सेक्टर 65" → "Sector 65". "FF"/"fully furnished" → FULLY_FURNISHED, "SF"/"semi" → SEMI_FURNISHED, "UF"/"bare" → UNFURNISHED.
- "3BHK" → bedrooms 3; "BF"/"builder floor" → BUILDER_FLOOR; "PG" / "co-living" → PG.
- Indian mobile numbers are 10 digits (may start with +91/0). Keep contact name as written.
- Never invent values: use null when unreadable or absent. confidence reflects how legible and complete the row is.`;

@ApiTags('ai')
@Roles('BROKER_ADMIN', 'BROKER_AGENT')
@Controller('ai')
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly usage: UsageService,
    private readonly media: MediaService,
    private readonly listings: ListingsService,
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
    const text = await this.ai.vision(body.image, `${SCAN_PROMPT}${body.hint ? `\nHint from broker: ${body.hint}` : ''}`, { feature: 'scanner', orgId, userId: user.id, json: true, maxTokens: 4000 });
    const parsed = parseJsonLoose<{ rows?: any[]; rawText?: string }>(text);
    const locs = await this.localityIndex();
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const rows = (parsed.rows ?? []).map((r) => {
      const loc = this.matchLocality(locs, r.sector ?? r.society);
      const rent = num(r.rentInr ?? r.priceInr);
      return {
        purpose: 'RENT',
        propertyType: RENTABLE_TYPES.includes(r.propertyType) ? r.propertyType : 'APARTMENT',
        localityId: loc?.id ?? null,
        localityName: loc?.name ?? r.sector ?? null,
        societyName: r.society ?? null,
        unit: r.unit ?? null,
        floor: num(r.floor),
        bedrooms: num(r.bedrooms),
        area: num(r.areaSqft),
        price: rent,
        securityDeposit: num(r.depositInr),
        brokerageType: BROKERAGE_TYPES.includes(r.brokerage) ? r.brokerage : null,
        brokerageAmount: r.brokerage === 'FIXED' ? num(r.brokerageInr) : null,
        availableFrom: typeof r.availableFrom === 'string' ? r.availableFrom : null,
        furnishing: ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'].includes(r.furnishing) ? r.furnishing : null,
        contactName: r.contactName ?? null,
        contactPhone: r.contactPhone ? normalizeIndianPhone(r.contactPhone) ?? r.contactPhone : null,
        notes: r.notes ?? null,
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.6,
        page: body.page ?? 1,
      };
    });
    const imageUrl = await this.media.uploadDataUrl(body.image, 'scan', orgId).catch(() => null);
    return { rows, rawText: typeof parsed.rawText === 'string' ? parsed.rawText : null, page: body.page ?? 1, imageUrl };
  }

  /** Imports scanned rows into the broker's inventory — as private drafts, or straight into the admin approval queue. */
  @Post('scan/import')
  async importRows(@CurrentUser() user: RequestUser, @Body(new ZodPipe(z.object({ rows: z.array(rowSchema).min(1).max(100), submit: z.boolean().default(false) }))) body: any) {
    const orgId = requireOrg(user);
    const status = body.submit ? 'PENDING_REVIEW' : 'DRAFT';
    if (body.submit) {
      const active = await this.prisma.listing.count({ where: { organizationId: orgId, status: { in: ['ACTIVE', 'PENDING_REVIEW'] }, deletedAt: null } });
      await this.usage.assert(orgId, 'activeListings', active, body.rows.length);
    }
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
      const title = `${r.bedrooms ? `${r.bedrooms} BHK ` : ''}${r.propertyType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())} for Rent in ${loc.name}${r.societyName ? `, ${r.societyName}` : ''}`;
      const l = await this.prisma.listing.create({
        data: {
          slug: `${slugify(title)}-${shortCode(6).toLowerCase()}`,
          purpose: 'RENT',
          propertyType: r.propertyType,
          category: PROPERTY_TYPE_CATEGORY[r.propertyType as keyof typeof PROPERTY_TYPE_CATEGORY],
          status,
          title,
          description: [r.unit ? `Unit: ${r.unit}` : null, r.notes].filter(Boolean).join('\n') || null,
          localityId: r.localityId,
          societyName: r.societyName,
          floor: r.floor,
          bedrooms: r.bedrooms,
          superArea: r.area,
          price: r.price,
          pricePerSqft: pricePerSqft(r.price, r.area),
          securityDeposit: r.securityDeposit ?? null,
          brokerageType: r.brokerageType ?? null,
          brokerageAmount: r.brokerageType === 'FIXED' ? r.brokerageAmount ?? null : null,
          availableFrom: r.availableFrom && !Number.isNaN(Date.parse(r.availableFrom)) ? new Date(r.availableFrom) : null,
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
    if (status === 'PENDING_REVIEW' && created.length) await this.listings.notifyReviewers({ id: created[0], title: `${created.length} scanned listing(s) — approval pending` });
    return { created: created.length, ids: created, errors, status };
  }
}
