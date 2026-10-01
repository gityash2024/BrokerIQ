import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Feature, type RequestUser } from '../../common/decorators';
import { env } from '../../config/env';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 7 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
/** Thank-you levels shown on the profile (recognition only — no money). */
export const referralBadge = (signups: number) => (signups >= 20 ? 'Champion' : signups >= 5 ? 'Connector' : signups >= 1 ? 'Helper' : null);

/** "दोस्तों को बुलाएँ": personal invite link + how many friends joined / moved in through it. */
@ApiTags('referrals')
@Feature('referrals')
@Controller('me/referral')
export class ReferralsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async mine(@CurrentUser() user: RequestUser) {
    let code = (await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { referralCode: true } })).referralCode;
    for (let i = 0; !code && i < 5; i++) {
      // A clash on the unique code just means "try another".
      code = await this.prisma.user
        .update({ where: { id: user.id }, data: { referralCode: newCode() }, select: { referralCode: true } })
        .then((u) => u.referralCode)
        .catch(() => null);
    }
    const friends = await this.prisma.user.findMany({ where: { referredById: user.id, deletedAt: null }, select: { id: true } });
    const ids = friends.map((f) => f.id);
    const [visited, movedIn] = ids.length
      ? await Promise.all([
          this.prisma.siteVisit.findMany({ where: { tenantUserId: { in: ids } }, distinct: ['tenantUserId'], select: { tenantUserId: true } }),
          this.prisma.tenancy.findMany({ where: { tenantUserId: { in: ids } }, distinct: ['tenantUserId'], select: { tenantUserId: true } }),
        ])
      : [[], []];
    return {
      code,
      url: `${env().PUBLIC_WEB_URL.replace(/\/$/, '')}/signup?ref=${code}`,
      signups: ids.length,
      visited: visited.length,
      movedIn: movedIn.length,
      badge: referralBadge(ids.length),
    };
  }
}
