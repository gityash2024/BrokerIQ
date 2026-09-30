'use client';
import Link from 'next/link';
import { BadgeCheck, Bath, BedDouble, Briefcase, Camera, Maximize2, MapPin, Sparkles, Zap } from 'lucide-react';
import { firstMonthCost, formatINR, formatPriceShort, PROPERTY_TYPE_LABELS, FURNISHING_LABELS, responseBadge, timeAgo } from '@brokeriq/shared';
import type { ListingCard as L } from '@/lib/types';
import { areaOf } from '@/lib/types';
import { cn, img } from '@/lib/utils';
import { Badge } from '../ui/misc';
import { SaveButton } from './save-button';

export function ListingCard({
  l,
  layout = 'grid',
  active,
  onHover,
}: {
  l: L;
  layout?: 'grid' | 'row';
  active?: boolean;
  onHover?: (id: string | null) => void;
}) {
  const area = areaOf(l);
  const row = layout === 'row';
  return (
    <Link
      href={`/property/${l.slug}`}
      onMouseEnter={() => onHover?.(l.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'group card relative flex overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]',
        row ? 'flex-col sm:flex-row' : 'flex-col',
        active && 'ring-2 ring-saffron-400',
      )}
    >
      <div className={cn('relative overflow-hidden bg-surface-2', row ? 'aspect-[4/3] sm:aspect-auto sm:w-72 sm:shrink-0' : 'aspect-[4/3]')}>
        {l.coverUrl ? (
          <img src={img(l.coverUrl, 640)} alt={l.title} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-brand-100 to-brand-50 text-brand-300 dark:from-brand-950 dark:to-surface-2">
            <Camera className="size-10" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {l.isFeatured && (
            <Badge tone="dark" className="bg-saffron-500/95 text-slate-950">
              <Sparkles className="size-3" /> Featured
            </Badge>
          )}
          {l.isVerified && (
            <Badge tone="dark">
              <BadgeCheck className="size-3 text-emerald-400" /> Verified
            </Badge>
          )}
          {l.status === 'SOLD' || l.status === 'RENTED' ? <Badge tone="danger">{l.status === 'SOLD' ? 'Sold' : 'Rented'}</Badge> : null}
        </div>
        <SaveButton listingId={l.id} className="absolute top-3 right-3" />
        <div className="absolute bottom-3 left-3 text-white">
          <p className="font-display text-xl leading-none font-extrabold drop-shadow">
            {formatPriceShort(l.price)}
            {l.purpose === 'RENT' && <span className="text-sm font-semibold opacity-90">/mo</span>}
          </p>
          {l.pricePerSqft && l.purpose === 'SALE' ? <p className="mt-1 text-[11px] font-medium opacity-85">{formatINR(l.pricePerSqft)}/sq.ft</p> : null}
        </div>
        {!!l._count?.media && l._count.media > 1 && (
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            <Camera className="size-3" /> {l._count.media}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-display text-[15px] leading-snug font-bold group-hover:text-brand-600">{l.title}</h3>
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted">
          <MapPin className="size-3.5 shrink-0" />
          {l.societyName ? `${l.societyName}, ` : ''}
          {l.locality.name}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-muted">
          {l.bedrooms != null && l.category === 'RESIDENTIAL' && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-4 text-brand-500" /> {l.bedrooms} BHK
            </span>
          )}
          {l.bathrooms != null && (
            <span className="inline-flex items-center gap-1">
              <Bath className="size-4 text-brand-500" /> {l.bathrooms} Bath
            </span>
          )}
          {area && (
            <span className="inline-flex items-center gap-1">
              <Maximize2 className="size-4 text-brand-500" /> {formatINR(area, false)} sq.ft
            </span>
          )}
        </div>
        {l.purpose === 'RENT' && (l.securityDeposit || (l.brokerageType && l.brokerageType !== 'NONE')) ? (
          <p className="mt-2 text-[11px] text-muted">
            पहले महीने का कुल ~<b className="text-fg">{formatPriceShort(firstMonthCost(l))}</b>{' '}
            <span className="text-subtle">(rent + deposit + brokerage)</span>
          </p>
        ) : null}
        {(l as any).commute && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600">
            <Briefcase className="size-3" /> {(l as any).commute.hub} से ~{(l as any).commute.minutes} मिनट (
            {(l as any).commute.mode === 'metro' ? 'metro' : 'car'})
          </p>
        )}
        {(l as any).visitVerifiedAt && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <BadgeCheck className="size-3" /> Visit verified
          </p>
        )}
        {responseBadge(l.organization?.responseMinutes) && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <Zap className="size-3" /> {responseBadge(l.organization?.responseMinutes)}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="truncate text-xs text-subtle">
            {PROPERTY_TYPE_LABELS[l.propertyType]}
            {l.furnishing ? ` · ${FURNISHING_LABELS[l.furnishing as keyof typeof FURNISHING_LABELS]}` : ''}
          </span>
          <span className="shrink-0 text-[11px] text-subtle">
            {l.organization ? l.organization.name : l.postedByType === 'OWNER' ? 'Owner' : ''} · {timeAgo(l.publishedAt ?? l.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-2/3" />
      </div>
    </div>
  );
}
