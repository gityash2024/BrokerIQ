'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { formatDate, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Pager } from '@/components/admin/crud';
import { Segmented } from '@/components/ui/tabs';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

export default function Page() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['admin-subs', status, page], queryFn: () => api<any>(`/admin/subscriptions${qs({ status, page })}`), placeholderData: (p) => p });
  return (
    <>
      <PageHeader title="Subscriptions" subtitle="हर broker firm का current plan" />
      <Segmented className="mb-4" value={status} onChange={(v) => (setStatus(v), setPage(1))} options={[{ value: '', label: 'All' }, { value: 'ACTIVE', label: 'Active' }, { value: 'TRIALING', label: 'Trial' }, { value: 'PAST_DUE', label: 'Past due' }, { value: 'EXPIRED', label: 'Expired' }, { value: 'CANCELLED', label: 'Cancelled' }]} />
      {q.isError ? <ApiErrorState error={q.error} /> : !q.data ? <Skeleton className="h-72 rounded-2xl" /> : !q.data.items.length ? <Empty title="कोई subscription नहीं" /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold text-subtle uppercase"><tr><th className="px-4 py-3">Firm</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Cycle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Period end</th><th className="px-4 py-3">Auto-renew</th></tr></thead>
              <tbody>
                {q.data.items.map((s: any) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{s.organization.name}</td>
                    <td className="px-4 py-2.5">{s.plan.name} <span className="text-xs text-muted">{formatINR(s.billingCycle === 'YEARLY' ? s.plan.priceYearly : s.plan.priceMonthly)}</span></td>
                    <td className="px-4 py-2.5 text-xs">{s.billingCycle}</td>
                    <td className="px-4 py-2.5"><Badge tone={s.status === 'ACTIVE' ? 'success' : s.status === 'TRIALING' ? 'info' : 'warning'}>{s.status}</Badge></td>
                    <td className="px-4 py-2.5 text-xs text-muted">{s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : '—'}</td>
                    <td className="px-4 py-2.5 text-xs">{s.cancelAtPeriodEnd ? 'Cancels at end' : 'Yes'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
