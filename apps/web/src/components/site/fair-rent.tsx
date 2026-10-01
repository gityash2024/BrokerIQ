'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import { formatINR, type LocalityListItem } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useFlag } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Field, Input, Select } from '../ui/field';
import { Skeleton } from '../ui/misc';

type Estimate = {
  locality: string;
  zone: string | null;
  bedrooms: number;
  scope: 'LOCALITY' | 'ZONE';
  furnishingApplied: boolean;
  samples: number;
  enough: boolean;
  median: number;
  p25: number;
  p75: number;
  verdict: 'LOW' | 'FAIR' | 'HIGH' | null;
};
const VERDICT = {
  LOW: { text: 'आस-पास से सस्ता', tone: 'text-emerald-600' },
  FAIR: { text: 'Fair rent', tone: 'text-brand-600' },
  HIGH: { text: 'आस-पास से महँगा', tone: 'text-amber-600' },
} as const;

const fetchEstimate = (localityId: string, bedrooms: number, furnishing?: string | null, price?: number | null) =>
  api<Estimate>(
    `/public/fair-rent?localityId=${encodeURIComponent(localityId)}&bedrooms=${bedrooms}${furnishing ? `&furnishing=${furnishing}` : ''}${price ? `&price=${price}` : ''}`,
    { auth: false },
  );

function RangeBar({ e, price }: { e: Estimate; price?: number | null }) {
  const lo = Math.min(e.p25, price ?? e.p25) * 0.9;
  const hi = Math.max(e.p75, price ?? e.p75) * 1.1;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="relative mt-3 h-2.5 rounded-full bg-surface-2">
      <div
        className="absolute h-full rounded-full bg-brand-200 dark:bg-brand-500/40"
        style={{ left: pos(e.p25), width: `calc(${pos(e.p75)} - ${pos(e.p25)})` }}
      />
      <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600" style={{ left: pos(e.median) }} />
      {price ? <div className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-fg" style={{ left: pos(price) }} /> : null}
    </div>
  );
}

/** Property page card: "क्या यह rent fair है?" against real listings of the same locality + BHK. */
export function FairRentCard({
  listing,
}: {
  listing: {
    purpose: string;
    category: string;
    bedrooms: number | null;
    price: number;
    furnishing: string | null;
    locality: { id?: string; name: string };
    localityId?: string;
  };
}) {
  const on = useFlag('fair_rent');
  const localityId = listing.localityId ?? listing.locality.id;
  const enabled = on && listing.purpose === 'RENT' && listing.category === 'RESIDENTIAL' && !!listing.bedrooms && !!localityId;
  const q = useQuery({
    queryKey: ['fair-rent', localityId, listing.bedrooms, listing.furnishing, listing.price],
    queryFn: () => fetchEstimate(localityId!, listing.bedrooms!, listing.furnishing, listing.price),
    enabled,
    staleTime: 600_000,
  });
  if (!enabled || !q.data?.enough) return null;
  const e = q.data;
  const v = e.verdict ? VERDICT[e.verdict] : null;
  return (
    <div className="card mt-4 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <Scale className="size-4 text-brand-600" /> क्या यह rent fair है?
        {v && <span className={cn('ml-auto font-bold', v.tone)}>{v.text}</span>}
      </p>
      <RangeBar e={e} price={listing.price} />
      <p className="mt-2 text-xs text-muted">
        {e.scope === 'LOCALITY' ? e.locality : `${e.zone} zone`} में {e.bedrooms} BHK का आम किराया {formatINR(e.p25)} – {formatINR(e.p75)} (median{' '}
        {formatINR(e.median)}) · पिछले 12 महीने की {e.samples} listings
      </p>
    </div>
  );
}

/** /tools/fair-rent — pick locality + BHK (+ furnishing) and see the real rent range. */
export function FairRentTool() {
  const on = useFlag('fair_rent');
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const [f, setF] = useState({ localityId: '', bedrooms: '2', furnishing: '', price: '' });
  const [asked, setAsked] = useState<typeof f | null>(null);
  const q = useQuery({
    queryKey: ['fair-rent-tool', asked],
    queryFn: () => fetchEstimate(asked!.localityId, Number(asked!.bedrooms), asked!.furnishing || null, Number(asked!.price) || null),
    enabled: !!asked?.localityId,
  });
  if (!on) return <p className="text-sm text-muted">यह tool अभी उपलब्ध नहीं है।</p>;
  const e = q.data;
  return (
    <div className="card grid gap-8 p-6 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Locality / sector">
          <Select value={f.localityId} onChange={(ev) => setF({ ...f, localityId: ev.target.value })}>
            <option value="">चुनें</option>
            {(locs.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="BHK">
            <Select value={f.bedrooms} onChange={(ev) => setF({ ...f, bedrooms: ev.target.value })}>
              {[1, 2, 3, 4, 5].map((b) => (
                <option key={b} value={b}>
                  {b} BHK
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Furnishing">
            <Select value={f.furnishing} onChange={(ev) => setF({ ...f, furnishing: ev.target.value })}>
              <option value="">कोई भी</option>
              <option value="UNFURNISHED">Unfurnished</option>
              <option value="SEMI_FURNISHED">Semi-furnished</option>
              <option value="FULLY_FURNISHED">Fully furnished</option>
            </Select>
          </Field>
        </div>
        <Field label="आपसे माँगा गया किराया (optional)">
          <Input inputMode="numeric" placeholder="₹" value={f.price} onChange={(ev) => setF({ ...f, price: ev.target.value.replace(/\D/g, '') })} />
        </Field>
        <Button disabled={!f.localityId} onClick={() => setAsked({ ...f })}>
          Fair rent देखें
        </Button>
      </div>
      <div>
        {!asked ? (
          <p className="text-sm text-muted">BrokerIQ पर पिछले 12 महीनों की असली listings से — कोई अंदाज़ा नहीं, कोई AI guess नहीं।</p>
        ) : q.isLoading ? (
          <Skeleton className="h-40" />
        ) : !e?.enough ? (
          <p className="rounded-2xl bg-surface-2 p-4 text-sm">
            इस locality + BHK के लिए अभी data कम है ({e?.samples ?? 0} listings)। पास के sector या दूसरा BHK देखें।
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="text-xs text-muted">
                Median rent · {e.bedrooms} BHK · {e.scope === 'LOCALITY' ? e.locality : `${e.zone} zone`}
              </p>
              <p className="font-display text-3xl font-extrabold text-brand-600">{formatINR(e.median)}</p>
              <p className="text-sm">
                ज़्यादातर घर {formatINR(e.p25)} – {formatINR(e.p75)} में
              </p>
              <RangeBar e={e} price={Number(asked.price) || null} />
            </div>
            {e.verdict && <p className={cn('text-lg font-bold', VERDICT[e.verdict].tone)}>{VERDICT[e.verdict].text}</p>}
            <p className="text-xs text-muted">
              {e.samples} listings{e.furnishingApplied ? ' (same furnishing)' : ''} · पिछले 12 महीने
            </p>
            <Button variant="secondary" href={`/rent?localities=${locs.data?.find((l) => l.id === asked.localityId)?.slug ?? ''}&bedrooms=${asked.bedrooms}`}>
              ऐसे घर देखें →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
