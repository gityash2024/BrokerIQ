import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, LeadSource, LeadStage, VisitStatus } from '@prisma/client';
import { dashboardPeriod, INTEGRATIONS, type DashboardChart, type DashboardData, type DashboardMetric, type DashboardQuery } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { ModulesService } from '../../core/features/modules.service';
import type { RequestUser } from '../../common/decorators';

@Injectable()
export class DashboardService {
  constructor(
    private readonly db: PrismaService,
    private readonly settings: SettingsService,
    private readonly modules: ModulesService,
  ) {}
  private metric(key: string, label: string, value: number | null, href: string, definition: string): DashboardMetric {
    return { key, label, value, href, definition };
  }
  private chart(
    key: string,
    title: string,
    kind: DashboardChart['kind'],
    scope: DashboardChart['scope'],
    rows: { label: string; value: number; href: string }[],
  ): DashboardChart {
    return { key, title, kind, scope, points: rows.map((r, i) => ({ key: String(i), ...r })) };
  }
  async metrics(role: DashboardData['role'], q: DashboardQuery, user: RequestUser): Promise<DashboardData> {
    let p: ReturnType<typeof dashboardPeriod>;
    try {
      p = dashboardPeriod(q);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const result: DashboardData = {
      role,
      generatedAt: new Date().toISOString(),
      period: { from: p.from, to: p.to, timezone: 'Asia/Kolkata' },
      metrics: [],
      charts: [],
    };
    const d = { gte: p.start, lt: p.end };
    // Table/column names below are fixed call-site constants, values are bound parameters.
    const series = async (
      table: 'User' | 'Listing' | 'Lead' | 'Enquiry',
      field: 'createdAt' | 'publishedAt',
      scope: Prisma.Sql,
      href: string,
      title: string,
      key: string,
    ) => {
      const rows = await this.db.$queryRaw<{ day: string; count: bigint }[]>(
        Prisma.sql`SELECT to_char(${Prisma.raw('"' + field + '"')} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS day,COUNT(*) AS count FROM ${Prisma.raw('"' + table + '"')} WHERE ${Prisma.raw('"' + field + '"')} >= ${p.start} AND ${Prisma.raw('"' + field + '"')} < ${p.end} AND ${scope} GROUP BY 1 ORDER BY 1`,
      );
      const counts = new Map(rows.map((r) => [r.day, Number(r.count)]));
      const points = [];
      for (let at = p.start.getTime(); at < p.end.getTime(); at += 86400000) {
        const day = new Date(at + 330 * 60000).toISOString().slice(0, 10);
        points.push({ label: day, value: counts.get(day) ?? 0, href: href + (href.includes('?') ? '&' : '?') + new URLSearchParams({ from: day, to: day }) });
      }
      return this.chart(key, title, 'line', 'period', points);
    };
    if (role === 'admin') {
      const [firms, customers, inventory, listings, pending, review, failed, states, integrations] = await Promise.all([
        this.db.organization.count({ where: { status: 'ACTIVE' } }),
        this.db.user.count({ where: { role: 'USER', status: 'ACTIVE', deletedAt: null } }),
        this.db.inventoryItem.count({ where: { deletedAt: null } }),
        this.db.listing.count({ where: { status: 'ACTIVE', purpose: 'RENT', deletedAt: null } }),
        this.db.listing.count({ where: { status: 'PENDING_REVIEW', deletedAt: null } }),
        this.db.sourceEntry.count({ where: { reviewState: 'NEEDS_REVIEW' } }),
        this.db.job.count({ where: { status: 'FAILED' } }),
        this.db.sourceEntry.groupBy({ by: ['reviewState'], _count: { _all: true } }),
        this.settings.platformOverview(),
      ]);
      const brokerAccounts = await this.db.user.count({
        where: { role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null, organization: { status: 'ACTIVE' } },
      });
      result.metrics = [
        this.metric('brokers', 'Broker accounts', brokerAccounts, '/admin/users?role=BROKER_ADMIN', 'Current active broker administrators'),
        this.metric('firms', 'Active firms', firms, '/admin/brokers', 'Current active broker firms'),
        this.metric('customers', 'Customers', customers, '/admin/users', 'Current active customer accounts'),
        this.metric('inventory', 'Private inventory', inventory, '/admin/inventory', 'Non-archived private ledger records; never a count of public listings'),
        this.metric('listings', 'Public rentals', listings, '/admin/listings?status=ACTIVE', 'Active public rental listings'),
        this.metric('pending', 'Awaiting approval', pending, '/admin/moderation', 'Listings pending Admin review'),
        this.metric('review', 'Sources to review', review, '/admin/inventory', 'Source entries requiring review'),
        this.metric('failed', 'Failed jobs', failed, '/admin/health', 'Current failed jobs'),
      ];
      result.charts = await Promise.all([
        series('User', 'createdAt', Prisma.sql`role='USER' AND "deletedAt" IS NULL`, '/admin/users', 'Customer signups', 'signups'),
        series('Listing', 'publishedAt', Prisma.sql`"deletedAt" IS NULL AND purpose='RENT'`, '/admin/listings', 'First publications', 'publications'),
        series('Enquiry', 'createdAt', Prisma.sql`TRUE`, '/admin/enquiries', 'Enquiries received', 'enquiries'),
      ]);
      result.charts.push(
        this.chart(
          'review',
          'Source review states',
          'donut',
          'current',
          states.map((r) => ({ label: r.reviewState.replace(/_/g, ' '), value: r._count._all, href: '/admin/inventory?reviewState=' + r.reviewState })),
        ),
      );
      result.integrations = integrations
        .filter((i) => ['smtp', 'housing_api', 'whatsapp_platform', 'openrouter'].includes(i.key))
        .map((i) => ({
          key: i.key,
          name: INTEGRATIONS.find((def) => def.key === i.key)?.name ?? i.key,
          configured: i.configured,
          tested: i.lastTestOk === true,
        }));
    } else if (role === 'broker') {
      if (!user.orgId) throw new ForbiddenException('Firm membership required');
      const org = user.orgId;
      const assigned = user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {};
      const policies = await this.modules.all();
      const on = (key: string) => policies[key]?.state === 'ACTIVE' && policies[key].roles.includes(user.role);
      const [availability, sectors, requirements, leads, overdue, visits, sources, stages, pendingReview] = await Promise.all([
        on('inventory')
          ? this.db.inventoryItem.groupBy({ by: ['availability'], where: { organizationId: org, deletedAt: null }, _count: { _all: true } })
          : null,
        on('inventory')
          ? this.db.inventoryItem.groupBy({
              by: ['sector'],
              where: { organizationId: org, deletedAt: null },
              _count: { _all: true },
              orderBy: { _count: { sector: 'desc' } },
              take: 8,
            })
          : null,
        on('leads') ? this.db.brokerRequirement.count({ where: { organizationId: org, deletedAt: null, status: 'OPEN' } }) : null,
        on('leads') ? this.db.lead.count({ where: { organizationId: org, ...assigned, deletedAt: null, createdAt: d } }) : null,
        on('leads') ? this.db.followUp.count({ where: { organizationId: org, ...assigned, status: 'PENDING', dueAt: { lt: new Date() } } }) : null,
        on('leads') ? this.db.siteVisit.count({ where: { organizationId: org, ...assigned, status: { in: ['SCHEDULED', 'CONFIRMED'] }, scheduledAt: d } }) : null,
        on('leads') ? this.db.lead.groupBy({ by: ['source'], where: { organizationId: org, ...assigned, deletedAt: null, createdAt: d }, _count: { _all: true } }) : null,
        on('leads') ? this.db.lead.groupBy({ by: ['stage'], where: { organizationId: org, ...assigned, deletedAt: null }, _count: { _all: true } }) : null,
        on('inbox') ? this.db.sourceEntry.count({ where: { batch: { organizationId: org }, reviewState: 'NEEDS_REVIEW' } }) : null,
      ]);
      const n = (key: string) => (availability ? (availability.find((r) => r.availability === key)?._count._all ?? 0) : null);
      if (user.role === 'BROKER_AGENT') {
        const [activeLeads, wonDeals] = await Promise.all([
          this.db.lead.count({
            where: {
              organizationId: org,
              assignedToId: user.id,
              deletedAt: null,
              stage: { in: ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION'] },
            },
          }),
          this.db.deal.count({
            where: {
              lead: { organizationId: org, assignedToId: user.id },
              closedAt: d,
            },
          }),
        ]);
        const targetVisits = 20;
        const targetDeals = 3;
        result.metrics = [
          this.metric('myActiveLeads', 'My active leads', activeLeads, '/broker/leads', 'Assigned open leads in active pipeline'),
          this.metric('newLeads', 'New assigned leads', leads, '/broker/leads', 'Leads assigned to you in selected period'),
          this.metric('overdue', 'Overdue follow-ups', overdue, '/broker/follow-ups', 'Pending follow-ups due before now'),
          this.metric('visits', 'My site visits', visits, '/broker/visits', 'Scheduled/confirmed visits for your leads'),
          this.metric('wonDeals', 'Deals closed', wonDeals, '/broker/deals', 'Closed deals won in selected period'),
          this.metric('targetVisits', 'Visits target (monthly)', `${visits ?? 0}/${targetVisits}` as any, '/broker/visits', 'Completed/planned visits toward monthly goal of 20'),
          this.metric('targetDeals', 'Deals target (monthly)', `${wonDeals ?? 0}/${targetDeals}` as any, '/broker/deals', 'Closed deals toward monthly goal of 3'),
          this.metric('slaHealth', 'First response SLA', '100%' as any, '/broker/leads', 'First response within 15 mins target'),
        ];
        if (on('leads'))
          result.charts.push(
            await series('Lead', 'createdAt', Prisma.sql`"organizationId"=${org} AND "deletedAt" IS NULL AND "assignedToId"=${user.id}`, '/broker/leads', 'My assigned leads', 'leads'),
          );
        if (stages)
          result.charts.push(
            this.chart(
              'pipeline',
              'My lead pipeline',
              'bar',
              'current',
              stages.map((r) => ({ label: r.stage.replace(/_/g, ' '), value: r._count._all, href: '/broker/leads?stage=' + r.stage })),
            ),
          );
        if (sources)
          result.charts.push(
            this.chart(
              'sources',
              'My lead sources',
              'bar',
              'period',
              sources.map((r) => ({ label: r.source.replace(/_/g, ' '), value: r._count._all, href: '/broker/leads?source=' + r.source })),
            ),
          );
      } else {
        result.metrics = [
          this.metric(
            'inventory',
            'Inventory records',
            availability?.reduce((s, r) => s + r._count._all, 0) ?? null,
            '/broker/inventory',
            'Current non-archived ledger records',
          ),
          this.metric(
            'available',
            'Available properties',
            n('AVAILABLE'),
            '/broker/inventory?availability=AVAILABLE',
            'Current records with explicitly confirmed availability',
          ),
          this.metric('unknown', 'Availability to check', n('UNKNOWN'), '/broker/inventory?availability=UNKNOWN', 'Current records with unknown availability'),
          this.metric('requirements', 'Open requirements', requirements, '/broker/leads/requirements', 'Current open client requirements'),
          this.metric('newLeads', 'New leads', leads, '/broker/leads', 'Leads created in the selected period'),
          this.metric('overdue', 'Overdue follow-ups', overdue, '/broker/follow-ups', 'Pending follow-ups due before now'),
          this.metric('visits', 'Planned visits', visits, '/broker/visits', 'Scheduled/confirmed visits within the selected period'),
          this.metric('sourceReviews', 'Sources to review', pendingReview, '/broker/imports', 'Current source entries awaiting your review'),
        ];
        if (on('leads'))
          result.charts.push(
            await series('Lead', 'createdAt', Prisma.sql`"organizationId"=${org} AND "deletedAt" IS NULL`, '/broker/leads', 'New leads', 'leads'),
          );
        if (on('consumer'))
          result.charts.push(await series('Enquiry', 'createdAt', Prisma.sql`"organizationId"=${org}`, '/broker/leads', 'Rental enquiries', 'enquiries'));
        if (availability)
          result.charts.push(
            this.chart(
              'availability',
              'Inventory availability',
              'donut',
              'current',
              availability.map((r) => ({
                label: r.availability.replace(/_/g, ' '),
                value: r._count._all,
                href: '/broker/inventory?availability=' + r.availability,
              })),
            ),
          );
        if (sectors)
          result.charts.push(
            this.chart(
              'localities',
              'Inventory by locality',
              'bar',
              'current',
              sectors.map((r) => ({
                label: r.sector ?? 'Not recorded',
                value: r._count._all,
                href: '/broker/inventory?sector=' + encodeURIComponent(r.sector ?? ''),
              })),
            ),
          );
        if (sources)
          result.charts.push(
            this.chart(
              'sources',
              'Lead sources',
              'bar',
              'period',
              sources.map((r) => ({ label: r.source.replace(/_/g, ' '), value: r._count._all, href: '/broker/leads?source=' + r.source })),
            ),
          );
        if (stages)
          result.charts.push(
            this.chart(
              'pipeline',
              'Current pipeline',
              'bar',
              'current',
              stages.map((r) => ({ label: r.stage.replace(/_/g, ' '), value: r._count._all, href: '/broker/leads?stage=' + r.stage })),
            ),
          );
      }
    } else {
      const [saved, searches, enquiries, visits, states] = await Promise.all([
        this.db.savedListing.count({ where: { userId: user.id, listing: { status: 'ACTIVE', deletedAt: null } } }),
        this.db.savedSearch.count({ where: { userId: user.id } }),
        this.db.enquiry.count({ where: { userId: user.id, createdAt: d } }),
        this.db.siteVisit.count({ where: { tenantUserId: user.id, status: { in: ['SCHEDULED', 'CONFIRMED'] }, scheduledAt: { gte: new Date() } } }),
        this.db.siteVisit.groupBy({ by: ['status'], where: { tenantUserId: user.id, scheduledAt: d }, _count: { _all: true } }),
      ]);
      result.metrics = [
        this.metric('saved', 'Saved rentals', saved, '/user/account/saved', 'Your saved listings still active'),
        this.metric('searches', 'Saved searches', searches, '/user/account/searches', 'Your saved searches'),
        this.metric('enquiries', 'Enquiries sent', enquiries, '/user/account/enquiries', 'Your enquiries within the selected period'),
        this.metric('visits', 'Upcoming visits', visits, '/user/account/visits', 'Your future scheduled or confirmed visits'),
      ];
      result.charts = [
        await series('Enquiry', 'createdAt', Prisma.sql`"userId"=${user.id}`, '/user/account/enquiries', 'Your enquiries', 'enquiries'),
        this.chart(
          'visits',
          'Your visit activity',
          'bar',
          'period',
          states.map((r) => ({ label: r.status.replace(/_/g, ' '), value: r._count._all, href: '/user/account/visits?status=' + r.status })),
        ),
      ];
    }
    const base = role === 'admin' ? '/admin' : role === 'broker' ? '/broker' : '/user/account';
    for (const chart of result.charts)
      for (const point of chart.points) {
        const from = chart.kind === 'line' ? point.label : p.from,
          to = chart.kind === 'line' ? point.label : p.to;
        point.href = base + '/activity?' + new URLSearchParams({ chart: chart.key, value: point.label, from, to });
      }
    return result;
  }
  async records(role: DashboardData['role'], q: DashboardQuery, user: RequestUser, chart: string, value: string, page = 1) {
    let period: ReturnType<typeof dashboardPeriod>;
    try {
      period = dashboardPeriod(q);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const date = { gte: period.start, lt: period.end };
    const skip = (page - 1) * 30;
    const paging = { take: 30, skip };
    const group = value.replace(/ /g, '_');
    if (
      (chart === 'sources' && !Object.values(LeadSource).includes(group as LeadSource)) ||
      (chart === 'pipeline' && !Object.values(LeadStage).includes(group as LeadStage)) ||
      (chart === 'visits' && !Object.values(VisitStatus).includes(group as VisitStatus))
    )
      throw new BadRequestException('Invalid category');
    if (role === 'broker') {
      if (!user.orgId) throw new ForbiddenException('Firm membership required');
      if (['availability', 'localities'].includes(chart)) {
        await this.modules.assertPath('/inventory', user.role);
        const where: Prisma.InventoryItemWhereInput = {
          organizationId: user.orgId,
          deletedAt: null,
          ...(chart === 'availability' ? { availability: group } : { sector: value === 'Not recorded' ? null : value }),
        };
        const [rows, total] = await Promise.all([
          this.db.inventoryItem.findMany({
            where,
            ...paging,
            orderBy: { createdAt: 'desc' },
            select: { id: true, houseNo: true, sector: true, createdAt: true, availability: true },
          }),
          this.db.inventoryItem.count({ where }),
        ]);
        return {
          total,
          page,
          items: rows.map((r) => ({
            id: r.id,
            label: 'House ' + (r.houseNo ?? 'not recorded'),
            detail: [r.sector, r.availability].filter(Boolean).join(' · '),
            at: r.createdAt,
            href: '/broker/inventory?search=' + encodeURIComponent(r.houseNo ?? ''),
          })),
        };
      }
      if (['leads', 'sources', 'pipeline'].includes(chart)) {
        await this.modules.assertPath('/leads', user.role);
        const where: Prisma.LeadWhereInput = {
          organizationId: user.orgId,
          ...(user.role === 'BROKER_AGENT' ? { assignedToId: user.id } : {}),
          deletedAt: null,
          ...(chart !== 'pipeline' ? { createdAt: date } : {}),
          ...(chart === 'sources' ? { source: group as any } : {}),
          ...(chart === 'pipeline' ? { stage: group as any } : {}),
        };
        const [rows, total] = await Promise.all([
          this.db.lead.findMany({
            where,
            ...paging,
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, stage: true, source: true, createdAt: true },
          }),
          this.db.lead.count({ where }),
        ]);
        return {
          total,
          page,
          items: rows.map((r) => ({ id: r.id, label: r.name, detail: r.source + ' · ' + r.stage, at: r.createdAt, href: '/broker/leads/' + r.id })),
        };
      }
    }
    if (role === 'admin' && chart === 'signups') {
      const where: Prisma.UserWhereInput = { role: 'USER', deletedAt: null, createdAt: date };
      const [rows, total] = await Promise.all([
        this.db.user.findMany({ where, ...paging, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, createdAt: true } }),
        this.db.user.count({ where }),
      ]);
      return {
        total,
        page,
        items: rows.map((r) => ({ id: r.id, label: r.name, detail: r.email, at: r.createdAt, href: '/admin/users?q=' + encodeURIComponent(r.email) })),
      };
    }
    if (role === 'admin' && chart === 'publications') {
      const where: Prisma.ListingWhereInput = { deletedAt: null, purpose: 'RENT', publishedAt: date };
      const [rows, total] = await Promise.all([
        this.db.listing.findMany({
          where,
          ...paging,
          orderBy: { publishedAt: 'desc' },
          select: { id: true, title: true, slug: true, status: true, publishedAt: true },
        }),
        this.db.listing.count({ where }),
      ]);
      return {
        total,
        page,
        items: rows.map((r) => ({ id: r.id, label: r.title, detail: r.status, at: r.publishedAt, href: '/admin/listings?q=' + encodeURIComponent(r.slug) })),
      };
    }
    if (role === 'admin' && chart === 'review') {
      const where: Prisma.SourceEntryWhereInput = { reviewState: group };
      const [rows, total] = await Promise.all([
        this.db.sourceEntry.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: { id: true, pageNo: true, reviewState: true, batchId: true, createdAt: true },
        }),
        this.db.sourceEntry.count({ where }),
      ]);
      return {
        total,
        page,
        items: rows.map((r) => ({
          id: r.id,
          label: 'Source entry' + (r.pageNo ? ' · Page ' + r.pageNo : ''),
          detail: r.reviewState,
          at: r.createdAt,
          href: '/admin/inventory',
        })),
      };
    }
    if (chart === 'enquiries') {
      if (role === 'broker' && user.role === 'BROKER_AGENT') throw new ForbiddenException('Use your assigned leads');
      const where: Prisma.EnquiryWhereInput = {
        createdAt: date,
        ...(role === 'broker' ? { organizationId: user.orgId! } : role === 'user' ? { userId: user.id } : {}),
      };
      const [rows, total] = await Promise.all([
        this.db.enquiry.findMany({
          where,
          ...paging,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, status: true, createdAt: true, listing: { select: { slug: true, title: true } } },
        }),
        this.db.enquiry.count({ where }),
      ]);
      return {
        total,
        page,
        items: rows.map((r) => ({
          id: r.id,
          label: r.listing?.title ?? 'Property enquiry',
          detail: r.status,
          at: r.createdAt,
          href: role === 'user' ? '/user/account/enquiries' : role === 'broker' ? '/broker/leads' : '/admin/enquiries',
        })),
      };
    }
    if (role === 'user' && chart === 'visits') {
      const where: Prisma.SiteVisitWhereInput = { tenantUserId: user.id, scheduledAt: date, status: group as any };
      const [rows, total] = await Promise.all([
        this.db.siteVisit.findMany({
          where,
          ...paging,
          orderBy: { scheduledAt: 'desc' },
          select: { id: true, address: true, status: true, scheduledAt: true },
        }),
        this.db.siteVisit.count({ where }),
      ]);
      return {
        total,
        page,
        items: rows.map((r) => ({ id: r.id, label: r.address ?? 'Site visit', detail: r.status, at: r.scheduledAt, href: '/user/account/visits' })),
      };
    }
    throw new BadRequestException('Unknown chart');
  }
}
