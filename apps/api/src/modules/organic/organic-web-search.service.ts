import { Injectable } from '@nestjs/common';
import { canonicalInventorySector } from '@brokeriq/shared';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { SettingsService } from '../../core/settings/settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganicSourceHttpError, readOrganicSource, sourceEndpoint } from './organic-source';

const plans = {
  SUPPLY: [
    [
      'Owner rentals',
      'Gurugram Gurgaon owner renting out flat house builder floor available for rent',
      'Gurgaon direct owner available for rent apartment builder floor no brokerage DLF Sushant Lok',
    ],
    [
      'Owner sales',
      'Gurugram Gurgaon owner selling resale apartment house plot directly new property listing',
      'Gurgaon Gurugram resale flat for sale posted by owner direct property Sector 57 Sector 65 Dwarka Expressway',
    ],
    [
      'Commercial property',
      'Gurugram Gurgaon owner office shop warehouse commercial space available lease sale',
      'Gurugram commercial space by owner available for lease shop office Golf Course Road Sohna Road',
    ],
    ['Hindi owner posts', 'गुरुग्राम गुड़गांव मकान मालिक फ्लैट किराये पर प्रॉपर्टी बिक्री', 'गुड़गांव मकान मालिक से सीधा फ्लैट बिक्री या किराए पर सेक्टर'],
  ],
  DEMAND: [
    [
      'Property buyers',
      'Gurugram Gurgaon looking to buy apartment floor house plot genuine buyer requirement',
      'Gurgaon need to purchase flat buyer looking for a flat budget requirement Dwarka Expressway New Gurgaon',
    ],
    [
      'Tenant requirements',
      'Gurugram Gurgaon looking for rental flat wanted need furnished apartment moving tenant requirement',
      'Gurgaon tenant looking for 1 BHK 2 BHK flat for rent budget moving Gurgaon Sector',
    ],
    [
      'Commercial requirements',
      'Gurugram Gurgaon looking to rent office shop warehouse tenant commercial space requirement',
      'Gurgaon need warehouse office shop for lease wanted tenant budget commercial requirement',
    ],
    [
      'Hindi buyer and tenant posts',
      'गुरुग्राम गुड़गांव किराये पर घर चाहिए फ्लैट खरीदना है प्रॉपर्टी चाहिए',
      'गुड़गांव सेक्टर फ्लैट किराए पर चाहिए खरीदना है बजट चाहिए',
    ],
  ],
} as const;

const SYNC_LIMIT = 1_000;
const GDELT_INTERVAL_MS = 6_000;
const GDELT_COOLDOWN_MS = 300_000;
const publisherChannels = [
  { label: 'Housing.com public links', domains: ['housing.com'] },
  { label: '99acres public links', domains: ['99acres.com'] },
  {
    label: 'Property portals and project publishers',
    domains: ['magicbricks.com', 'nobroker.in', 'squareyards.com', 'proptiger.com', 'realestateindia.com', 'makaan.com'],
  },
  { label: 'Public classifieds', domains: ['olx.in', 'quikr.com'] },
  { label: 'Public property discussions', domains: ['reddit.com', 'facebook.com'] },
  {
    label: 'Government, bank and developer property notices',
    domains: ['hsvphry.org.in', 'hsiidc.org.in', 'globalcitygurugram.in', 'baanknet.com', 'sbi.co.in', 'eprocure.gov.in'],
  },
];
const searchIntents = {
  SUPPLY: '(owner OR developer) (for sale OR for rent OR available for lease)',
  DEMAND: '(buyer OR tenant OR investor) (looking for OR required OR wanted) (buy OR rent OR lease)',
};
const NOTICE_TERMS = {
  SUPPLY: 'residential or commercial property sale auction lease availability',
  DEMAND: 'property required office space lease purchase procurement notice',
};
// Two nightly workflows fit within the free calendar-month quota even in a 31-day month.
const MAX_TAVILY_QUERIES_PER_RUN = 16;
const SECTORS_PER_QUERY = 20;
const SECTOR_QUERIES_PER_DAY = MAX_TAVILY_QUERIES_PER_RUN - 4 - publisherChannels.length;
const sectorIntents = { SUPPLY: 'owner property sale rent lease', DEMAND: 'buyer tenant purchase rent wanted' };
type SearchQuery = { label: string; query: string; alternate?: string; domains?: string[]; sectors?: string[] };

