'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';

const DIMS = ['water', 'power', 'safety', 'parking', 'connectivity', 'maintenance'];

export default function LocalityReviewsAdmin() {
  const [status, setStatus] = useState('PENDING');
  const q = useQuery({ queryKey: ['admin-loc-reviews', status], queryFn: () => api<any[]>(`/admin/locality-reviews?status=${status}`) });
  const act = useApiMutation((b: { id: string; status: string }) => patch(`/admin/locality-reviews/${b.id}`, { status: b.status }), {
    success: 'Updated',
    invalidate: [['admin-loc-reviews']],
  });
  return (
    <>
      <PageHeader title="Locality & society reviews" subtitle="Residents के reviews — approve होने पर ही locality और property pages पर दिखते हैं" />
      <Segmented
        value={status}
        onChange={setStatus}
        className="mb-4"
        options={[
          { value: 'PENDING', label: 'Pending' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
        ]}
      />
      {q.isLoading ? (
        <Skeleton className="h-40" />
      ) : !q.data?.length ? (
        <Empty icon={<Star className="size-6" />} title="कोई review नहीं" />
      ) : (
        <div className="space-y-3">
          {q.data.map((r) => (
            <div key={r.id} className="card space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {r.locality.name}
                  {r.societyName ? ` · ${r.societyName}` : ''}
                </p>
                <span className="text-xs text-muted">
                  {formatDate(r.createdAt)}
                  {r.isResident ? ' · Resident' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DIMS.map((d) => (
                  <Badge key={d}>
                    {d} {r[d]}★
                  </Badge>
                ))}
              </div>
              {r.pros && <p>👍 {r.pros}</p>}
              {r.cons && <p>👎 {r.cons}</p>}
              {status !== 'APPROVED' && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => act.mutate({ id: r.id, status: 'APPROVED' })}>
                    Approve
                  </Button>
                  {status === 'PENDING' && (
                    <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: r.id, status: 'REJECTED' })}>
                      Reject
                    </Button>
                  )}
                </div>
              )}
              {status === 'APPROVED' && (
                <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: r.id, status: 'REJECTED' })}>
                  Hide
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
