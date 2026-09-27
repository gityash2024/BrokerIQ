'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, IndianRupee } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Pager } from '@/components/admin/crud';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge, Empty, Skeleton, Stat } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

export default function Page() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['admin-payments', status, page], queryFn: () => api<any>(`/admin/payments${qs({ status, page })}`), placeholderData: (p) => p });
  const invoice = async (p: any) => {
    try {
      const res = await api<Response>(`/billing/payments/${p.id}/invoice`, { raw: true });
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <PageHeader title="Payments" subtitle="Razorpay से आए सारे payments — subscriptions और listing boosts" />
      {q.data && <Stat className="mb-5 max-w-xs" label="Total collected (all time)" value={formatINR(q.data.totalPaid)} icon={<IndianRupee className="size-5" />} tone="success" />}
      <Segmented className="mb-4" value={status} onChange={(v) => (setStatus(v), setPage(1))} options={[{ value: '', label: 'All' }, { value: 'PAID', label: 'Paid' }, { value: 'CREATED', label: 'Pending' }, { value: 'FAILED', label: 'Failed' }, { value: 'REFUNDED', label: 'Refunded' }]} />
      {q.isError ? <ApiErrorState error={q.error} /> : !q.data ? <Skeleton className="h-72 rounded-2xl" /> : !q.data.items.length ? <Empty title="अभी कोई payment नहीं" /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold text-subtle uppercase"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Purpose</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Razorpay</th><th /></tr></thead>
              <tbody>
                {q.data.items.map((p: any) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted">{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-4 py-2.5">{p.organization?.name ?? 'Owner'}</td>
                    <td className="px-4 py-2.5 text-xs">{p.purpose}{p.couponCode ? ` · ${p.couponCode}` : ''}</td>
                    <td className="px-4 py-2.5 font-semibold">{formatINR(p.amount / 100)}</td>
                    <td className="px-4 py-2.5"><Badge tone={p.status === 'PAID' ? 'success' : p.status === 'FAILED' ? 'danger' : 'neutral'}>{p.status}</Badge></td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted">{p.razorpayPaymentId ?? p.razorpayOrderId ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">{p.status === 'PAID' && <Button size="xs" variant="ghost" onClick={() => invoice(p)}><Download className="size-3.5" /> {p.invoiceNumber}</Button>}</td>
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
