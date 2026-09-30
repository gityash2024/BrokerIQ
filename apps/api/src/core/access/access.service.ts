import { HttpStatus, Injectable } from '@nestjs/common';
import type { BlockKind } from '@prisma/client';
import { ErrorCode, ORG_RESTRICTIONS, USER_RESTRICTIONS, normalizeIndianPhone, type OrgRestriction, type UserRestriction } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions';
import type { RequestUser } from '../../common/decorators';

const TTL_MS = 60_000;

/**
 * BrokerIQ's access controls beyond roles:
 *  - blocklist: banned emails / email domains / phones / IPs (signup, OTP, enquiries, contact reveal);
 *  - restrictions: single abilities switched off for a user or a whole broker firm (post, chat, ai…).
 */
@Injectable()
export class AccessService {
  private cache: { at: number; rows: Map<BlockKind, Set<string>> } | null = null;
  constructor(private readonly prisma: PrismaService) {}

  static normalize(kind: BlockKind, value: string) {
    const v = value.trim().toLowerCase();
    if (kind === 'PHONE') return normalizeIndianPhone(v) ?? v.replace(/\D/g, '');
    if (kind === 'DOMAIN') return v.replace(/^@/, '').replace(/^https?:\/\//, '').split('/')[0];
    return v;
  }

  private async blocklist() {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.rows;
    const rows = await this.prisma.blocklist.findMany({ select: { kind: true, value: true } }).catch(() => []);
    const map = new Map<BlockKind, Set<string>>();
    for (const r of rows) map.set(r.kind, (map.get(r.kind) ?? new Set()).add(r.value));
    this.cache = { at: Date.now(), rows: map };
    return map;
  }

  invalidate() {
    this.cache = null;
  }

  /** Which of the given identities is banned (null when none). */
  async blocked(id: { email?: string | null; phone?: string | null; ip?: string | null }) {
    const list = await this.blocklist();
    const email = id.email?.trim().toLowerCase();
    if (email && list.get('EMAIL')?.has(email)) return 'EMAIL';
    if (email && list.get('DOMAIN')?.has(email.split('@')[1] ?? '')) return 'DOMAIN';
    const phone = id.phone ? AccessService.normalize('PHONE', id.phone) : null;
    if (phone && list.get('PHONE')?.has(phone)) return 'PHONE';
    if (id.ip && list.get('IP')?.has(id.ip.trim())) return 'IP';
    return null;
  }

  async assertNotBlocked(id: { email?: string | null; phone?: string | null; ip?: string | null }) {
    if (await this.blocked(id)) throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'यह account या नंबर BrokerIQ पर इस्तेमाल नहीं हो सकता। Support से संपर्क करें।', { blocked: true });
  }

  /** Throws when BrokerIQ switched this ability off for the user or their firm. Super Admin is never limited. */
  async assertAllowed(user: RequestUser | undefined | null, ability: UserRestriction | OrgRestriction) {
    if (!user || user.role === 'SUPER_ADMIN') return;
    const u = await this.prisma.user.findUnique({ where: { id: user.id }, select: { restrictions: true, organization: { select: { restrictions: true } } } });
    const own = (u?.restrictions ?? []).includes(ability);
    const firm = (u?.organization?.restrictions ?? []).includes(ability);
    if (own || firm) {
      const label = (USER_RESTRICTIONS as Record<string, string>)[ability] ?? (ORG_RESTRICTIONS as Record<string, string>)[ability] ?? ability;
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, `BrokerIQ ने ${firm ? 'आपकी firm' : 'आपके account'} के लिए "${label}" बंद किया है। Support से संपर्क करें।`, { restriction: ability });
    }
  }
}
