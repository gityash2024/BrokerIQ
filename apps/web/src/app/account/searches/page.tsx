'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BellRing, Search, Trash2 } from 'lucide-react';
import { formatPriceShort } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { del, patch, useApiMutation } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Empty, Switch } from '@/components/ui/misc';

export default function SearchesPage() {
  const q = useQuery({ queryKey: ['saved-searches'], queryFn: () => api<any[]>('/me/saved-searches') });
  const toggle = useApiMutation((v: { id: string; on: boolean }) => patch(`/me/saved-searches/${v.id}`, { alertsEnabled: v.on }), {
    invalidate: [['saved-searches']],
  });
  const toggleWa = useApiMutation((v: { id: string; on: boolean }) => patch(`/me/saved-searches/${v.id}`, { whatsappAlerts: v.on }), {
    invalidate: [['saved-searches']],
    success: (r: any) => (r.whatsappAlerts ? 'WhatsApp alerts चालू — profile में mobile number होना चाहिए' : 'WhatsApp alerts बंद'),
  });
  const remove = useApiMutation((id: string) => del(`/me/saved-searches/${id}`), { invalidate: [['saved-searches']], success: 'Deleted' });
  const href = (f: any) =>
    `/${f.purpose === 'RENT' ? 'rent' : f.category === 'COMMERCIAL' ? 'commercial' : f.category === 'PLOT' ? 'plots' : 'buy'}?${new URLSearchParams(
      Object.entries(f)
        .filter(([k, v]) => v != null && v !== '' && !['purpose', 'category', 'page', 'pageSize'].includes(k))
        .map(([k, v]) => [k, String(v)]),
    ).toString()}`;
  return (
    <>
      <PageHeader title="Saved searches & alerts" subtitle="नई matching property आते ही app, email पर notification" />
      {!q.data?.length ? (
        <Empty
          icon={<Search className="size-6" />}
          title="कोई saved search नहीं"
          text="Search page पर “Save search” दबाएँ।"
          action={<Button href="/rent">Search करें</Button>}
        />
      ) : (
        <div className="space-y-3">
          {q.data.map((s) => (
            <div key={s.id} className="card flex flex-wrap items-center gap-4 p-4">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
                <BellRing className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={href(s.filters)} className="font-semibold hover:text-brand-600">
                  {s.name}
                </Link>
                <p className="text-xs text-muted">
                  {s.filters.minPrice || s.filters.maxPrice
                    ? `${formatPriceShort(s.filters.minPrice) ?? 'Any'} – ${formatPriceShort(s.filters.maxPrice)} · `
                    : ''}
                  Saved {formatDate(s.createdAt)}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={s.alertsEnabled} onCheckedChange={(on) => toggle.mutate({ id: s.id, on })} /> Alerts
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!s.whatsappAlerts} onCheckedChange={(on) => toggleWa.mutate({ id: s.id, on })} /> WhatsApp
              </label>
              <Button size="icon-sm" variant="ghost" onClick={() => remove.mutate(s.id)} aria-label="Delete">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
