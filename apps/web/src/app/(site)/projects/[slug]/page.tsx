import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BadgeCheck, Building2, CalendarClock, FileDown, Landmark, MapPin, Ruler } from 'lucide-react';
import { POSSESSION_LABELS, formatINR, formatPriceShort } from '@brokeriq/shared';
import { sget } from '@/lib/server';
import { formatDate } from '@/lib/utils';
import { PageShell, SectionTitle } from '@/components/site/page-shell';
import { Gallery } from '@/components/site/gallery';
import { ListingCard } from '@/components/site/listing-card';
import { ProjectEnquiry } from '@/components/site/project-enquiry';
import { Map } from '@/components/site/map';
import { Badge, Stat } from '@/components/ui/misc';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await sget<any>(`/public/projects/${slug}`, 300);
  if (!p) return { title: 'Project not found' };
  return { title: `${p.name} by ${p.builder.name}, ${p.locality.name} — price, floor plans, RERA`, description: (p.description ?? '').slice(0, 160) };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const p = await sget<any>(`/public/projects/${slug}`, 300);
  if (!p) notFound();
  const configs = (p.configurations ?? []) as { label: string; area?: number; price?: number }[];
  return (
    <PageShell>
      <div className="container-x py-6">
        <Gallery photos={(p.photos ?? []).map((u: string) => ({ url: u }))} title={p.name} />
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-10">
            <div>
              <div className="flex flex-wrap gap-2">
                {p.reraNumber && (
                  <Badge tone="success">
                    <BadgeCheck className="size-3.5" /> RERA {p.reraNumber}
                  </Badge>
                )}
                {p.possession && <Badge tone="brand">{POSSESSION_LABELS[p.possession as keyof typeof POSSESSION_LABELS]}</Badge>}
              </div>
              <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">{p.name}</h1>
              <p className="mt-1 text-muted">
                by <b>{p.builder.name}</b> · <MapPin className="inline size-4" /> {p.locality.name}, Gurgaon
              </p>
              {(p.minPrice || p.maxPrice) && (
                <p className="mt-4 font-display text-3xl font-extrabold">
                  {formatPriceShort(p.minPrice)}
                  {p.maxPrice && p.maxPrice !== p.minPrice ? ` – ${formatPriceShort(p.maxPrice)}` : ''}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Possession" value={p.possessionDate ? formatDate(p.possessionDate, { month: 'short', year: 'numeric' }) : '—'} icon={<CalendarClock className="size-5" />} />
              <Stat label="Land area" value={p.landArea ?? '—'} icon={<Landmark className="size-5" />} tone="info" />
              <Stat label="Units" value={p.totalUnits ?? '—'} icon={<Building2 className="size-5" />} tone="warning" />
              <Stat label="Configs" value={configs.length || '—'} icon={<Ruler className="size-5" />} tone="success" />
            </div>
            {configs.length > 0 && (
              <section>
                <SectionTitle title="Configurations & prices" />
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
                      <tr>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Area</th>
                        <th className="px-4 py-3">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configs.map((c, i) => (
                        <tr key={i} className="border-t border-line">
                          <td className="px-4 py-3 font-semibold">{c.label}</td>
                          <td className="px-4 py-3">{c.area ? `${formatINR(c.area, false)} sq.ft` : '—'}</td>
                          <td className="px-4 py-3 font-semibold">{c.price ? formatPriceShort(c.price) : 'On request'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {p.description && (
              <section>
                <SectionTitle title="About the project" />
                <p className="leading-7 whitespace-pre-line text-muted">{p.description}</p>
              </section>
            )}
            {p.amenities?.length > 0 && (
              <section>
                <SectionTitle title="Amenities" />
                <div className="flex flex-wrap gap-2">
                  {p.amenities.map((a: string) => (
                    <span key={a} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {(p.latitude ?? p.locality.latitude) && (
              <section>
                <SectionTitle title="Location" />
                <div className="card h-80 overflow-hidden">
                  <Map points={[{ id: p.id, lat: p.latitude ?? p.locality.latitude, lng: p.longitude ?? p.locality.longitude, label: p.name, dot: true }]} center={[p.latitude ?? p.locality.latitude, p.longitude ?? p.locality.longitude]} zoom={15} fit={false} scrollWheelZoom={false} />
                </div>
              </section>
            )}
            {p.listings?.length > 0 && (
              <section>
                <SectionTitle title={`Units available in ${p.name}`} />
                <div className="grid gap-5 sm:grid-cols-2">
                  {p.listings.map((x: any) => (
                    <ListingCard key={x.id} l={x} />
                  ))}
                </div>
              </section>
            )}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <ProjectEnquiry projectId={p.id} name={p.name} brochureUrl={p.brochureUrl} />
            {p.brochureUrl && (
              <p className="flex items-center gap-2 text-xs text-muted">
                <FileDown className="size-4" /> Brochure enquiry submit करने के बाद download होगा
              </p>
            )}
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
