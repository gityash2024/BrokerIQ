import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { formatINR } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import { FeaturesService } from '../../core/features/features.service';
import { randomToken } from '../../common/utils';
import { env } from '../../config/env';

const web = () => env().PUBLIC_WEB_URL.replace(/\/$/, '');
/** "Rahul Sharma" → "Rahul S." — owners see that someone enquired, never the tenant's contact details. */
const maskName = (n: string) => {
  const [first, last] = n.trim().split(/\s+/);
  return `${first ?? 'Tenant'}${last ? ` ${last[0]}.` : ''}`;
};

/** Read-only page for a property owner: how the broker is marketing their property (views, enquiries, visits). */
@Injectable()
export class OwnerReportService {
  private readonly logger = new Logger(OwnerReportService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly features: FeaturesService,
  ) {}

  private async owner(orgId: string, ownerId: string) {
    const o = await this.prisma.owner.findFirst({ where: { id: ownerId, organizationId: orgId } });
    if (!o) throw new NotFoundException('Owner नहीं मिला');
    return o;
  }

  /** Creates (or replaces, which invalidates the old link) the owner's report link. */
  async createLink(orgId: string, ownerId: string) {
    await this.owner(orgId, ownerId);
    const o = await this.prisma.owner.update({ where: { id: ownerId }, data: { reportToken: randomToken(18) } });
    return { url: `${web()}/o/${o.reportToken}`, weeklyReport: o.weeklyReport };
  }

  async revoke(orgId: string, ownerId: string) {
    await this.owner(orgId, ownerId);
    await this.prisma.owner.update({ where: { id: ownerId }, data: { reportToken: null, weeklyReport: false } });
    return { ok: true };
  }

  async setWeekly(orgId: string, ownerId: string, on: boolean) {
    const o = await this.owner(orgId, ownerId);
    if (on && !o.email) throw new BadRequestException('Weekly report के लिए owner का email जोड़ें');
    const data = on && !o.reportToken ? { weeklyReport: true, reportToken: randomToken(18) } : { weeklyReport: on };
    const u = await this.prisma.owner.update({ where: { id: ownerId }, data });
    return { weeklyReport: u.weeklyReport, url: u.reportToken ? `${web()}/o/${u.reportToken}` : null };
  }

  async view(token: string) {
    if (!(await this.features.isEnabled('owner_reports'))) throw new NotFoundException();
    const o = await this.prisma.owner.findUnique({
      where: { reportToken: token },
      include: { organization: { select: { name: true, slug: true, logoUrl: true, phone: true, whatsapp: true, status: true } } },
    });
    if (!o || o.organization.status !== 'ACTIVE') throw new NotFoundException('यह link बंद हो चुका है');
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const listings = await this.prisma.listing.findMany({
      where: { ownerId: o.id, organizationId: o.organizationId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        price: true,
        coverUrl: true,
        views: true,
        enquiryCount: true,
        publishedAt: true,
        locality: { select: { name: true } },
      },
    });
    const ids = listings.map((l) => l.id);
    const [visits, enquiries, shareOpens, tenancies] = await Promise.all([
      this.prisma.siteVisit.findMany({
        where: { listingId: { in: ids } },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
        select: { listingId: true, scheduledAt: true, status: true, rating: true },
      }),
      this.prisma.enquiry.findMany({
        where: { listingId: { in: ids }, createdAt: { gte: since30 } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { listingId: true, name: true, createdAt: true, wantsVisit: true },
      }),
      this.prisma.shareLink.groupBy({ by: ['listingId'], where: { listingId: { in: ids } }, _sum: { opens: true } }),
      this.prisma.tenancy.findMany({
        where: { ownerId: o.id, status: 'ACTIVE' },
        select: { listingId: true, rent: true, startDate: true, endDate: true, tenantName: true },
      }),
    ]);
    return {
      owner: { name: o.name },
      firm: { name: o.organization.name, slug: o.organization.slug, logoUrl: o.organization.logoUrl, phone: o.organization.whatsapp ?? o.organization.phone },
      generatedAt: new Date(),
      listings: listings.map((l) => {
        const lv = visits.filter((v) => v.listingId === l.id);
        return {
          ...l,
          locality: l.locality.name,
          shareOpens: shareOpens.find((s) => s.listingId === l.id)?._sum.opens ?? 0,
          visitsDone: lv.filter((v) => v.status === 'COMPLETED').length,
          visitsUpcoming: lv.filter((v) => ['SCHEDULED', 'CONFIRMED'].includes(v.status) && v.scheduledAt > new Date()).length,
          enquiries30d: enquiries.filter((e) => e.listingId === l.id).length,
          tenancy: tenancies.find((t) => t.listingId === l.id) ?? null,
        };
      }),
      recentEnquiries: enquiries.slice(0, 15).map((e) => ({ name: maskName(e.name), at: e.createdAt, wantsVisit: e.wantsVisit, listingId: e.listingId })),
      recentVisits: visits.slice(0, 15),
    };
  }

  // ------------------------------------------------------------------ weekly email (Monday 10:00 IST)
  @Cron('0 30 4 * * 1')
  async weekly() {
    if (!env().JOBS_ENABLED || !(await this.features.isEnabled('owner_reports'))) return;
    const owners = await this.prisma.owner.findMany({
      where: { weeklyReport: true, email: { not: null }, reportToken: { not: null }, organization: { status: 'ACTIVE' } },
      take: 2000,
    });
    let sent = 0;
    for (const o of owners) {
      try {
        const v = await this.view(o.reportToken!);
        if (!v.listings.length) continue;
        const rows = v.listings
          .map(
            (l) =>
              `<tr><td style="padding:6px 8px">${escape(l.title)}</td><td style="padding:6px 8px">${formatINR(l.price)}</td><td style="padding:6px 8px">${l.views}</td><td style="padding:6px 8px">${l.enquiries30d}</td><td style="padding:6px 8px">${l.visitsDone}</td></tr>`,
          )
          .join('');
        await this.mail.send({
          to: o.email!,
          subject: `${v.firm.name}: आपकी property का हफ़्ते का हाल`,
          html:
            `<p>नमस्ते ${escape(o.name)},</p><p>${escape(v.firm.name)} आपकी property को ऐसे promote कर रहा है:</p>` +
            `<table style="border-collapse:collapse;font-size:14px"><tr style="background:#eef2ff"><th style="padding:6px 8px;text-align:left">Property</th><th style="padding:6px 8px">Rent</th><th style="padding:6px 8px">Views</th><th style="padding:6px 8px">Enquiries (30 दिन)</th><th style="padding:6px 8px">Visits</th></tr>${rows}</table>` +
            `<p><a href="${web()}/o/${o.reportToken}">पूरी report देखें</a></p>`,
        });
        sent++;
      } catch (e) {
        this.logger.warn(`owner weekly ${o.id}: ${(e as Error).message}`);
      }
    }
    if (sent) this.logger.log(`owner weekly reports sent: ${sent}`);
  }
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
