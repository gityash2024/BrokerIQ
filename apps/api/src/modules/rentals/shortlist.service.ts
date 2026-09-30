import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LISTING_CARD_SELECT } from '../listings/listings.service';
import { randomToken } from '../../common/utils';
import { env } from '../../config/env';

const web = () => env().PUBLIC_WEB_URL.replace(/\/$/, '');
const COMPARE_FIELDS = {
  ...LISTING_CARD_SELECT,
  securityDeposit: true,
  maintenance: true,
  bathrooms: true,
  balconies: true,
  parking: true,
  facing: true,
  ageYears: true,
  availableFrom: true,
  preferredTenants: true,
  amenities: true,
  isVerified: true,
  visitVerifiedAt: true,
} as const;

/** Side-by-side comparison of public listings and a read-only link to a user's saved homes. */
@Injectable()
export class ShortlistService {
  constructor(private readonly prisma: PrismaService) {}

  async compare(ids: string[]) {
    const unique = [...new Set(ids)].slice(0, 4);
    if (unique.length < 2) throw new BadRequestException('कम से कम 2 properties चुनें');
    const rows = await this.prisma.listing.findMany({ where: { id: { in: unique }, status: 'ACTIVE', deletedAt: null }, select: COMPARE_FIELDS });
    return unique.map((id) => rows.find((r) => r.id === id)).filter(Boolean);
  }

  async share(userId: string) {
    const existing = await this.prisma.shortlistShare.findUnique({ where: { userId } });
    const s = existing ?? (await this.prisma.shortlistShare.create({ data: { userId, token: randomToken(12) } }));
    return { url: `${web()}/shortlist/${s.token}`, token: s.token };
  }

  async revoke(userId: string) {
    await this.prisma.shortlistShare.deleteMany({ where: { userId } });
    return { ok: true };
  }

  /** Live view of the owner's saved homes (only public, live listings; nothing about the user except first name). */
  async view(token: string) {
    const s = await this.prisma.shortlistShare.findUnique({ where: { token } });
    if (!s) throw new NotFoundException('यह link बंद हो चुका है');
    await this.prisma.shortlistShare.update({ where: { id: s.id }, data: { opens: { increment: 1 } } });
    const [user, saved] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: s.userId }, select: { name: true } }),
      this.prisma.savedListing.findMany({
        where: { userId: s.userId, listing: { status: 'ACTIVE', deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { listing: { select: LISTING_CARD_SELECT } },
      }),
    ]);
    return { by: user?.name.split(' ')[0] ?? 'Someone', listings: saved.map((x) => x.listing) };
  }
}
