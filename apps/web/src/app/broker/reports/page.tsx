'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileDown, FileSpreadsheet, IndianRupee, Receipt, Users } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Skeleton, Stat } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const fyStart = () => {
  const [y, m] = istToday().split('-').map(Number);
  return `${m >= 4 ? y : y - 1}-04-01`;
};

/** Monthly deals, commission, invoices and GST — CSV for Excel/Tally, PDF for the CA. */
export default function ReportsPage() {
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(istToday());
  const qs = `from=${from}&to=${to}`;
  const q = useQuery({ queryKey: ['broker-reports', from, to], queryFn: () => api<any>(`/broker/reports?${qs}`) });
  const [busy, setBusy] = useState<string | null>(null);

  // Files need the auth header, so fetch them (with token refresh) and save the blob.
  const download = async (path: string, name: string) => {
    setBusy(name);
    try {
      const res = await api<Response>(path, { raw: true });
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const t = q.data?.totals;
  return (
    <>
      <PageHeader title="Reports & GST" subtitle="Deals, commission, invoices और GST का हिसाब — Excel/Tally के लिए CSV, CA के लिए PDF" />
      <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="From">
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={busy === 'business-report.pdf'}
            onClick={() => download(`/broker/reports/export.pdf?${qs}`, 'business-report.pdf')}
          >
            <FileDown className="size-4" /> PDF
          </Button>
          {(
            [
              ['deals', 'Deals CSV'],
              ['invoices', 'Invoices CSV'],
              ['gst', 'GST summary CSV'],
              ['agents', 'Agents CSV'],
            ] as const
          ).map(([type, label]) => (
            <Button
              key={type}
              variant="secondary"
              loading={busy === `${type}.csv`}
              onClick={() => download(`/broker/reports/export.csv?type=${type}&${qs}`, `${type}_${from}_to_${to}.csv`)}
            >
              <FileSpreadsheet className="size-4" /> {label}
            </Button>
          ))}
        </div>
      </div>
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !t ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Deals closed" value={t.deals} icon={<Users className="size-5" />} hint={`${t.leads} नई leads · ${t.visits} visits`} />
            <Stat label="Commission" value={formatINR(t.commission)} icon={<IndianRupee className="size-5" />} hint={`${formatINR(t.received)} मिला`} />
            <Stat label="Pending" value={formatINR(t.pending)} icon={<IndianRupee className="size-5" />} tone="warning" />
            <Stat label="Invoiced" value={formatINR(t.invoiced)} icon={<Receipt className="size-5" />} hint={`GST ${formatINR(t.gst)}`} />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  {['Month', 'Deals', 'Deal value', 'Commission', 'Received', 'Invoiced', 'GST'].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data.months.length ? (
                  q.data.months.map((m: any) => (
                    <tr key={m.month} className="border-t border-line">
                      <td className="px-4 py-2.5 font-semibold">
                        {new Date(`${m.month}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5">{m.deals}</td>
                      <td className="px-4 py-2.5">{formatINR(m.dealValue)}</td>
                      <td className="px-4 py-2.5">{formatINR(m.commission)}</td>
                      <td className="px-4 py-2.5">{formatINR(m.received)}</td>
                      <td className="px-4 py-2.5">{formatINR(m.invoiced)}</td>
                      <td className="px-4 py-2.5">{formatINR(m.gst)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted">
                      इस दौरान कोई deal या invoice नहीं
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {q.data.agents.length > 0 && (
            <div className="card p-5">
              <p className="mb-3 font-display font-bold">Agent-wise</p>
              <ul className="divide-y divide-line text-sm">
                {q.data.agents.map((a: any) => (
                  <li key={a.agent} className="flex justify-between py-2">
                    <span data-no-i18n>{a.agent}</span>
                    <span>
                      {a.deals} deals · <b>{formatINR(a.commission)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted">आँकड़े आपके BrokerIQ records से हैं — filing से पहले अपने CA से मिला लें।</p>
        </div>
      )}
    </>
  );
}
