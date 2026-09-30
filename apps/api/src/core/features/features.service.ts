import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, GROWTH_FEATURES, featureDefault, featureName } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions';

const TTL_MS = 30_000;

/** Super Admin feature switches (FeatureFlag rows). A missing row uses the feature's default. Cached briefly; admin edits clear the cache. */
@Injectable()
export class FeaturesService {
  private cache: { at: number; flags: Map<string, boolean> } | null = null;
  constructor(private readonly prisma: PrismaService) {}

  private async flags() {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.flags;
    const rows = await this.prisma.featureFlag.findMany({ select: { key: true, enabled: true } }).catch(() => []);
    this.cache = { at: Date.now(), flags: new Map(rows.map((r) => [r.key, r.enabled])) };
    return this.cache.flags;
  }

  async isEnabled(key: string) {
    return (await this.flags()).get(key) ?? featureDefault(key);
  }

  async assertEnabled(key: string) {
    if (!(await this.isEnabled(key))) throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FEATURE_DISABLED, `${featureName(key)} अभी बंद है।`, { feature: key });
  }

  /** Rental-only marketplace unless Super Admin switches sale listings on. */
  async rentalOnly() {
    return !(await this.isEnabled('sale_listings'));
  }

  /** All flags as clients should see them: known features with their defaults, overridden by stored rows. */
  async all() {
    const known = Object.fromEntries(GROWTH_FEATURES.map((f) => [f.key, featureDefault(f.key)]));
    return { ...known, ...Object.fromEntries(await this.flags()) } as Record<string, boolean>;
  }

  invalidate() {
    this.cache = null;
  }
}
