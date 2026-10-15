'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
export default function AdminOverview() {
  const q = useQuery({ queryKey: ['launch-overview'], queryFn: () => api<any>('/admin/launch-overview') });
  return (
    <>
      <PageHeader title="Platform overview" subtitle="Broker firms, records and system attention." />
      {q.error && <ApiErrorState error={q.error} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['firms', 'Active broker firms'],
          ['brokers', 'Broker accounts'],
          ['inventory', 'Inventory records'],
          ['requirements', 'Open requirements'],
          ['pendingImports', 'Entries needing review'],
          ['failedJobs', 'Failed jobs'],
        ].map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-3 text-3xl font-bold">{q.data?.[key] ?? '—'}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Launch integrations</h2>
        {q.data?.integrations.map((i: any) => (
          <div key={i.key} className="mt-3 flex justify-between gap-4 text-sm">
            <span>{i.key}</span>
            <span>{i.configured ? (i.lastTestOk === true ? 'Credentials tested' : 'Credentials set; test required') : 'Not configured'}</span>
          </div>
        ))}
        <Link href="/admin/settings/integrations" className="mt-5 inline-block text-sm font-semibold text-brand-600">
          Configure integrations →
        </Link>
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-brand-600">
        <Link href="/admin/brokers">Broker Firms →</Link>
        <Link href="/admin/modules">Modules & Permissions →</Link>
        <Link href="/admin/system">System →</Link>
      </div>
    </>
  );
}