function distinctSectors(localities: string[]) {
  return [...new Set(localities.filter((name) => /^sec(?:tor)?[ .-]*\d/i.test(name)).map(canonicalInventorySector))]
    .filter((name) => /^Sector \d{1,3}[A-Z]?(?:\/\d{1,2})?$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'en-IN', { numeric: true }));
}

export function sectorSearchBatches(localities: string[], searchDay: Date) {
  const sectors = distinctSectors(localities);
  const total = Math.ceil(sectors.length / SECTORS_PER_QUERY);
  if (!total) return [];
  const offset = (Math.floor(searchDay.valueOf() / 86_400_000) * SECTOR_QUERIES_PER_DAY) % total;
  return Array.from({ length: Math.min(SECTOR_QUERIES_PER_DAY, total) }, (_, index) => {
    const start = ((offset + index) % total) * SECTORS_PER_QUERY;
    return sectors.slice(start, start + SECTORS_PER_QUERY);
  });
}
const gdeltPlans = {
  SUPPLY: '(gurugram OR gurgaon) (property OR housing) (sale OR rental OR lease OR auction) sourcecountry:india',
  DEMAND: '(gurugram OR gurgaon) (homebuyers OR tenants OR "rental demand" OR "housing demand") sourcecountry:india',
};
const gdeltResponse = z.object({
  articles: z
    .array(z.object({ url: z.string(), seendate: z.string().optional() }))
    .max(20)
    .default([]),
});
const discoveryResult = z.object({
  url: z.string().max(1_000),
  published_date: z.string().max(80).nullable().optional(),
});
const discoveryResponse = z.object({ results: z.array(z.unknown()).max(20) });

function citedPages(results: unknown[]) {
  const seen = new Set<string>();
  return results.flatMap((result) => {
    const candidate = discoveryResult.safeParse(result);
    if (!candidate.success) return [];
    const { url, published_date } = candidate.data;
    let source: URL;
    try {
      source = sourceEndpoint(url);
    } catch {
      return [];
    }
    if (!source.hostname.includes('.') || !/[a-z]/i.test(source.hostname.split('.').at(-1) ?? '')) return [];
    source.hash = '';
    // Keep canonical source links free of tracking, sessions and search inputs.
    source.search = '';
    if (seen.has(source.href)) return [];
    seen.add(source.href);
    const timestamp = published_date ? new Date(published_date) : null;
    return [{ url: source.href, domain: source.hostname, indexedDate: timestamp && Number.isFinite(timestamp.valueOf()) ? timestamp.toISOString() : null }];
  });
}

function gdeltTime(value: Date) {
  return value
    .toISOString()
    .slice(0, 19)
    .replace(/[^0-9]/g, '');
}

