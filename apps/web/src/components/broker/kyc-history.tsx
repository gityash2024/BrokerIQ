'use client';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';
import { KycMedia } from './kyc-media';
import { formatDateTime } from '@/lib/utils';
export function KycHistory({ member }: { member?: string }) {
  const [open, setOpen] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['kyc-history', member],
    enabled: open,
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<{ items: any[]; nextCursor: string | null }>(
        `/broker/team/agent-kyc/history?member=${encodeURIComponent(member ?? '')}&cursor=${encodeURIComponent(pageParam)}`,
      ),
    getNextPageParam: (last) => last.nextCursor || undefined,
  });
  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(!open)}>
        पिछली KYC submissions {open ? 'बंद करें' : 'देखें'}
      </Button>
      {open &&
        (q.isError ? (
          <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <p>इतिहास खुल रहा है…</p>
        ) : (
          <>
            {!q.data?.pages.some((p) => p.items.length) && <p className="text-sm text-muted">पिछली submission नहीं है।</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {q.data?.pages
                .flatMap((p) => p.items)
                .map((d) => (
                  <div key={d.id} className="rounded-xl border border-line p-3">
                    <p className="text-xs">
                      {d.docType} · {d.docNumber?.startsWith('LIVELINESS_') ? d.docNumber : ''} · {d.status} · {formatDateTime(d.createdAt)}
                    </p>
                    {d.reviewNote && <p className="text-sm text-muted">{d.reviewNote}</p>}
                    <KycMedia src={d.fileUrl} alt={`Previous ${d.docType}`} className="h-48 w-full object-contain" />
                  </div>
                ))}
            </div>
            {q.hasNextPage && (
              <Button type="button" variant="secondary" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                और देखें
              </Button>
            )}
          </>
        ))}
    </div>
  );
}
