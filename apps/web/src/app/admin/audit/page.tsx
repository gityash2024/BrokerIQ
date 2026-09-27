'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ScrollText, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { formatDateTime, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const da = useDebounced(action);
  const q = useQuery({ queryKey: ['admin-audit', da, page], queryFn: () => api<any>(`/admin/audit${qs({ action: da, page })}`), placeholderData: (p) => p });
  return (
    <>
      <PageHeader title="Audit log" subtitle="हर admin/broker action का record — credentials, moderation, plans, team changes" />
      <div className="mb-4 max-w-sm"><Input icon={<Search className="size-4" />} className="h-10" placeholder="Action (जैसे credentials, listing.approve)" value={action} onChange={(e) => (setAction(e.target.value), setPage(1))} /></div>
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !q.data.items.length ? (
        <Empty icon={<ScrollText className="size-7" />} title="कोई entry नहीं" />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold text-subtle uppercase">
                <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Details</th></tr>
              </thead>
              <tbody>
                {q.data.items.map((a: any) => (
                  <tr key={a.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted">{formatDateTime(a.createdAt)}</td>
                    <td className="px-4 py-2.5"><p className="font-medium">{a.actor?.name ?? 'System'}</p><p className="text-xs text-muted">{a.actorRole}</p></td>
                    <td className="px-4 py-2.5"><Badge tone={a.action.includes('delete') || a.action.includes('reject') ? 'danger' : a.action.includes('credentials') ? 'warning' : 'brand'}>{a.action}</Badge></td>
                    <td className="px-4 py-2.5 text-xs">{a.entity}<br /><span className="font-mono text-subtle">{a.entityId}</span></td>
                    <td className="max-w-md px-4 py-2.5"><code className="line-clamp-3 font-mono text-[11px] break-all text-muted">{a.meta ? JSON.stringify(a.meta) : ''}</code>{a.ip && <p className="text-[11px] text-subtle">IP {a.ip}</p>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 text-sm">
            <span className="text-muted">Page {q.data.page} / {q.data.totalPages}</span>
            <Button size="icon-sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous"><ChevronLeft className="size-4" /></Button>
            <Button size="icon-sm" variant="secondary" disabled={page >= q.data.totalPages} onClick={() => setPage(page + 1)} aria-label="Next"><ChevronRight className="size-4" /></Button>
          </div>
        </>
      )}
    </>
  );
}
