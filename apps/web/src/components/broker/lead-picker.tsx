'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { qs } from '@/lib/utils';
import type { LeadRow, Paged } from '@/lib/types';
import { Input } from '../ui/field';
import { StageBadge } from './bits';

/** Search & pick a lead from the org's CRM. */
export function LeadPicker({
  value,
  onChange,
}: {
  value: { id: string; name?: string | null; phone: string } | null;
  onChange: (l: { id: string; name?: string | null; phone: string } | null) => void;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const res = useQuery({
    queryKey: ['lead-pick', dq],
    queryFn: () => api<Paged<LeadRow>>(`/leads${qs({ q: dq, pageSize: 8 })}`),
    enabled: !value && dq.length > 1,
  });
  if (value)
    return (
      <div className="flex h-11 items-center justify-between rounded-xl border border-brand-300 bg-brand-50/50 px-3.5 text-sm dark:bg-brand-500/10">
        <span className="font-semibold">
          {value.name || 'Lead'} <span className="font-normal text-muted">· {value.phone}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-subtle hover:text-rose-600" aria-label="Clear">
          <X className="size-4" />
        </button>
      </div>
    );
  return (
    <div className="relative">
      <Input icon={<Search className="size-4" />} placeholder="Lead का नाम या phone लिखें…" value={q} onChange={(e) => setQ(e.target.value)} />
      {dq.length > 1 && (
        <div className="absolute inset-x-0 top-12 z-20 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface shadow-xl">
          {res.data?.items.map((l) => (
            <button
              type="button"
              key={l.id}
              onClick={() => {
                onChange({ id: l.id, name: l.name, phone: l.phone });
                setQ('');
              }}
              className="flex w-full items-center justify-between gap-2 border-b border-line px-3.5 py-2.5 text-left text-sm last:border-0 hover:bg-surface-2"
            >
              <span>
                <span className="font-semibold">{l.name || '—'}</span> <span className="text-muted">· {l.phone}</span>
              </span>
              <StageBadge stage={l.stage} />
            </button>
          ))}
          {res.data && !res.data.items.length && <p className="p-4 text-center text-sm text-muted">कोई lead नहीं मिली</p>}
          {res.isLoading && <p className="p-4 text-center text-sm text-muted">Searching…</p>}
        </div>
      )}
    </div>
  );
}

/** Pick one of the org's own listings (optional). */
export function ListingPicker({
  value,
  onChange,
  placeholder = 'कोई भी property (optional)',
}: {
  value: string;
  onChange: (id: string, listing?: any) => void;
  placeholder?: string;
}) {
  const res = useQuery({
    queryKey: ['my-listings-pick'],
    queryFn: () => api<Paged<any>>(`/listings/mine${qs({ pageSize: 100, status: 'ACTIVE' })}`),
    staleTime: 60_000,
  });
  return (
    <select
      value={value}
      onChange={(e) =>
        onChange(
          e.target.value,
          res.data?.items.find((l) => l.id === e.target.value),
        )
      }
      className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {res.data?.items.map((l) => (
        <option key={l.id} value={l.id}>
          {l.title}
        </option>
      ))}
    </select>
  );
}
