import Link from 'next/link';
import { BadgeCheck, Building2, MapPin, Star, TrendingUp, Zap } from 'lucide-react';
import { formatINR, formatPriceShort, POSSESSION_LABELS, responseBadge } from '@brokeriq/shared';
import { cn, img } from '@/lib/utils';
import { Avatar, Badge } from '../ui/misc';

const GRADS = [
  'from-indigo-500 to-purple-600',
  'from-amber-400 to-orange-600',
  'from-sky-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-fuchsia-600',
];

export function LocalityCard({ l, i = 0 }: { l: any; i?: number }) {
  const count = (l.listingsSale ?? 0) + (l.listingsRent ?? 0);
  return (
    <Link
      href={`/locality/${l.slug}`}
      className="group relative block overflow-hidden rounded-3xl transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
    >
      <div className={cn('relative aspect-[4/3] bg-gradient-to-br', GRADS[i % GRADS.length])}>
        {l.coverUrl && (
          <img
            src={img(l.coverUrl, 600)}
            alt={l.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <svg className="absolute -top-6 -right-6 size-32 text-white/10" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="6" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" strokeWidth="6" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-[11px] font-semibold tracking-wide uppercase opacity-80">{l.zone}</p>
          <h3 className="font-display text-lg leading-tight font-bold">{l.name}</h3>
          <div className="mt-2 flex items-center gap-3 text-xs font-medium">
            {l.avgPsf ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur">
                <TrendingUp className="size-3" /> {formatINR(l.avgPsf)}/sq.ft
              </span>
            ) : null}
            <span className="opacity-90">{count ? `${count} ${count === 1 ? 'listing' : 'listings'}` : 'Explore'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function BrokerCard({ b }: { b: any }) {
  const listings = b._count?.listings ?? b.listingsCount ?? 0;
  return (
    <Link
      href={`/brokers/${b.slug}`}
      className="group card flex flex-col items-center p-5 text-center transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative">
        <Avatar name={b.name} src={b.logoUrl} size={64} className="ring-4 ring-brand-50 dark:ring-brand-500/10" />
        {b.verification === 'VERIFIED' && <BadgeCheck className="absolute -right-1 -bottom-1 size-6 fill-white text-emerald-500 dark:fill-surface" />}
      </div>
      <h3 className="mt-3 line-clamp-1 font-display font-bold group-hover:text-brand-600">{b.name}</h3>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted">
        <Star className={cn('size-3.5', b.reviewCount ? 'fill-amber-400 text-amber-400' : 'text-subtle')} />
        {b.reviewCount ? `${b.rating.toFixed(1)} (${b.reviewCount})` : 'New'}
        {b.experienceYears ? ` · ${b.experienceYears}+ yrs` : ''}
      </div>
      <p className="mt-2 text-xs font-semibold text-brand-600">
        {listings} active {listings === 1 ? 'listing' : 'listings'}
      </p>
      {responseBadge(b.responseMinutes) && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
          <Zap className="size-3" /> {responseBadge(b.responseMinutes)}
        </p>
      )}
    </Link>
  );
}

export function ProjectCard({ p }: { p: any }) {
  return (
    <Link href={`/projects/${p.slug}`} className="group card block overflow-hidden transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[16/10] bg-gradient-to-br from-slate-800 to-brand-900">
        {p.photos?.[0] ? (
          <img src={img(p.photos[0], 700)} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        ) : (
          <Building2 className="absolute inset-0 m-auto size-12 text-white/30" />
        )}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {p.reraNumber && <Badge tone="dark">RERA</Badge>}
          {p.possession && <Badge tone="dark">{POSSESSION_LABELS[p.possession as keyof typeof POSSESSION_LABELS]}</Badge>}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-display font-bold group-hover:text-brand-600">{p.name}</h3>
        <p className="text-xs text-muted">by {p.builder?.name}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3.5" /> {p.locality?.name}
        </p>
        {(p.minPrice || p.maxPrice) && (
          <p className="mt-3 font-display text-lg font-bold">
            {formatPriceShort(p.minPrice)}
            {p.maxPrice && p.maxPrice !== p.minPrice ? ` – ${formatPriceShort(p.maxPrice)}` : ''}
          </p>
        )}
      </div>
    </Link>
  );
}
