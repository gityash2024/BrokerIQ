'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ListingCard } from '@/components/site/listing-card';
import { ApiErrorState } from '@/components/ui/api-error';
export function RecentlyViewed() {
  const q = useQuery({ queryKey: ['recent'], queryFn: () => api<any[]>('/listings/recent') });
  return (
    <section>
      <h2 className="mb-4 font-display text-lg font-bold">Recently viewed</h2>
      {q.error ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.slice(0, 3).map((row) => (
            <ListingCard key={row.id} l={row.listing ?? row} />
          ))}
        </div>
      ) : (
        <p className="card p-5 text-sm text-muted">Explore rentals and your recently viewed properties will appear here.</p>
      )}
    </section>
  );
}
