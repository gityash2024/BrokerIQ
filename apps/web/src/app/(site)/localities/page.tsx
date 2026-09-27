import type { Metadata } from 'next';
import { sget } from '@/lib/server';
import { PageShell } from '@/components/site/page-shell';
import { LocalitiesExplorer } from '@/components/site/localities-explorer';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Gurgaon localities & sectors — prices, listings, guides', description: 'Explore every Gurgaon sector and locality: live listings, average ₹/sq.ft, connectivity and neighbourhood guides.' };

export default async function LocalitiesPage() {
  const locs = (await sget<any[]>('/public/localities', 300)) ?? [];
  return (
    <PageShell>
      <section className="mesh-hero relative -mt-px overflow-hidden py-16 text-white">
        <div className="container-x relative">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Gurgaon, sector by sector</h1>
          <p className="mt-2 max-w-2xl text-white/75">{locs.length} localities — हर sector की live listings, औसत ₹/sq.ft और neighbourhood guide।</p>
        </div>
      </section>
      <LocalitiesExplorer locs={locs} />
    </PageShell>
  );
}
