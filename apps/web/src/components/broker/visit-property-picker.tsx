'use client';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { visitInventoryDetails, visitInventoryTitle, type LedgerItem } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { qs } from '@/lib/utils';
import { Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';

type Result = { items: LedgerItem[]; total: number; totalPages: number };
export function VisitPropertyPicker({ value, onChange }: { value: LedgerItem | null; onChange: (item: LedgerItem | null) => void }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const term = useDebounced(search);
  const list = useInfiniteQuery({
    queryKey: ['visit-inventory-picker', user?.id, term],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Result>(`/inventory${qs({ page: pageParam, pageSize: 25, search: term })}`),
    getNextPageParam: (last, pages) => (pages.length < last.totalPages ? pages.length + 1 : undefined),
  });
  if (value)
    return (
      <div className="rounded-xl border border-brand-300 p-3">
        <p className="font-semibold">{visitInventoryTitle(value)}</p>
        <p className="text-xs text-muted">{visitInventoryDetails(value)}</p>
        <Button type="button" size="xs" variant="ghost" onClick={() => onChange(null)}>
          Change / custom address
        </Button>
      </div>
    );
  return (
    <div className="space-y-2">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="House / floor / sector / address" />
      {list.isError ? (
        <ApiErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <div className="max-h-52 overflow-y-auto rounded-xl border border-line">
          {list.data?.pages
            .flatMap((page) => page.items)
            .map((item) => (
              <button type="button" key={item.id} onClick={() => onChange(item)} className="block w-full border-b border-line p-3 text-left hover:bg-surface-2">
                <p className="text-sm font-semibold">{visitInventoryTitle(item)}</p>
                <p className="text-xs text-muted">{visitInventoryDetails(item)}</p>
              </button>
            ))}
          {list.isPending && <p className="p-3 text-sm text-muted">Loading…</p>}
          {list.data?.pages[0].total === 0 && <p className="p-3 text-sm text-muted">No matching property. Enter a custom meeting address below.</p>}
          {list.hasNextPage && (
            <Button type="button" size="xs" variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
