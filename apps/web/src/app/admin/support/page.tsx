'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LifeBuoy, Mail, MessageCircle, Phone, RotateCcw } from 'lucide-react';
import { whatsappLink } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

export default function SupportPage() {
  const [status, setStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const q = useQuery({ queryKey: ['admin-support', status], queryFn: () => api<any[]>(`/admin/support?status=${status}`) });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const upd = useApiMutation((b: any) => patch(`/admin/support/${b.id}`, b), { success: 'Updated', invalidate: [['admin-support'], ['admin-dashboard']] });
  return (
    <>
      <PageHeader title="Support inbox" subtitle="Contact page से आए messages" />
      <Segmented
        className="mb-5"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'OPEN', label: 'Open' },
          { value: 'CLOSED', label: 'Closed' },
        ]}
      />
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : !q.data.length ? (
        <Empty icon={<LifeBuoy className="size-7" />} title="Inbox खाली है" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{t.subject || 'General enquiry'}</p>
                  <p className="text-xs text-muted">
                    {t.name} · {formatDateTime(t.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  {t.email && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      href={`mailto:${t.email}?subject=Re: ${encodeURIComponent(t.subject ?? '')}`}
                      external
                      aria-label="Email"
                    >
                      <Mail className="size-4" />
                    </Button>
                  )}
                  {t.phone && (
                    <Button size="icon-sm" variant="ghost" href={`tel:${t.phone}`} aria-label="Call">
                      <Phone className="size-4" />
                    </Button>
                  )}
                  {t.phone && (
                    <Button size="icon-sm" variant="ghost" href={whatsappLink(t.phone, `Hi ${t.name}`)} external aria-label="WhatsApp">
                      <MessageCircle className="size-4 text-emerald-600" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 whitespace-pre-line">{t.message}</p>
              <Textarea
                className="mt-3 min-h-16"
                placeholder="Internal note…"
                value={notes[t.id] ?? t.note ?? ''}
                onChange={(e) => setNotes({ ...notes, [t.id]: e.target.value })}
              />
              <div className="mt-3 flex justify-end">
                {status === 'OPEN' ? (
                  <Button size="sm" variant="success" onClick={() => upd.mutate({ id: t.id, status: 'CLOSED', note: notes[t.id] ?? t.note ?? undefined })}>
                    <CheckCircle2 className="size-4" /> Close
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => upd.mutate({ id: t.id, status: 'OPEN' })}>
                    <RotateCcw className="size-4" /> Reopen
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
