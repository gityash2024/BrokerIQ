import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatPriceShort } from '@brokeriq/shared';
import { sget } from '@/lib/server';
import { SITE_URL, img } from '@/lib/utils';
import { PageShell } from '@/components/site/page-shell';
import { PropertyView } from '@/components/site/property-view';

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await sget<any>(`/listings/${slug}?track=0`, 60);
  if (!l) return { title: 'Property not found' };
  const desc = `${formatPriceShort(l.price)}${l.purpose === 'RENT' ? '/month' : ''} · ${l.locality.name}, Gurgaon. ${(l.description ?? '').slice(0, 140)}`;
  return {
    title: l.title,
    description: desc,
    alternates: { canonical: `/property/${l.slug}` },
    openGraph: { title: l.title, description: desc, images: l.coverUrl ? [img(l.coverUrl, 1200)] : undefined, url: `${SITE_URL}/property/${l.slug}` },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const l = await sget<any>(`/listings/${slug}?track=0`, 60);
  if (!l) notFound();
  const [similar, tax] = await Promise.all([sget<any[]>(`/listings/${l.id}/similar`, 300), sget<any>('/public/taxonomies', 3600)]);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: l.title,
    url: `${SITE_URL}/property/${l.slug}`,
    image: (l.media ?? []).slice(0, 5).map((m: any) => m.url),
    datePosted: l.publishedAt ?? l.createdAt,
    description: l.description ?? undefined,
    offers: {
      '@type': 'Offer',
      price: l.price,
      priceCurrency: 'INR',
      availability: l.status === 'ACTIVE' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
    },
    address: { '@type': 'PostalAddress', addressLocality: `${l.locality.name}, Gurgaon`, addressRegion: 'Haryana', addressCountry: 'IN' },
    ...(l.latitude ? { geo: { '@type': 'GeoCoordinates', latitude: l.latitude, longitude: l.longitude } } : {}),
  };
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PropertyView initial={l} similar={similar ?? []} amenities={tax?.amenities ?? []} />
    </PageShell>
  );
}
