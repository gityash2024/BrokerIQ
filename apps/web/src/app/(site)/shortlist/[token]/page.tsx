import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { sget } from '@/lib/server';
import { PageShell } from '@/components/site/page-shell';
import { ListingCard } from '@/components/site/listing-card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Shared shortlist', robots: { index: false, follow: false } };

/** Read-only view of someone's saved homes, shared with family. */
export default async function SharedShortlistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await sget<any>(`/public/shortlist/${encodeURIComponent(token)}`, 0);
  if (!s) notFound();
  const ids = s.listings.slice(0, 4).map((l: any) => l.id);
  return (
    <PageShell>
      <div className="container-x py-10">
        <h1 className="font-display text-3xl font-extrabold">
          <span data-no-i18n>{s.by}</span> की shortlist
        </h1>
        <p className="mt-1 text-muted">{s.listings.length} घर · BrokerIQ पर saved</p>
        {ids.length >= 2 && (
          <Button className="mt-4" variant="secondary" href={`/compare?ids=${ids.join(',')}`}>
            Compare करें
          </Button>
        )}
        {s.listings.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {s.listings.map((l: any) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-muted">अभी इस shortlist में कोई live घर नहीं है।</p>
        )}
      </div>
    </PageShell>
  );
}