function gdeltSeenDate(raw: string | undefined) {
  const match = raw?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

@Injectable()
export class OrganicWebSearchService {
  constructor(
    private readonly settings: SettingsService,
    private readonly db: PrismaService,
  ) {}

  async mode() {
    return (await this.settings.resolve('organic_web_search')) ? 'ACCOUNT' : 'KEYLESS';
  }

  async run(runId: string, kind: keyof typeof plans, discoveryDay: string, manual: boolean) {
    const today = new Date(discoveryDay + 'T00:00:00Z');
    const yesterday = new Date(today.valueOf() - 86_400_000).toISOString().slice(0, 10);
    // Tavily's end date is exclusive. Scheduled discovery includes yesterday,
    // while Run Now also includes pages published so far today.
    const end = manual ? new Date(today.valueOf() + 86_400_000).toISOString().slice(0, 10) : discoveryDay;
    await Promise.all([this.searchTavily(runId, kind, today, yesterday, end), this.searchGdelt(runId, kind, yesterday, end)]);
    await this.db.organicWebSearchQuery.updateMany({ where: { runId, status: 'SEARCHING' }, data: { status: 'INTERRUPTED', finishedAt: new Date() } });
  }

  private async searchTavily(runId: string, kind: keyof typeof plans, today: Date, yesterday: string, end: string) {
    const credentials = await this.settings.resolve('organic_web_search');
    const localities = await this.localityNames();
    const queries: SearchQuery[] = plans[kind].map(([label, query, alternate]) => ({ label, query, alternate }));
    for (const [index, sectors] of sectorSearchBatches(localities, today).entries()) {
      const names = sectors.map((sector) => `"${sector}"`).join(' OR ');
      queries.push({ label: 'Sector search ' + (index + 1), query: `Gurugram (${names}) ${sectorIntents[kind]}`, sectors });
    }
    queries.push(
      ...publisherChannels.map(({ label, domains }, index) => ({
        label,
        domains,
        query: '(Gurugram OR Gurgaon) ' + (index === publisherChannels.length - 1 ? NOTICE_TERMS[kind] : searchIntents[kind]),
      })),
    );
    for (const { label, query, alternate, domains, sectors } of queries) {
      const refine = (count: number) => {
        if (alternate && count <= 1 && queries.length < MAX_TAVILY_QUERIES_PER_RUN) queries.push({ label: label + ' · targeted follow-up', query: alternate });
      };
      const startedAt = new Date();
      const month = new Date(Date.UTC(startedAt.getUTCFullYear(), startedAt.getUTCMonth(), 1));
      const reserved = await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('organic-web-search-tavily'))`;
        const previous = await tx.organicWebSearchQuery.findUnique({ where: { runId_label: { runId, label } } });
        if (previous)
          return {
            querySent: false,
            priorCount: Array.isArray(previous.pages) && ['NO_LINKS', 'LINKS_FOUND'].includes(previous.status) ? previous.pages.length : null,
          };
        const used = await tx.organicWebSearchQuery.count({ where: { provider: 'TAVILY', startedAt: { gte: month } } });
        const allowed = used < SYNC_LIMIT;
        await tx.organicWebSearchQuery.create({
          data: {
            runId,
            label,
            query,
            sectors: sectors ?? [],
            startedAt: allowed ? startedAt : null,
            status: allowed ? 'SEARCHING' : 'FREE_LIMIT',
          },
        });
        return { querySent: allowed, priorCount: null };
      });
      if (!reserved.querySent) {
        if (reserved.priorCount !== null) refine(reserved.priorCount);
        continue;
      }
      try {
        const result = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(8_000),
          headers: {
            'Content-Type': 'application/json',
            ...(credentials?.apiKey ? { Authorization: 'Bearer ' + credentials.apiKey } : { 'X-Tavily-Access-Mode': 'keyless' }),
          },
          body: JSON.stringify({
            query,
            country: 'india',
            ...(domains ? { include_domains: domains } : {}),
            topic: 'general',
            max_results: 12,
            search_depth: 'basic',
            start_date: yesterday,
            end_date: end,
            include_published_date: true,
            include_answer: false,
            include_raw_content: false,
            auto_parameters: false,
          }),
        });
        const candidates = result.ok ? citedPages(discoveryResponse.parse(await result.json()).results) : [];
        const pages = domains
          ? candidates.filter((page) => domains.some((domain) => page.domain === domain || page.domain.endsWith('.' + domain)))
          : candidates;
        const status = result.ok ? (pages.length ? 'LINKS_FOUND' : 'NO_LINKS') : [429, 432, 433].includes(result.status) ? 'PROVIDER_LIMIT' : 'PROVIDER_ERROR';
        await this.db.organicWebSearchQuery.update({
          where: { runId_label: { runId, label } },
          data: {
            status,
            pages,
            httpStatus: result.status,
            finishedAt: new Date(),
          },
        });
        if (result.ok) refine(pages.length);
      } catch {
        await this.db.organicWebSearchQuery.update({ where: { runId_label: { runId, label } }, data: { status: 'SEARCH_ERROR', finishedAt: new Date() } });
      }
    }
  }

  private async searchGdelt(runId: string, kind: keyof typeof gdeltPlans, from: string, to: string) {
    const label = 'GDELT news links';
    const query = gdeltPlans[kind];
    const where = { runId_label: { runId, label } };
    const start = new Date(from + 'T00:00:00+05:30');
    const end = new Date(Math.min(Date.now(), new Date(to + 'T00:00:00+05:30').valueOf() - 1000));
    if (end <= start) return;

    // This provider shares an IP limit across scheduled and manual runs.
    const reserve = () =>
      this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('organic-web-search-gdelt'))`;
        if (await tx.organicWebSearchQuery.findUnique({ where })) return 'EXISTS';
        const now = new Date();
        const recent = await tx.organicWebSearchQuery.findFirst({
          where: { provider: 'GDELT', startedAt: { not: null } },
          orderBy: { startedAt: 'desc' },
          select: { startedAt: true, status: true, finishedAt: true },
        });
        if (recent?.status === 'PROVIDER_LIMIT' && recent.finishedAt && now.valueOf() - recent.finishedAt.valueOf() < GDELT_COOLDOWN_MS) return 'COOLDOWN';
        if (recent?.startedAt && now.valueOf() - recent.startedAt.valueOf() < GDELT_INTERVAL_MS) return 'PACED';
        await tx.organicWebSearchQuery.create({ data: { runId, label, query, provider: 'GDELT', startedAt: now, status: 'SEARCHING' } });
        return 'RESERVED';
      });
    let reservation = await reserve();
    if (reservation === 'PACED') {
      await delay(GDELT_INTERVAL_MS);
      reservation = await reserve();
    }
    if (reservation === 'EXISTS') return;
    if (reservation !== 'RESERVED') {
      await this.db.organicWebSearchQuery.upsert({
        where,
        update: {},
        create: {
          runId,
          label,
          query,
          provider: 'GDELT',
          finishedAt: new Date(),
          status: 'PROVIDER_COOLDOWN',
        },
      });
      return;
    }

    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.search = new URLSearchParams({
      query,
      mode: 'artlist',
      format: 'json',
      maxrecords: '12',
      sort: 'datedesc',
      startdatetime: gdeltTime(start),
      enddatetime: gdeltTime(end),
    }).toString();
    let httpStatus: number | undefined;
    try {
      const result = await readOrganicSource(url.href, null, 25_000);
      httpStatus = result.text === null ? 304 : 200;
      const articles = result.text ? gdeltResponse.parse(JSON.parse(result.text)).articles : [];
      const pages = citedPages(articles.map((item) => ({ url: item.url, published_date: gdeltSeenDate(item.seendate) })));
      await this.db.organicWebSearchQuery.update({
        where,
        data: { status: pages.length ? 'LINKS_FOUND' : 'NO_LINKS', pages, httpStatus, finishedAt: new Date() },
      });
    } catch (error) {
      let status = 'SEARCH_ERROR';
      if (error instanceof OrganicSourceHttpError) {
        httpStatus = error.status;
        status = error.status === 429 ? 'PROVIDER_LIMIT' : 'PROVIDER_ERROR';
      } else if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
        status = 'PROVIDER_TIMEOUT';
      }
      await this.db.organicWebSearchQuery.update({ where, data: { status, httpStatus, finishedAt: new Date() } });
    }
  }

  private async localityNames() {
    const rows = await this.db.locality.findMany({
      where: { isActive: true, city: { in: ['Gurgaon', 'Gurugram'], mode: 'insensitive' } },
      select: { name: true },
    });
    return rows.map(({ name }) => name);
  }

  async sectorCoverage(kind: keyof typeof plans) {
    const sectors = distinctSectors(await this.localityNames());
    if (!sectors.length) return { days: 0, total: 0, searched: 0, pending: [] };
    const days = Math.ceil(sectors.length / (SECTORS_PER_QUERY * SECTOR_QUERIES_PER_DAY));
    const now = new Date();
    const startDay = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: 'Asia/Kolkata' }).format(
      new Date(now.valueOf() - (days - 1) * 86_400_000),
    );
    const records = await this.db.organicWebSearchQuery.findMany({
      where: {
        provider: 'TAVILY',
        run: { kind },
        status: { in: ['LINKS_FOUND', 'NO_LINKS'] },
        sectors: { isEmpty: false },
        startedAt: { gte: new Date(startDay + 'T00:00:00+05:30'), lte: now },
      },
      select: { sectors: true },
    });
    const covered = new Set(records.flatMap((record) => record.sectors));
    const pending = sectors.filter((sector) => !covered.has(sector));
    return { days, total: sectors.length, searched: sectors.length - pending.length, pending };
  }

  async pagesForSource(runId: string, baseUrl: string, prefix: string) {
    const origin = new URL(baseUrl).origin;
    const batches = await this.db.organicWebSearchQuery.findMany({ where: { runId, status: 'LINKS_FOUND' }, select: { pages: true } });
    const urls = new Set<string>();
    for (const { pages } of batches) {
      if (!Array.isArray(pages)) continue;
      for (const page of pages) {
        if (!page || typeof page !== 'object' || !('url' in page) || typeof page.url !== 'string') continue;
        const url = sourceEndpoint(page.url);
        if (url.origin === origin && url.pathname.startsWith(prefix) && url.pathname !== prefix) urls.add(url.href);
      }
    }
    return [...urls].slice(0, 12);
  }
}
