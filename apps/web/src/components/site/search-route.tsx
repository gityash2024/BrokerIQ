import { Suspense } from 'react';
import type { Metadata } from 'next';
import { sget } from '@/lib/server';
import { PageShell } from './page-shell';
import { SearchPage, type SearchMode } from './search-page';
import { PageLoader } from '../ui/misc';

const TITLES: Record<SearchMode, string> = {
  buy: 'Property for sale in Gurgaon',
  rent: 'Property for rent in Gurgaon',
  commercial: 'Commercial property in Gurgaon',
  plots: 'Plots & land for sale in Gurgaon',
};

export async function searchMetadata(mode: SearchMode, sp: Record<string, string | undefined>): Promise<Metadata> {
  let where = 'Gurgaon';
  if (sp.localities) {
    const slug = sp.localities.split(',')[0];
    const loc = await sget<any>(`/public/localities/${slug}`, 600);
    if (loc) where = `${loc.name}, Gurgaon`;
  }
  const bhk = sp.bedrooms && !sp.bedrooms.includes(',') ? `${sp.bedrooms} BHK ` : '';
  const title = TITLES[mode].replace('Gurgaon', where).replace(/^Property/, `${bhk}Property`).trim();
  return { title, description: `${title} — verified listings with photos, prices, ₹/sq.ft, maps and direct contact with owners & trusted brokers on BrokerIQ.`, alternates: { canonical: `/${mode}` } };
}

export async function SearchRoute({ mode }: { mode: SearchMode }) {
  const params = mode === 'buy' ? 'purpose=SALE&category=RESIDENTIAL' : mode === 'rent' ? 'purpose=RENT&category=RESIDENTIAL' : mode === 'commercial' ? 'purpose=SALE&category=COMMERCIAL' : 'purpose=SALE&category=PLOT';
  const initial = await sget<any>(`/listings?${params}&pageSize=18`, 30);
  return (
    <PageShell>
      <Suspense fallback={<PageLoader />}>
        <SearchPage mode={mode} initial={initial} />
      </Suspense>
    </PageShell>
  );
}
