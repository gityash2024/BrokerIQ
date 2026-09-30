'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Search, Star } from 'lucide-react';
import { LISTING_STATUS_LABELS, formatPriceShort, type ListingStatus } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, useApiMutation, useDebounced } from '@/lib/hooks';
import { cn, formatDate, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Pager } from '@/components/admin/crud';
import { Input, Select } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { BulkBar, ListingActions } from '@/components/admin/controls';

const TONE: Record<string, any> = {
  ACTIVE: 'success',
  PENDING_REVIEW: 'warning',
  REJECTED: 'danger',
  BLOCKED: 'danger',
  DRAFT: 'neutral',
  SOLD: 'info',
  RENTED: 'info',
  EXPIRED: 'neutral',
  ARCHIVED: 'neutral',
};

export default function AdminListings() {
  const [f, setF] = useState({ q: '', status: '', page: 1 });
  const dq = useDebounced(f.q);
  const q = useQuery({
    queryKey: ['admin-listings', { ...f, q: dq }],
    queryFn: () => api<any>(`/admin/listings${qs({ ...f, q: dq })}`),
    placeholderData: (p) => p,
  });
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const flags = useApiMutation(({ id, ...b }: any) => patch(`/admin/listings/${id}/flags`, b), { success: 'Updated', invalidate: [['admin-listings']] });
  return (
    <>
      <PageHeader
        title="All listings"
        subtitle={q.data ? `${q.data.total} listings — block/unblock, status, delete, featured/verified और bulk actions` : ' '}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-full sm:w-72">
          <Input
            icon={<Search className="size-4" />}
            className="h-10"
            placeholder="Title / slug"
            value={f.q}
            onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })}
          />
        </div>
        <Select className="h-10 w-44" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })}>
          <option value="">All status</option>
          {Object.entries(LISTING_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
          <option value="DELETED">Deleted (restore)</option>
        </Select>
      </div>
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !q.data.items.length ? (
        <Empty title="कोई listing नहीं" />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold text-subtle uppercase">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="size-4"
                      checked={q.data.items.length > 0 && q.data.items.every((l: any) => sel.includes(l.id))}
                      onChange={(e) => setSel(e.target.checked ? q.data.items.map((l: any) => l.id) : [])}
                    />
                  </th>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Posted by</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Views</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-center">Featured</th>
                  <th className="px-4 py-3 text-center">Verified</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((l: any) => (
                  <tr key={l.id} className={cn('border-b border-line last:border-0', sel.includes(l.id) && 'bg-brand-50/60 dark:bg-brand-500/10')}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" aria-label="Select" className="size-4" checked={sel.includes(l.id)} onChange={() => toggle(l.id)} />
                    </td>
                    <td className="max-w-xs px-4 py-2.5">
                      <Link href={`/property/${l.slug}`} target="_blank" className="line-clamp-1 font-semibold hover:text-brand-600">
                        {l.title}
                      </Link>
                      <p className="text-xs text-muted">
                        #{l.refNo} · {l.locality.name}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{formatPriceShort(l.price)}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {l.organization?.name ?? l.postedBy.name}
                      <br />
                      <span className="text-muted">{l.postedBy.email}</span>
                    </td>
                    <td className="max-w-[12rem] px-4 py-2.5">
                      <Badge tone={l.deletedAt ? 'danger' : TONE[l.status]}>
                        {l.deletedAt ? 'Deleted' : (LISTING_STATUS_LABELS[l.status as ListingStatus] ?? l.status)}
                      </Badge>
                      {l.blockedReason && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-rose-600" title={l.blockedReason}>
                          {l.blockedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">{l.views}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{formatDate(l.createdAt)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => flags.mutate({ id: l.id, isFeatured: !l.isFeatured, featuredDays: 30 })} aria-label="Toggle featured">
                        <Star className={cn('mx-auto size-5', l.isFeatured ? 'fill-saffron-500 text-saffron-500' : 'text-line hover:text-saffron-400')} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => flags.mutate({ id: l.id, isVerified: !l.isVerified })} aria-label="Toggle verified">
                        <BadgeCheck className={cn('mx-auto size-5', l.isVerified ? 'text-emerald-500' : 'text-line hover:text-emerald-400')} />
                      </button>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <ListingActions l={l} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BulkBar ids={sel} onDone={() => setSel([])} />
          <Pager page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onPage={(p) => setF({ ...f, page: p })} />
        </>
      )}
    </>
  );
}
