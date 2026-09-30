import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, featureName } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions';

const TTL_MS = 30_000;

/** Super Admin feature switches (FeatureFlag rows). Missing flag = ON. Cached briefly; admin edits clear the cache. */
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
    return (await this.flags()).get(key) !== false;
  }

  async assertEnabled(key: string) {
    if (!(await this.isEnabled(key))) throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FEATURE_DISABLED, `${featureName(key)} अभी बंद है।`, { feature: key });
  }

  invalidate() {
    this.cache = null;
  }
}
