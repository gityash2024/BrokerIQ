'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ApiErrorState } from '@/components/ui/api-error';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
function Records({ role }: { role: 'admin' | 'broker' | 'user' }) {
  const sp = useSearchParams();
  const router = useRouter();
  const selection = new URLSearchParams(sp.toString());
  if (!selection.get('chart')) selection.set('chart', role === 'admin' ? 'signups' : role === 'broker' ? 'leads' : 'enquiries');
  const params = selection.toString();
  const path = role === 'admin' ? '/admin/dashboard/records' : role === 'broker' ? '/broker/dashboard/records' : '/me/dashboard/records';
  const q = useQuery({
    queryKey: ['dashboard-records', role, params],
    queryFn: () => api<{ total: number; page: number; items: { id: string; label: string; detail: string; at: string; href: string }[] }>(path + '?' + params),
  });
  return (
    <>
      <PageHeader
        title="Activity details"
        subtitle={
          sp.get('from') && sp.get('to')
            ? `${sp.get('value') ?? ''} · ${sp.get('from')} — ${sp.get('to')} · IST`
            : 'Recorded activity in the last 30 days · IST'
        }
        actions={
          <Button size="sm" variant="secondary" onClick={() => router.back()}>
            ← Back
          </Button>
        }
      />
      {q.error ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <p className="text-sm text-muted">Loading records…</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted">{q.data.total.toLocaleString('en-IN')} matching records · IST</p>
          <div className="card divide-y divide-line">
            {q.data.items.length ? (
              q.data.items.map((r) => (
                <Link key={r.id} href={r.href} className="flex items-center justify-between gap-4 p-4 transition hover:bg-surface-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="mt-1 text-xs text-muted">{r.detail.replace(/_/g, ' ')}</p>
                  </div>
                  <time className="shrink-0 text-[10px] text-muted">{new Date(r.at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} ↗</time>
                </Link>
              ))
            ) : (
              <p className="p-8 text-center text-sm text-muted">No records match this selection.</p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            {[q.data.page - 1, q.data.page + 1].map((page, i) => (
              <Button
                key={i}
                size="sm"
                variant="secondary"
                disabled={page < 1 || page > Math.ceil(q.data!.total / 30)}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(page));
                  router.replace('?' + next);
                }}
              >
                {i ? 'Next →' : '← Previous'}
              </Button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
export function DashboardRecords({ role }: { role: 'admin' | 'broker' | 'user' }) {
  return (
    <Suspense>
      <Records role={role} />
    </Suspense>
  );
}
