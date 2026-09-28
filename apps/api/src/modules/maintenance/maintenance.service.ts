import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { ListingsService } from '../listings/listings.service';
import { ListingsModule } from '../listings/listings.module';
import { env } from '../../config/env';

/** Periodic housekeeping: listing expiry, saved-search alerts, cleanup. */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly listings: ListingsService,
  ) {}

  @Cron('0 30 3 * * *') // 09:00 IST
  async expireListings() {
    if (!env().JOBS_ENABLED) return;
    const expired = await this.prisma.listing.findMany({ where: { status: 'ACTIVE', expiresAt: { lt: new Date() } }, select: { id: true, title: true, postedById: true, organizationId: true } });
    for (const l of expired) {
      await this.prisma.listing.update({ where: { id: l.id }, data: { status: 'EXPIRED' } });
      await this.notifications.notify(l.postedById, { kind: 'SYSTEM', title: 'Listing expire हो गई', body: `${l.title} — 1 click में renew करें`, link: l.organizationId ? '/broker/listings' : '/account/listings' });
    }
    if (expired.length) this.logger.log(`expired ${expired.length} listings`);
    await this.prisma.otpCode.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400_000) } } });
    await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86400_000) }, readAt: { not: null } } });
  }

  @Cron('0 5 * * * *')
  async savedSearchAlerts() {
    if (!env().JOBS_ENABLED) return;
    const searches = await this.prisma.savedSearch.findMany({ where: { alertsEnabled: true }, include: { user: true }, take: 2000 });
    for (const s of searches) {
      const since = s.lastNotifiedAt ?? s.createdAt;
      const where = { AND: [this.listings.buildWhere(s.filters as any), { publishedAt: { gt: since } }] };
      const count = await this.prisma.listing.count({ where });
      if (!count) continue;
      const qs = new URLSearchParams(
        Object.entries(s.filters as Record<string, any>)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]): [string, string] => [k, String(v)]),
      ).toString();
      const link = `/rent?${qs}`;
      await this.notifications.notify(s.userId, { kind: 'SAVED_SEARCH_MATCH', title: `"${s.name}" में ${count} नई properties`, link });
      await this.mail.trySendTemplate('search.alert', s.user.email, { search: s, count, link: `${env().PUBLIC_WEB_URL}${link}` });
      await this.prisma.savedSearch.update({ where: { id: s.id }, data: { lastNotifiedAt: new Date() } });
    }
  }
}

@Module({ imports: [ListingsModule], providers: [MaintenanceService] })
export class MaintenanceModule {}
