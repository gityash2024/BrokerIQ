'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Check, ShieldAlert, X } from 'lucide-react';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

export default function ReportsPage() {
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED'>('OPEN');
  const q = useQuery({ queryKey: ['admin-reports', status], queryFn: () => api<any[]>(`/admin/reports?status=${status}`) });
  const resolve = useApiMutation((b: any) => patch(`/admin/reports/${b.id}`, b), { success: 'Done', invalidate: [['admin-reports'], ['admin-dashboard']] });
  return (
    <>
      <PageHeader title="Reported listings" subtitle="Users की शिकायतें — fake, sold, गलत price, spam" />
      <Segmented
        className="mb-5"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'OPEN', label: 'Open' },
          { value: 'RESOLVED', label: 'Resolved' },
          { value: 'DISMISSED', label: 'Dismissed' },
        ]}
      />
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : !q.data.length ? (
        <Empty icon={<ShieldAlert className="size-7" />} title="कोई report नहीं" />
      ) : (
        <div className="space-y-3">
          {q.data.map((r) => (
            <div key={r.id} className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">{r.reason.replace(/_/g, ' ')}</Badge>
                  <Link href={`/property/${r.listing.slug}`} target="_blank" className="font-semibold hover:text-brand-600">
                    {r.listing.title}
                  </Link>
                  <Badge>{r.listing.status}</Badge>
                </div>
                {r.details && <p className="mt-1 text-sm text-muted">“{r.details}”</p>}
                <p className="mt-1 text-xs text-subtle">
                  {r.user ? `${r.user.name} (${r.user.email})` : 'Anonymous'} · {formatDateTime(r.createdAt)}
                  {r.resolution ? ` · ${r.resolution}` : ''}
                </p>
              </div>
              {status === 'OPEN' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: r.id, status: 'DISMISSED', resolution: 'No issue found' })}>
                    <X className="size-4" /> Dismiss
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => resolve.mutate({ id: r.id, status: 'RESOLVED', resolution: 'Owner contacted' })}>
                    <Check className="size-4" /> Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      confirm('Listing archive (हटाएँ) करें?') &&
                      resolve.mutate({ id: r.id, status: 'RESOLVED', resolution: 'Listing archived', archiveListing: true })
                    }
                  >
                    <Archive className="size-4" /> Archive listing
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
