import { Injectable, NotFoundException } from '@nestjs/common';
import type { Furnishing, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const MIN_SAMPLES = 3;
const FURNISHING_MIN = 5;
const CACHE_MS = 10 * 60_000;

/** Linear-interpolated percentile of a sorted array. */
export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
}

/**
 * "Is this rent fair?" — median and middle-50% range of real asking rents over the last 12 months for the same
 * locality + BHK (falls back to the locality's zone when the locality has too few listings). No AI, no guessing:
 * with fewer than 3 comparable listings it says so.
 */
@Injectable()
export class FairRentService {
  private cache = new Map<string, { at: number; value: Awaited<ReturnType<FairRentService['compute']>> }>();
  constructor(private readonly prisma: PrismaService) {}

  async estimate(q: { localityId: string; bedrooms: number; furnishing?: string | null; price?: number | null }) {
    const key = `${q.localityId}|${q.bedrooms}|${q.furnishing ?? ''}`;
    const hit = this.cache.get(key);
    let base: Awaited<ReturnType<FairRentService['compute']>>;
    if (hit && Date.now() - hit.at < CACHE_MS) base = hit.value;
    else {
      base = await this.compute(q);
      this.cache.set(key, { at: Date.now(), value: base });
    }
    let verdict: 'LOW' | 'FAIR' | 'HIGH' | null = null;
    if (base.enough && q.price) verdict = q.price < base.p25 * 0.97 ? 'LOW' : q.price > base.p75 * 1.03 ? 'HIGH' : 'FAIR';
    return { ...base, verdict };
  }

  private async compute(q: { localityId: string; bedrooms: number; furnishing?: string | null }) {
    const locality = await this.prisma.locality.findUnique({ where: { id: q.localityId }, select: { id: true, name: true, zone: true } });
    if (!locality) throw new NotFoundException('Locality नहीं मिली');
    const where = (localityIds: string[]): Prisma.ListingWhereInput => ({
      purpose: 'RENT',
      category: 'RESIDENTIAL',
      deletedAt: null,
      status: { in: ['ACTIVE', 'RENTED', 'EXPIRED', 'ARCHIVED'] },
      createdAt: { gte: new Date(Date.now() - 365 * 86_400_000) },
      bedrooms: q.bedrooms,
      localityId: { in: localityIds },
      price: { gt: 1000 },
    });
    const fetch = (ids: string[]) => this.prisma.listing.findMany({ where: where(ids), select: { price: true, furnishing: true }, take: 2000 });
    let scope: 'LOCALITY' | 'ZONE' = 'LOCALITY';
    let rows = await fetch([locality.id]);
    if (rows.length < MIN_SAMPLES && locality.zone) {
      const zone = await this.prisma.locality.findMany({ where: { zone: locality.zone, isActive: true }, select: { id: true } });
      rows = await fetch(zone.map((z) => z.id));
      scope = 'ZONE';
    }
    let furnishingApplied = false;
    if (q.furnishing) {
      const same = rows.filter((r) => r.furnishing === (q.furnishing as Furnishing));
      if (same.length >= FURNISHING_MIN) {
        rows = same;
        furnishingApplied = true;
      }
    }
    const prices = rows.map((r) => r.price).sort((a, b) => a - b);
    const enough = prices.length >= MIN_SAMPLES;
    return {
      locality: locality.name,
      zone: locality.zone,
      bedrooms: q.bedrooms,
      scope,
      furnishingApplied,
      samples: prices.length,
      enough,
      median: enough ? percentile(prices, 0.5) : 0,
      p25: enough ? percentile(prices, 0.25) : 0,
      p75: enough ? percentile(prices, 0.75) : 0,
    };
  }
}
