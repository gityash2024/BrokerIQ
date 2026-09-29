import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, Building2, Home, KeyRound, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { sget } from '@/lib/server';
import { PageShell, SectionTitle } from '@/components/site/page-shell';
import { ListingCard } from '@/components/site/listing-card';
import { BrokerCard, ProjectCard } from '@/components/site/cards';
import { PriceTrendChart, RentBarChart } from '@/components/site/trend-chart';
import { Map } from '@/components/site/map';
import { Button } from '@/components/ui/button';
import { Stat } from '@/components/ui/misc';
import { ResidentReviews } from '@/components/site/property-extras';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await sget<any>(`/public/localities/${slug}`, 300);
  if (!l) return { title: 'Locality not found' };
  return { title: `${l.name}, Gurgaon — flats & houses for rent, average rent`, description: `${l.name} (${l.zone ?? 'Gurgaon'}) rental guide: ${l.listingsRent} homes for rent${l.avgRent ? `, average 2 BHK rent ₹${l.avgRent}` : ''}. Local brokers and connectivity.` };
}

export default async function LocalityPage({ params }: Props) {
  const { slug } = await params;
  const l = await sget<any>(`/public/localities/${slug}`, 300);
  if (!l) notFound();
  const rent = await sget<any>(`/listings?localities=${slug}&purpose=RENT&pageSize=8`, 120);
  const combos = (await sget<any[]>(`/public/seo-combos?locality=${slug}`, 600)) ?? [];
  return (
    <PageShell>
      <section className="relative overflow-hidden">
        <div className="mesh-hero absolute inset-0" />
        {l.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-overlay" />
        )}
        <div className="container-x relative grid gap-8 py-14 text-white lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-white/70">
              <MapPin className="size-4" /> {l.zone ?? 'Gurgaon'}
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{l.name}</h1>
            {l.description ? <p className="mt-3 max-w-2xl text-white/75">{l.description}</p> : <p className="mt-3 max-w-2xl text-white/75">{l.name}, Gurgaon में rent पर घर, औसत किराया और neighbourhood की पूरी जानकारी।</p>}
            <div className="mt-6 flex flex-wrap gap-2">
              {(l.highlights ?? []).map((h: string) => (
                <span key={h} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm backdrop-blur">
                  <Sparkles className="size-3.5 text-saffron-400" /> {h}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={`/rent?localities=${slug}`} variant="accent">
                <KeyRound className="size-4" /> Rent in {l.name}
              </Button>
              <Button href={`/rent?localities=${slug}&furnishing=FULLY_FURNISHED`} variant="secondary" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <Home className="size-4" /> Furnished homes
              </Button>
            </div>
          </div>
          <div className="card h-72 overflow-hidden border-white/10">
            <Map points={[{ id: l.id, lat: l.latitude, lng: l.longitude, label: l.name, dot: true }]} center={[l.latitude, l.longitude]} zoom={14} fit={false} radius={1200} scrollWheelZoom={false} />
          </div>
        </div>
      </section>

      <div className="container-x -mt-8 relative grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="For rent" value={l.listingsRent} icon={<KeyRound className="size-5" />} tone="info" />
        <Stat label="Avg rent (2 BHK)" value={l.avgRent ? `${formatINR(l.avgRent)}` : '—'} hint="per month" icon={<TrendingUp className="size-5" />} tone="success" />
        <Stat label="Local brokers" value={l.brokers?.length ?? 0} icon={<Building2 className="size-5" />} tone="warning" />
        <Stat label="Nearby areas" value={l.nearby?.length ?? 0} icon={<Home className="size-5" />} />
      </div>

      {(l.priceTrend?.length > 1 || l.rentByBhk?.length > 0) && (
        <section className="container-x mt-14 grid gap-6 lg:grid-cols-2">
          {l.priceTrend?.length > 1 && (
            <div className="card p-6">
              <h2 className="font-display text-lg font-bold">Rent trend (₹/sq.ft per month)</h2>
              <p className="text-sm text-muted">पिछले 12 महीने की listings पर आधारित</p>
              <div className="mt-4">
                <PriceTrendChart data={l.priceTrend} />
              </div>
            </div>
          )}
          {l.rentByBhk?.length > 0 && (
            <div className="card p-6">
              <h2 className="font-display text-lg font-bold">Average rent by BHK</h2>
              <p className="text-sm text-muted">Live rental listings से</p>
              <div className="mt-4">
                <RentBarChart data={l.rentByBhk} />
              </div>
            </div>
          )}
        </section>
      )}

      {rent?.items?.length > 0 && (
        <section className="container-x mt-16">
          <SectionTitle title={`For rent in ${l.name}`} action={<Button href={`/rent?localities=${slug}`} variant="secondary" size="sm">View all <ArrowRight className="size-4" /></Button>} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {rent.items.map((x: any) => (
              <ListingCard key={x.id} l={x} />
            ))}
          </div>
        </section>
      )}
      {l.projects?.length > 0 && (
        <section className="container-x mt-16">
          <SectionTitle title={`Projects in ${l.name}`} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {l.projects.map((p: any) => (
              <ProjectCard key={p.id} p={{ ...p, locality: { name: l.name } }} />
            ))}
          </div>
        </section>
      )}
      <section className="container-x mt-16">
        <ResidentReviews localitySlug={l.slug} title={`${l.name} — रहने वालों की राय`} />
      </section>
      {combos.length > 0 && (
        <section className="container-x mt-16">
          <SectionTitle title={`${l.name} में rent पर`} />
          <div className="flex flex-wrap gap-2">
            {combos.slice(0, 16).map((c: any) => (
              <Link key={c.slug} href={`/rent/${c.slug}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-brand-400 hover:text-brand-600">
                <span data-no-i18n>{c.title.replace(/, Gurgaon$/, '')}</span> <span className="text-subtle">· {c.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {l.brokers?.length > 0 && (
        <section className="container-x mt-16">
          <SectionTitle title={`${l.name} के expert brokers`} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {l.brokers.map((b: any) => (
              <BrokerCard key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}
      {l.nearby?.length > 0 && (
        <section className="container-x mt-16">
          <SectionTitle title="आस-पास के इलाके" />
          <div className="flex flex-wrap gap-2">
            {l.nearby.map((n: any) => (
              <Link key={n.id} href={`/locality/${n.slug}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-brand-400 hover:text-brand-600">
                {n.name} <span className="text-subtle">· {n.km} km</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
