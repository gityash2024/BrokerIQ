'use client';
import { useRouteState } from '@/lib/navigation';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { GURUGRAM_SECTOR_MAPS_URL, googleDirections, gurugramSectorMaps, type MappedVisit } from '@brokeriq/shared';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
import { LoadingArtwork } from '@/components/ui/request-loader';
import { Button } from '@/components/ui/button';
import { VisitItinerary } from '@/components/broker/visit-itinerary';
import { api } from '@/lib/api';

export default function PropertyMapsPage() {
  const [from] = useState(() => new Date().toISOString());
  const [sectorSearch, setSectorSearch] = useRouteState('maps.sectorSearch', '');
  const maps = gurugramSectorMaps(sectorSearch);
  const query = useInfiniteQuery({
    queryKey: ['visits', 'property-maps', from],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<{ items: MappedVisit[]; pages: number }>(
        `/visits?from=${encodeURIComponent(from)}&directions=true&upcoming=true&paginated=true&pageSize=30&page=${pageParam}`,
      ),
    getNextPageParam: (last, pages) => (pages.length < last.pages ? pages.length + 1 : undefined),
  });
  const visits = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="space-y-5">
      <PageHeader title="Property Maps" subtitle="Directions for your upcoming site visits" />
      <a
        href={GURUGRAM_SECTOR_MAPS_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-xl border border-line px-4 py-3 text-sm font-semibold text-brand-600"
      >
        Gurugram sector maps · ABC Buildcon
      </a>
      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-semibold">Find a sector map</summary>
        <input
          aria-label="Search maps by sector or locality"
          value={sectorSearch}
          onChange={(event) => setSectorSearch(event.target.value)}
          placeholder="Sector or locality"
          className="my-3 w-full max-w-md rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {maps.slice(0, 12).map((map) => (
            <a key={map.url} href={map.url} target="_blank" rel="noreferrer" className="rounded-xl border border-line p-3 text-sm font-semibold text-brand-600">
              {map.name}
            </a>
          ))}
        </div>
        {!maps.length && <p className="text-sm text-muted">No sector maps match.</p>}
      </details>
      {query.isPending ? <LoadingArtwork label="Loading visits" /> : null}
      {query.isError ? <ApiErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.isSuccess && !visits.length && <p className="text-sm text-muted">No upcoming visits.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {visits.map((visit) => (
          <article key={visit.id} className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="font-semibold">{visit.lead.name}</h2>
            <p className="my-1 text-sm text-muted">
              {new Date(visit.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {visit.status.replace(/_/g, ' ')}
            </p>
            {visit.address && (
              <a href={googleDirections(visit.address)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600 underline">
                Search meeting point
              </a>
            )}
            <VisitItinerary snapshot={visit.propertySnapshot} />
          </article>
        ))}
      </div>
      {query.hasNextPage && (
        <Button variant="secondary" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
          Load more visits
        </Button>
      )}
    </div>
  );
}
