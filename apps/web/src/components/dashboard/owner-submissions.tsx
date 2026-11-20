'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { hasDelegatedAccess, inventoryDateLabel, type OwnerSubmissionQueue } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';

export function OwnerSubmissions() {
  const { user } = useAuth();
  const allowed = user?.role === 'BROKER_ADMIN' || (user?.role === 'SUB_BROKER_ADMIN' && hasDelegatedAccess(user, 'inventory', 'view'));
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ['owner-submissions', user?.organization?.id, user?.id, page],
    queryFn: () => api<OwnerSubmissionQueue>('/inventory/owner-submissions?page=' + page),
    enabled: !!allowed,
    refetchInterval: 30_000,
  });
  if (!allowed) return null;
  const data = queue.data;
  return (
    <section className="card space-y-2 p-4" aria-label="Owner submissions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Owner submissions</h3>
          <p className="text-sm text-muted">{data ? `${data.pendingCount} pending · ${data.ownerCount} owners` : 'Loading submissions…'}</p>
        </div>
        {data && (
          <Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide submissions' : 'Review submissions'}
          </Button>
        )}
      </div>
      {queue.error && <ApiErrorState error={queue.error} onRetry={() => queue.refetch()} />}
      {open && data && (
        <>
          {!data.items.length && <p className="text-sm text-muted">No submissions on this page.</p>}
          {data.items.map((item) => (
            <Link className="block rounded-lg border border-line p-3 hover:border-brand-500" key={item.id} href={'/broker/inventory/' + item.id}>
              <p className="font-semibold">{[item.houseNo && 'House ' + item.houseNo, item.sector].filter(Boolean).join(' · ') || 'Property'}</p>
              <p className="text-sm text-muted">
                {item.ownerName}
                {item.availableFrom && ' · Available from ' + inventoryDateLabel(item.availableFrom)}
              </p>
            </Link>
          ))}
          {(page > 1 || data.hasMore) && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
