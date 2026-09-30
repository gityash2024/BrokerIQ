'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';

const TONE: Record<string, any> = { CLAIMED: 'warning', RECEIVED: 'success', REFUNDED: 'info', CANCELLED: 'neutral' };

/** Tokens tenants say they paid — confirm what you actually received (money never passes through BrokerIQ). */
export default function BrokerTokensPage() {
  const q = useQuery({ queryKey: ['broker-tokens'], queryFn: () => api<any[]>('/broker/tokens') });
  const mark = useApiMutation((b: { id: string; status: string }) => patch(`/broker/tokens/${b.id}`, { status: b.status }), {
    success: 'Updated',
    invalidate: [['broker-tokens']],
  });
  return (
    <>
      <PageHeader
        title="Token records"
        subtitle="Tenant ने token/advance देने की जानकारी दी — मिला हो तो 'Received' करें, property पर 'Token मिल चुका' दिखेगा और lead negotiation में जाएगी"
      />
      {q.isLoading ? (
        <Skeleton className="h-40" />
      ) : !q.data?.length ? (
        <Empty icon={<Wallet className="size-6" />} title="अभी कोई token record नहीं" />
      ) : (
        <div className="space-y-3">
          {q.data.map((t) => (
            <div key={t.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONE[t.status]}>{t.status}</Badge>
                  <span className="font-semibold">{formatINR(t.amount)}</span>
                  <span className="text-sm text-muted">
                    {t.mode}
                    {t.ref ? ` · ${t.ref}` : ''}
                  </span>
                </div>
                <Link href={`/property/${t.listing.slug}`} target="_blank" className="mt-1 block truncate text-sm text-brand-600" data-no-i18n>
                  {t.listing.title}
                </Link>
                <p className="text-xs text-muted">
                  {formatDateTime(t.createdAt)}
                  {t.leadId ? (
                    <>
                      {' '}
                      ·{' '}
                      <Link className="text-brand-600" href={`/broker/leads/${t.leadId}`}>
                        Lead देखें
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.status === 'CLAIMED' && (
                  <Button size="sm" onClick={() => mark.mutate({ id: t.id, status: 'RECEIVED' })}>
                    Received
                  </Button>
                )}
                {t.status === 'RECEIVED' && (
                  <Button size="sm" variant="secondary" onClick={() => mark.mutate({ id: t.id, status: 'REFUNDED' })}>
                    Refunded
                  </Button>
                )}
                {['CLAIMED', 'RECEIVED'].includes(t.status) && (
                  <Button size="sm" variant="ghost" onClick={() => mark.mutate({ id: t.id, status: 'CANCELLED' })}>
                    Cancel
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
