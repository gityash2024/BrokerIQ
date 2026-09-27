'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Pop from '@radix-ui/react-popover';
import { Search } from 'lucide-react';
import { LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';

export function QuickLeadSearch() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const { data } = useQuery({ queryKey: ['quick-leads', dq], queryFn: () => api<any>(`/leads?q=${encodeURIComponent(dq)}&pageSize=8`), enabled: dq.length >= 2 });
  return (
    <Pop.Root open={dq.length >= 2 && !!data}>
      <Pop.Anchor asChild>
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lead खोजें — नाम / phone" className="h-10 w-full rounded-xl border border-line bg-surface-2 pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:bg-surface" />
        </div>
      </Pop.Anchor>
      <Pop.Portal>
        <Pop.Content align="start" sideOffset={6} onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={() => setQ('')} className="z-50 w-[360px] rounded-2xl border border-line bg-surface p-2 shadow-2xl">
          {data?.items.length ? (
            data.items.map((l: any) => (
              <Link key={l.id} href={`/broker/leads/${l.id}`} onClick={() => setQ('')} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-surface-2">
                <span>
                  <span className="block text-sm font-semibold">{l.name}</span>
                  <span className="text-xs text-muted">{l.phone} · {LEAD_SOURCE_LABELS[l.source as keyof typeof LEAD_SOURCE_LABELS]}</span>
                </span>
                <span className="text-xs text-subtle">{LEAD_STAGE_LABELS[l.stage as keyof typeof LEAD_STAGE_LABELS]}</span>
              </Link>
            ))
          ) : (
            <p className="p-3 text-sm text-muted">कोई lead नहीं मिली</p>
          )}
        </Pop.Content>
      </Pop.Portal>
    </Pop.Root>
  );
}
