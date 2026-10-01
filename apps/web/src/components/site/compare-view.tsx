'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { FURNISHING_LABELS, formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { formatDate, img } from '@/lib/utils';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/misc';
import { ApiErrorState } from '../ui/api-error';

type Row = [string, (l: any) => React.ReactNode];
const ROWS: Row[] = [
  ['किराया', (l) => <b>{formatINR(l.price)}/month</b>],
  ['Deposit', (l) => (l.securityDeposit ? formatINR(l.securityDeposit) : '—')],
  ['Maintenance', (l) => (l.maintenance ? formatINR(l.maintenance) : 'Included / —')],
  ['BHK / bath', (l) => `${l.bedrooms ?? '—'} BHK · ${l.bathrooms ?? '—'} bath`],
  ['Area', (l) => (l.superArea || l.builtUpArea || l.carpetArea ? `${l.superArea ?? l.builtUpArea ?? l.carpetArea} sq.ft` : '—')],
  ['Furnishing', (l) => (l.furnishing ? FURNISHING_LABELS[l.furnishing as keyof typeof FURNISHING_LABELS] : '—')],
  ['Floor', (l) => (l.floor != null ? `${l.floor}${l.totalFloors ? ` / ${l.totalFloors}` : ''}` : '—')],
  ['Parking', (l) => l.parking ?? '—'],
  ['Available', (l) => (l.availableFrom ? formatDate(l.availableFrom) : 'तुरंत')],
  ['Tenants', (l) => (l.preferredTenants?.length ? l.preferredTenants.join(', ') : 'कोई भी')],
  ['Amenities', (l) => (l.amenities?.length ? `${l.amenities.length} — ${l.amenities.slice(0, 5).join(', ')}` : '—')],
  ['Verified', (l) => (l.isVerified || l.visitVerifiedAt ? <BadgeCheck className="size-5 text-emerald-500" /> : '—')],
];

/** /compare?ids=a,b,c — 2–4 live homes side by side. */
export function CompareView() {
  const ids = (useSearchParams().get('ids') ?? '').split(',').filter(Boolean);
  const q = useQuery({
    queryKey: ['compare', ids.join(',')],
    queryFn: () => api<any[]>(`/public/compare?ids=${ids.join(',')}`, { auth: false }),
    enabled: ids.length >= 2,
  });
  if (ids.length < 2) return <p className="text-muted">Saved properties में से 2–4 घर चुनकर compare करें.</p>;
  if (q.isError) return <ApiErrorState error={q.error} />;
  if (!q.data) return <Skeleton className="h-96" />;
  const cheapest = Math.min(...q.data.map((l) => l.price));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-x-3 text-sm">
        <thead>
          <tr>
            <th className="w-32" />
            {q.data.map((l) => (
              <th key={l.id} className="align-top text-left font-normal">
                <Link href={`/property/${l.slug}`} className="block">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2">
                    {l.coverUrl && <img src={img(l.coverUrl, 480)} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <p className="mt-2 line-clamp-2 font-semibold hover:text-brand-600" data-no-i18n>
                    {l.title}
                  </p>
                </Link>
                <p className="text-xs text-muted">{l.locality?.name}</p>
                {l.price === cheapest && <p className="text-xs font-bold text-emerald-600">सबसे कम किराया</p>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, get]) => (
            <tr key={label}>
              <td className="border-t border-line py-2.5 font-semibold text-muted">{label}</td>
              {q.data.map((l) => (
                <td key={l.id} className="border-t border-line py-2.5">
                  {get(l)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td />
            {q.data.map((l) => (
              <td key={l.id} className="pt-4">
                <Button size="sm" href={`/property/${l.slug}`}>
                  देखें / visit book करें
                </Button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
