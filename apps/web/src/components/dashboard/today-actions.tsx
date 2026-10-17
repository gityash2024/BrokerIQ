'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ApiErrorState } from '@/components/ui/api-error';
export function TodayActions() {
  const q = useQuery({ queryKey: ['broker-today'], queryFn: () => api<any>('/broker/today'), refetchInterval: 60000 });
  return (
    <>
      <h2 className="font-display text-lg font-bold">Today’s next actions</h2>
      {q.error && <ApiErrorState error={q.error} onRetry={() => q.refetch()} />}
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          ['Follow-ups', q.data?.followUps, '/broker/follow-ups'],
          ['Site visits', q.data?.visits, '/broker/visits'],
        ].map(([label, items, href]) => (
          <section key={String(label)} className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">{String(label)}</h3>
              <Link className="text-xs font-semibold text-brand-600" href={String(href)}>
                View all ↗
              </Link>
            </div>
            {items === undefined ? (
              <p className="text-xs text-muted">Loading…</p>
            ) : (items as any[]).length ? (
              (items as any[]).map((item) => (
                <Link key={item.id} href={`/broker/leads/${item.lead.id}`} className="mb-2 flex justify-between gap-3 rounded-xl bg-surface-2 p-3">
                  <div>
                    <p className="text-sm font-semibold">{item.lead.name}</p>
                    <p className="mt-1 text-xs text-muted">{item.note || item.status.replace(/_/g, ' ')}</p>
                  </div>
                  <time className="text-xs text-muted">
                    {new Date(item.dueAt || item.scheduledAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-surface-2 p-5 text-sm text-muted">Nothing scheduled. Add the next action from a lead.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
