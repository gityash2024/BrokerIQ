'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LedgerItem } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { PublicationReview } from '@/components/broker/launch/publication-review';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
export default function PublicationQueue() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const allowed = !!user && ['SUPER_ADMIN', 'BROKER_ADMIN'].includes(user.role);
  const query = useQuery({
    queryKey: ['publication-queue', user?.id, page],
    queryFn: () =>
      api<{ items: NonNullable<LedgerItem['publishedListing']>[]; total: number; page: number; totalPages: number }>(
        `/inventory/publications/queue?page=${page}`,
      ),
    enabled: allowed,
  });
  if (!allowed) return <p role="alert">Broker Admin or Super Admin review access required.</p>;
  return (
    <>
      <PageHeader title="Publication reviews" subtitle="Review the submitted public details before approval. Unverified firms require Super Admin approval." />
      {query.error && <ApiErrorState error={query.error} onRetry={() => query.refetch()} />}
      <div className="space-y-5">
        {query.data?.items.map((listing) => (
          <PublicationReview
            key={listing.id + listing.updatedAt}
            listing={listing}
            onDone={() => {
              void query.refetch();
            }}
          />
        ))}
      </div>
      {query.isPending && <p role="status">Loading publication reviews…</p>}
      {query.data?.total === 0 && <p className="card p-8 text-muted">No publications await your approval.</p>}
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={!query.data || page >= query.data.totalPages} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </>
  );
}
