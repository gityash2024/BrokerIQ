import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LEAD_SOURCE_LABELS, formatINR, type LeadSource } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { SettingsService } from '../../core/settings/settings.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { env } from '../../config/env';

export interface WeeklySummary {
  leads: number;
  bySource: { source: string; count: number; won: number }[];
  bestSource: string | null;
  medianResponseMin: number | null;
  visits: number;
  deals: number;
  commission: number;
  topListing: { title: string; views: number; enquiries: number } | null;
}

/** Monday-morning summary for each firm: leads by portal, response speed, visits, deals. */
@Injectable()
export class WeeklyReportService {
  private readonly logger = new Logger(WeeklyReportService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly wa: WhatsAppService,
  ) {}

  @Cron('0 0 4 * * 1') // Monday 09:30 IST
  async weekly() {
    if (!env().JOBS_ENABLED) return;
    const orgs = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', weeklyReport: true, leads: { some: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } } },
      select: { id: true },
    });
    for (const o of orgs) await this.send(o.id).catch((e) => this.logger.warn(`weekly ${o.id}: ${(e as Error).message}`));
  }

  async summary(orgId: string, now = new Date()): Promise<WeeklySummary> {
    const since = new Date(now.getTime() - 7 * 86400_000);
    const [leads, visits, deals, top] = await Promise.all([
      this.prisma.lead.findMany({
        where: { organizationId: orgId, createdAt: { gte: since }, deletedAt: null },
        select: { source: true, stage: true, createdAt: true, firstResponseAt: true },
      }),
      this.prisma.siteVisit.count({ where: { organizationId: orgId, scheduledAt: { gte: since, lte: now } } }),
      this.prisma.deal.findMany({ where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: since } }, select: { commissionAmount: true } }),
      this.prisma.listing.findFirst({
        where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null },
        orderBy: [{ enquiryCount: 'desc' }, { views: 'desc' }],
        select: { title: true, views: true, enquiryCount: true },
      }),
    ]);
    const map = new Map<string, { source: string; count: number; won: number }>();
    for (const l of leads) {
      const r = map.get(l.source) ?? { source: l.source, count: 0, won: 0 };
      r.count++;
      if (l.stage === 'WON') r.won++;
      map.set(l.source, r);
    }
    const bySource = [...map.values()].sort((a, b) => b.count - a.count);
    const mins = leads
      .filter((l) => l.firstResponseAt)
      .map((l) => (l.firstResponseAt!.getTime() - l.createdAt.getTime()) / 60_000)
      .filter((m) => m >= 0)
      .sort((a, b) => a - b);
    const best = [...bySource].sort((a, b) => b.won - a.won || b.count - a.count)[0];
    return {
      leads: leads.length,
      bySource,
      bestSource: best ? best.source : null,
      medianResponseMin: mins.length ? Math.round(mins[Math.floor(mins.length / 2)]) : null,
      visits,
      deals: deals.length,
      commission: deals.reduce((s, d) => s + (d.commissionAmount ?? 0), 0),
      topListing: top ? { title: top.title, views: top.views, enquiries: top.enquiryCount } : null,
    };
  }

  text(orgName: string, s: WeeklySummary) {
    const label = (src: string) => LEAD_SOURCE_LABELS[src as LeadSource] ?? src;
    return [
      `📊 ${orgName} — पिछले 7 दिन`,
      `• Leads: ${s.leads}${
        s.bySource.length
          ? ` (${s.bySource
              .slice(0, 4)
              .map((b) => `${label(b.source)} ${b.count}`)
              .join(', ')})`
          : ''
      }`,
      s.bestSource ? `• सबसे अच्छा source: ${label(s.bestSource)}` : null,
      `• औसत पहला जवाब: ${s.medianResponseMin == null ? '—' : s.medianResponseMin < 60 ? `${s.medianResponseMin} मिनट` : `${Math.round(s.medianResponseMin / 60)} घंटे`}`,
      `• Site visits: ${s.visits} · Deals: ${s.deals}${s.commission ? ` · Commission ${formatINR(s.commission)}` : ''}`,
      s.topListing ? `• Top listing: ${s.topListing.title} (${s.topListing.enquiries} enquiries)` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  async send(orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } });
    const s = await this.summary(orgId);
    const text = this.text(org.name, s);
    const link = `${env().PUBLIC_WEB_URL.replace(/\/$/, '')}/broker/analytics`;
    await this.notifications.notifyOrg(
      orgId,
      {
        kind: 'WEEKLY_REPORT',
        title: `📊 हफ़्ते की report: ${s.leads} leads, ${s.deals} deals`,
        body: text.split('\n').slice(1, 3).join(' '),
        link: '/broker/analytics',
      },
      { adminsOnly: true },
    );
    const admins = await this.prisma.user.findMany({
      where: { organizationId: orgId, role: 'BROKER_ADMIN', status: 'ACTIVE' },
      select: { email: true, phone: true, name: true },
    });
    const html = `<pre style="font-family:inherit;white-space:pre-wrap;font-size:14px">${text.replace(/</g, '&lt;')}</pre>`;
    for (const a of admins)
      await this.mail.trySendTemplate('report.weekly', a.email, { orgName: org.name, leads: s.leads, deals: s.deals, summaryHtml: html, link });
    const app = await this.settings.getAppConfig();
    const tpl = app.whatsappTemplates?.weeklyReport;
    if (tpl) {
      for (const a of admins.filter((x) => x.phone)) {
        await this.wa
          .send(
            null,
            a.phone!,
            { type: 'template', name: tpl, language: app.whatsappTemplates.language || 'hi', params: [org.name, String(s.leads), String(s.deals), link] },
            { contactName: a.name },
          )
          .catch((e) => this.logger.warn(`weekly WA ${orgId}: ${(e as Error).message}`));
      }
    }
    return { text, summary: s };
  }
}
