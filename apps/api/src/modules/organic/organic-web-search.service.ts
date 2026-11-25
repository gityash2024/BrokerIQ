import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { SettingsService } from '../../core/settings/settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { sourceEndpoint } from './organic-source';

const plans = {
  SUPPLY: [
    ['Owner rentals', 'Gurugram Gurgaon owner renting out flat house builder floor available for rent',
      'Gurgaon direct owner available for rent apartment builder floor no brokerage DLF Sushant Lok'],
    ['Owner sales', 'Gurugram Gurgaon owner selling resale apartment house plot directly new property listing',
      'Gurgaon Gurugram resale flat for sale posted by owner direct property Sector 57 Sector 65 Dwarka Expressway'],
    ['Commercial property', 'Gurugram Gurgaon owner office shop warehouse commercial space available lease sale',
      'Gurugram commercial space by owner available for lease shop office Golf Course Road Sohna Road'],
    ['Hindi owner posts', 'गुरुग्राम गुड़गांव मकान मालिक फ्लैट किराये पर प्रॉपर्टी बिक्री',
      'गुड़गांव मकान मालिक से सीधा फ्लैट बिक्री या किराए पर सेक्टर'],
  ],
  DEMAND: [
    ['Property buyers', 'Gurugram Gurgaon looking to buy apartment floor house plot genuine buyer requirement',
      'Gurgaon need to purchase flat buyer looking for a flat budget requirement Dwarka Expressway New Gurgaon'],
    ['Tenant requirements', 'Gurugram Gurgaon looking for rental flat wanted need furnished apartment moving tenant requirement',
      'Gurgaon tenant looking for 1 BHK 2 BHK flat for rent budget moving Gurgaon Sector'],
    ['Commercial requirements', 'Gurugram Gurgaon looking to rent office shop warehouse tenant commercial space requirement',
      'Gurgaon need warehouse office shop for lease wanted tenant budget commercial requirement'],
    ['Hindi buyer and tenant posts', 'गुरुग्राम गुड़गांव किराये पर घर चाहिए फ्लैट खरीदना है प्रॉपर्टी चाहिए',
      'गुड़गांव सेक्टर फ्लैट किराए पर चाहिए खरीदना है बजट चाहिए'],
  ],
} as const;

const SYNC_LIMIT = 1_000;
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

@Injectable()
export class OrganicWebSearchService {
  constructor(private readonly settings: SettingsService, private readonly db: PrismaService) {}

  async mode() {
    return await this.settings.resolve('organic_web_search') ? 'ACCOUNT' : 'KEYLESS';
  }

  async run(runId: string, kind: keyof typeof plans, discoveryDay: string, manual: boolean) {
    const credentials = await this.settings.resolve('organic_web_search');
    const today = new Date(discoveryDay + 'T00:00:00Z');
    const yesterday = new Date(today.valueOf() - 86_400_000).toISOString().slice(0, 10);
    // Tavily's end date is exclusive. Scheduled discovery includes yesterday,
    // while Run Now also includes pages published so far today.
    const end = manual ? new Date(today.valueOf() + 86_400_000).toISOString().slice(0, 10) : discoveryDay;
    const queries: { label: string; query: string; alternate?: string }[] =
      plans[kind].map(([label, query, alternate]) => ({ label, query, alternate }));
    for (const { label, query, alternate } of queries) {
      const refine = (count: number) => {
        if (alternate && count <= 1) queries.push({ label: label + ' · targeted follow-up', query: alternate });
      };
      const startedAt = new Date();
      const month = new Date(Date.UTC(startedAt.getUTCFullYear(), startedAt.getUTCMonth(), 1));
      const reserved = await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('organic-web-search-tavily'))`;
        const previous = await tx.organicWebSearchQuery.findUnique({ where: { runId_label: { runId, label } } });
        if (previous) return { querySent: false, priorCount: Array.isArray(previous.pages) && ['NO_LINKS', 'LINKS_FOUND'].includes(previous.status) ? previous.pages.length : null };
        const used = await tx.organicWebSearchQuery.count({ where: { startedAt: { gte: month } } });
        const allowed = used < SYNC_LIMIT;
        await tx.organicWebSearchQuery.create({ data: {
          runId, label, query, startedAt: allowed ? startedAt : null, status: allowed ? 'SEARCHING' : 'FREE_LIMIT',
        } });
        return { querySent: allowed, priorCount: null };
      });
      if (!reserved.querySent) {
        if (reserved.priorCount !== null) refine(reserved.priorCount);
        continue;
      }
      try {
        const result = await fetch('https://api.tavily.com/search', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8_000),
          headers: { 'Content-Type': 'application/json', ...(credentials?.apiKey
            ? { Authorization: 'Bearer ' + credentials.apiKey } : { 'X-Tavily-Access-Mode': 'keyless' }) },
          body: JSON.stringify({ query, country: 'india', topic: 'general', max_results: 12, search_depth: 'basic',
            start_date: yesterday, end_date: end, include_published_date: true,
            include_answer: false, include_raw_content: false, auto_parameters: false }),
        });
        const pages = result.ok ? citedPages(discoveryResponse.parse(await result.json()).results) : [];
        const status = result.ok ? (pages.length ? 'LINKS_FOUND' : 'NO_LINKS')
          : [429, 432, 433].includes(result.status) ? 'PROVIDER_LIMIT' : 'PROVIDER_ERROR';
        await this.db.organicWebSearchQuery.update({ where: { runId_label: { runId, label } }, data: {
          status, pages, httpStatus: result.status, finishedAt: new Date(),
        } });
        if (result.ok) refine(pages.length);
      } catch {
        await this.db.organicWebSearchQuery.update({ where: { runId_label: { runId, label } },
          data: { status: 'SEARCH_ERROR', finishedAt: new Date() } });
      }
    }
    await this.db.organicWebSearchQuery.updateMany({ where: { runId, status: 'SEARCHING' },
      data: { status: 'INTERRUPTED', finishedAt: new Date() } });
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
