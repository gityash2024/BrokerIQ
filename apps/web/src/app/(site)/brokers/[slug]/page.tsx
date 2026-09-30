import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BadgeCheck, Briefcase, Home, KeyRound, MapPin, Star, Zap } from 'lucide-react';
import { responseBadge } from '@brokeriq/shared';
import { sget } from '@/lib/server';
import { img, formatDate } from '@/lib/utils';
import { PageShell, SectionTitle } from '@/components/site/page-shell';
import { ListingCard } from '@/components/site/listing-card';
import { MicrositeActions } from '@/components/site/microsite-actions';
import { Avatar, Badge, Empty } from '@/components/ui/misc';

export const revalidate = 120;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await sget<any>(`/brokers/${slug}`, 120);
  if (!b) return { title: 'Broker not found' };
  return {
    title: `${b.name} — real estate broker in Gurgaon`,
    description: (b.about ?? `${b.name}: verified property listings and expert advice in Gurgaon.`).slice(0, 160),
    openGraph: { images: b.coverUrl ? [b.coverUrl] : b.logoUrl ? [b.logoUrl] : undefined },
  };
}

export default async function BrokerPage({ params }: Props) {
  const { slug } = await params;
  const b = await sget<any>(`/brokers/${slug}`, 120);
  if (!b) notFound();
  return (
    <PageShell>
      <div className="relative h-56 overflow-hidden sm:h-72">
        {b.coverUrl ? <img src={img(b.coverUrl, 1800)} alt="" className="h-full w-full object-cover" /> : <div className="mesh-hero h-full w-full" />}
      </div>
      <div className="container-x relative -mt-16">
        <div className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-end">
          <Avatar name={b.name} src={b.logoUrl} size={112} className="ring-4 ring-surface" />
          <div className="flex-1">
            <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">
              {b.name}
              {b.verification === 'VERIFIED' && <BadgeCheck className="size-7 text-emerald-500" />}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-amber-400 text-amber-400" /> {b.reviewCount ? `${b.rating.toFixed(1)} · ${b.reviewCount} reviews` : 'New'}
              </span>
              {responseBadge(b.responseMinutes) && (
                <span className="flex items-center gap-1 font-semibold text-emerald-600">
                  <Zap className="size-4" /> {responseBadge(b.responseMinutes)}
                </span>
              )}
              {b.experienceYears && (
                <span className="flex items-center gap-1">
                  <Briefcase className="size-4" /> {b.experienceYears}+ years
                </span>
              )}
              {b.reraNumber && <Badge tone="success">RERA {b.reraNumber}</Badge>}
              {b.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" /> {b.address}
                </span>
              )}
            </div>
          </div>
          <MicrositeActions org={{ id: b.id, name: b.name, phone: b.phone, whatsapp: b.whatsapp }} />
        </div>
      </div>
      <div className="container-x mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-12">
          {b.about && (
            <section>
              <SectionTitle title="About" />
              <p className="leading-7 whitespace-pre-line text-muted">{b.about}</p>
            </section>
          )}
          <section>
            <SectionTitle title={`Active listings (${b.listings.length})`} subtitle={`${b.stats?.RENT ?? 0} homes for rent`} />
            {b.listings.length ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {b.listings.map((l: any) => (
                  <ListingCard key={l.id} l={l} />
                ))}
              </div>
            ) : (
              <Empty title="अभी कोई active listing नहीं" />
            )}
          </section>
          <section id="reviews">
            <SectionTitle title="Reviews" />
            <div className="space-y-4">
              {b.reviews.length === 0 && <p className="text-sm text-muted">अभी कोई review नहीं — पहला review आप लिखें।</p>}
              {b.reviews.map((r: any) => (
                <div key={r.id} className="card p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.user.name} src={r.user.avatarUrl} size={36} />
                    <div>
                      <p className="font-semibold">{r.user.name}</p>
                      <p className="flex items-center gap-0.5 text-xs text-muted">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`size-3.5 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-line'}`} />
                        ))}
                        <span className="ml-2">{formatDate(r.createdAt)}</span>
                      </p>
                    </div>
                  </div>
                  {r.comment && <p className="mt-3 text-sm text-muted">{r.comment}</p>}
                  {r.reply && (
                    <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
                      <b>{b.name}:</b> {r.reply}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          {b.localities?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-display font-bold">Expert in</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.localities.map((l: any) => (
                  <a
                    key={l.id}
                    href={`/locality/${l.slug}`}
                    className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    {l.name}
                  </a>
                ))}
              </div>
            </div>
          )}
          {b.team?.length > 1 && (
            <div className="card p-5">
              <h3 className="font-display font-bold">Team</h3>
              <div className="mt-3 space-y-3">
                {b.team.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.avatarUrl} size={34} />
                    <span className="text-sm font-medium">{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card grid grid-cols-2 gap-3 p-5 text-center">
            <div>
              <Home className="mx-auto size-5 text-brand-600" />
              <p className="mt-1 font-display text-xl font-bold">{b.team?.length ?? 0}</p>
              <p className="text-xs text-muted">Team members</p>
            </div>
            <div>
              <KeyRound className="mx-auto size-5 text-saffron-500" />
              <p className="mt-1 font-display text-xl font-bold">{b.stats?.RENT ?? 0}</p>
              <p className="text-xs text-muted">For rent</p>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
