'use client';
import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, Logo, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/tabs';
import { ApiErrorState } from '@/components/ui/api-error';
import { OtpConfirm } from '@/components/site/otp-confirm';

const TONE: Record<string, string> = { GOOD: 'text-emerald-600', OK: 'text-sky-600', DAMAGED: 'text-amber-600', MISSING: 'text-rose-600' };

/** Public move-in / move-out checklist: landlord and tenant review it and confirm with an OTP. */
export default function InspectionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [party, setParty] = useState<'TENANT' | 'LANDLORD'>('TENANT');
  const q = useQuery({ queryKey: ['inspection', token], queryFn: () => api<any>(`/public/inspections/${token}`, { auth: false }) });
  const v = q.data;
  const prev = (room: string, item: string) => v?.moveIn?.rooms?.find((r: any) => r.name === room)?.items.find((x: any) => x.name === item)?.condition;
  return (
    <main className="min-h-screen bg-surface-2 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        {q.isError ? (
          <ApiErrorState error={q.error} />
        ) : !v ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <div className="card p-5">
              <p className="text-xs text-muted">{v.kind === 'MOVE_IN' ? 'Move-in' : 'Move-out'} checklist</p>
              <h1 className="font-display text-xl font-extrabold" data-no-i18n>
                {v.property}
              </h1>
              <p className="text-sm text-muted">
                Landlord: <span data-no-i18n>{v.landlord.name}</span> · Tenant: <span data-no-i18n>{v.tenant.name}</span> · <span data-no-i18n>{v.firm}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={v.landlordConfirmedAt ? 'success' : 'warning'}>Landlord {v.landlordConfirmedAt ? '✓' : 'pending'}</Badge>
                <Badge tone={v.tenantConfirmedAt ? 'success' : 'warning'}>Tenant {v.tenantConfirmedAt ? '✓' : 'pending'}</Badge>
                <Button size="xs" variant="secondary" href={v.pdfUrl} external>
                  <FileDown className="size-3.5" /> PDF
                </Button>
              </div>
            </div>
            {v.rooms.map((r: any) => (
              <div key={r.name} className="card p-4">
                <p className="mb-2 font-semibold" data-no-i18n>
                  {r.name}
                </p>
                <ul className="divide-y divide-line text-sm">
                  {r.items.map((it: any) => (
                    <li key={it.name} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="flex-1" data-no-i18n>
                        {it.name}
                        {it.note && <span className="block text-xs text-muted">{it.note}</span>}
                      </span>
                      {v.moveIn && <span className="text-xs text-muted">पहले: {prev(r.name, it.name) ?? '-'}</span>}
                      <span className={cn('font-semibold', TONE[it.condition])}>{it.condition}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="card space-y-1 p-4 text-sm">
              {Object.entries(v.meters ?? {}).map(([k, val]) => (
                <p key={k}>
                  {k} meter: <b>{String(val)}</b>
                  {v.moveIn?.meters?.[k] ? <span className="text-muted"> (move-in: {v.moveIn.meters[k]})</span> : null}
                </p>
              ))}
              {v.keys != null && (
                <p>
                  चाबियाँ: <b>{v.keys}</b>
                </p>
              )}
              {v.notes && <p data-no-i18n>{v.notes}</p>}
              {v.kind === 'MOVE_OUT' && v.depositAmount != null && (
                <div className="mt-2 rounded-xl bg-surface-2 p-3">
                  <p>Security deposit: {formatINR(v.depositAmount)}</p>
                  {(v.deductions ?? []).map((d: any) => (
                    <p key={d.reason} className="text-rose-600">
                      − <span data-no-i18n>{d.reason}</span>: {formatINR(d.amount)}
                    </p>
                  ))}
                  <p className="font-bold">Refund: {formatINR(v.refundAmount ?? 0)}</p>
                </div>
              )}
              <p className="text-xs text-muted">आख़िरी बदलाव: {formatDate(v.updatedAt)}</p>
            </div>
            <div className="card space-y-3 p-4">
              <Segmented
                value={party}
                onChange={setParty}
                options={[
                  { value: 'TENANT', label: 'मैं tenant हूँ' },
                  { value: 'LANDLORD', label: 'मैं landlord हूँ' },
                ]}
              />
              <OtpConfirm
                key={party}
                label={`${party === 'TENANT' ? v.tenant.name : v.landlord.name} — ऊपर की बातें सही हैं, confirm करें`}
                done={party === 'TENANT' ? !!v.tenantConfirmedAt : !!v.landlordConfirmedAt}
                doneText={`Confirmed — ${formatDate(party === 'TENANT' ? v.tenantConfirmedAt : v.landlordConfirmedAt)}`}
                requestPath={`/public/inspections/${token}/otp`}
                confirmPath={`/public/inspections/${token}/confirm`}
                body={{ party }}
                onDone={() => q.refetch()}
              />
            </div>
            <p className="flex items-center justify-center gap-2 text-xs text-muted">
              Powered by <Logo className="h-4" />
            </p>
          </>
        )}
      </div>
    </main>
  );
}
