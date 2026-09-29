import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatINR } from '@brokeriq/shared';
import { sget } from '@/lib/server';
import { SITE_URL, qs } from '@/lib/utils';
import { PageShell } from '@/components/site/page-shell';
import { ListingCard } from '@/components/site/listing-card';
import { RequirementButton } from '@/components/site/requirement';
import { Button } from '@/components/ui/button';

export const revalidate = 600;

async function load(slug: string) {
  return sget<any>(`/public/seo/${encodeURIComponent(slug)}`, 600);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: 'Not found' };
  const desc = `${d.count} verified ${d.title.toLowerCase()} — rent${d.rent.min ? ` from ${formatINR(d.rent.min)}` : ''}, deposit, brokerage, photos and trusted local brokers on BrokerIQ.`;
  return { title: d.title, description: desc, alternates: { canonical: `/rent/${slug}` }, openGraph: { title: d.title, description: desc, url: `${SITE_URL}/rent/${slug}` } };
}

/** Programmatic landing page, e.g. /rent/2-bhk-furnished-flats-for-rent-in-sector-54-gurgaon */
export default async function SeoRentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const results = await sget<any>(`/listings${qs({ ...d.filters, pageSize: 24 })}`, 300);
  const items: any[] = results?.items ?? [];
  const faqs = [
    [`${d.title} का औसत किराया कितना है?`, d.rent.avg ? `अभी live listings का औसत किराया लगभग ${formatINR(d.rent.avg)} प्रति महीना है (${formatINR(d.rent.min)} से ${formatINR(d.rent.max)} तक)।` : 'अभी पर्याप्त data नहीं है — alert लगाइए, नई listing आते ही बताएँगे।'],
    ['Brokerage और deposit कितना लगता है?', 'हर listing पर brokerage (जैसे 15 दिन या 1 महीने का किराया) और security deposit साफ़ लिखा है, साथ में पहले महीने का कुल खर्च भी।'],
    ['क्या listings verified हैं?', 'हर listing BrokerIQ team की जाँच के बाद ही live होती है। "Visit verified" badge वाली properties हमारी team ने मौके पर जाकर देखी हैं।'],
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'ItemList', name: d.title, numberOfItems: d.count, itemListElement: items.slice(0, 10).map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/property/${l.slug}`, name: l.title })) },
      { '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <nav className="text-xs text-muted">
          <Link href="/rent" className="hover:text-brand-600">Rent</Link> / <Link href={`/locality/${d.locality.slug}`} className="hover:text-brand-600" data-no-i18n>{d.locality.name}</Link>
        </nav>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl" data-no-i18n>{d.title}</h1>
        <p className="mt-2 max-w-3xl text-muted">
          {d.count} live listings{d.rent.avg ? ` · औसत किराया ${formatINR(d.rent.avg)}/महीना` : ''}. Photos, deposit, brokerage, पहले महीने का कुल खर्च और office तक की दूरी — सब एक जगह।
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button href={`/rent${qs(d.filters)}`}>सभी filters के साथ देखें</Button>
          <RequirementButton prefill={{ bedrooms: d.combo.bedrooms ? [d.combo.bedrooms] : [], localitySlugs: [d.locality.slug] }} />
        </div>
        {items.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-line p-8 text-center text-muted">अभी कोई live listing नहीं — अपनी ज़रूरत बताइए, नई property आते ही बताएँगे।</p>
        )}
        <section className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-bold">अक्सर पूछे जाने वाले सवाल</h2>
            <div className="mt-4 space-y-4">
              {faqs.map(([q, a]) => (
                <div key={q}>
                  <p className="font-semibold">{q}</p>
                  <p className="mt-1 text-sm text-muted">{a}</p>
                </div>
              ))}
            </div>
          </div>
          {d.related.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-bold">इसी इलाके में और</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {d.related.map((r: any) => (
                  <li key={r.slug}>
                    <Link href={`/rent/${r.slug}`} className="text-sm text-brand-600 hover:underline" data-no-i18n>{r.title}</Link> <span className="text-xs text-subtle">({r.count})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
