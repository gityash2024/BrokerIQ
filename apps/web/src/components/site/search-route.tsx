import { Suspense } from 'react';
import type { Metadata } from 'next';
import { sget } from '@/lib/server';
import { PageShell } from './page-shell';
import { SearchPage, type SearchMode } from './search-page';
import { PageLoader } from '../ui/misc';

const TITLES: Record<SearchMode, string> = {
  buy: 'Property for rent in Gurgaon',
  rent: 'Property for rent in Gurgaon',
  commercial: 'Commercial space for rent in Gurgaon',
  plots: 'Property for rent in Gurgaon',
};

export async function searchMetadata(mode: SearchMode, sp: Record<string, string | undefined>): Promise<Metadata> {
  let where = 'Gurgaon';
  if (sp.localities) {
    const slug = sp.localities.split(',')[0];
    const loc = await sget<any>(`/public/localities/${slug}`, 600);
    if (loc) where = `${loc.name}, Gurgaon`;
  }
  const bhk = sp.bedrooms && !sp.bedrooms.includes(',') ? `${sp.bedrooms} BHK ` : '';
  const title = TITLES[mode]
    .replace('Gurgaon', where)
    .replace(/^Property/, `${bhk}Property`)
    .trim();
  return {
    title,
    description: `${title} — verified rentals with photos, rent, deposit, brokerage, maps and trusted local brokers on BrokerIQ.`,
    alternates: { canonical: `/${mode}` },
  };
}

export async function SearchRoute({ mode }: { mode: SearchMode }) {
  const params = mode === 'commercial' ? 'purpose=RENT&category=COMMERCIAL' : 'purpose=RENT&category=RESIDENTIAL';
  const initial = await sget<any>(`/listings?${params}&pageSize=18`, 30);
  return (
    <PageShell>
      <Suspense fallback={<PageLoader />}>
        <SearchPage mode={mode} initial={initial} />
      </Suspense>
    </PageShell>
  );
}
