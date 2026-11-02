'use client';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { qs } from '@/lib/utils';

type Choice = { id: string; name: string; status: string; organization?: { id: string; name: string } };
type Page = { items: Choice[]; total: number; page: number; totalPages: number };

/** Search and page without silently restricting the hierarchy to its first 30 members. */
export function InventoryHierarchyPicker({
  kind,
  value,
  onChange,
  organizationId,
  selectedLabel,
  allowAll = true,
}: {
  kind: 'organizations' | 'members';
  value: string;
  onChange: (id: string) => void;
  organizationId?: string;
  selectedLabel?: string;
  allowAll?: boolean;
}) {
  const [search, setSearch] = useState('');
  const term = useDebounced(search);
  const label = kind === 'organizations' ? 'Firm' : 'Assignee';
  const query = useInfiniteQuery({
    queryKey: ['inventory-hierarchy', kind, organizationId, term],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page>(`/inventory/hierarchy/${kind}${qs({ search: term, organizationId, page: pageParam })}`),
    getNextPageParam: (p) => (p.page < p.totalPages ? p.page + 1 : undefined),
  });
  const choices = [...new Map((query.data?.pages.flatMap((p) => p.items) ?? []).map((p) => [p.id, p])).values()];
  return (
    <div className="min-w-52 space-y-1">
      <label className="block text-xs font-semibold">
        {label}
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm"
        >
          <option value="">{allowAll ? `All ${kind === 'organizations' ? 'firms' : 'assignees'}` : `Choose ${label.toLowerCase()}`}</option>
          {value && !choices.some((c) => c.id === value) && <option value={value}>{selectedLabel || value}</option>}
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.organization ? ` · ${c.organization.name}` : ''}
              {c.status !== 'ACTIVE' ? ` (${c.status})` : ''}
            </option>
          ))}
        </select>
      </label>
      <input
        aria-label={`Search ${label.toLowerCase()}`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${label.toLowerCase()}`}
        className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          {choices.length} / {query.data?.pages[0].total ?? '—'}
        </span>
        {query.isPending && <span>Loading…</span>}
        {query.hasNextPage && (
          <button type="button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()} className="min-h-9 font-semibold text-brand-600">
            Load more
          </button>
        )}
        {query.error && (
          <button type="button" onClick={() => query.refetch()} title={errorMessage(query.error)} className="min-h-9 text-rose-600">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
