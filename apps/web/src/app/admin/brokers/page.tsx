'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Ban, CheckCircle2, ExternalLink, Search } from 'lucide-react';
import { timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, useApiMutation, useDebounced } from '@/lib/hooks';
import { cn, formatDate, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Pager } from '@/components/admin/crud';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

const VTONE: Record<string, any> = { VERIFIED: 'success', PENDING: 'warning', REJECTED: 'danger', UNVERIFIED: 'neutral' };

export default function BrokersPage() {
  const [f, setF] = useState({ q: '', status: '', verification: '', page: 1 });
  const dq = useDebounced(f.q);
  const q = useQuery({ queryKey: ['admin-orgs', { ...f, q: dq }], queryFn: () => api<any>(`/admin/organizations${qs({ ...f, q: dq })}`), placeholderData: (p) => p });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Broker firms" subtitle={q.data ? `${q.data.total} firms` : ' '} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-full sm:w-72"><Input icon={<Search className="size-4" />} className="h-10" placeholder="Firm, slug, phone" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })} /></div>
        <Select className="h-10 w-44" value={f.verification} onChange={(e) => setF({ ...f, verification: e.target.value, page: 1 })}>
          <option value="">All verification</option>
          {['VERIFIED', 'PENDING', 'UNVERIFIED', 'REJECTED'].map((v) => <option key={v} value={v}>{v}</option>)}
        </Select>
        <Select className="h-10 w-36" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })}>
          <option value="">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !q.data.items.length ? (
        <Empty title="कोई firm नहीं" />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold text-subtle uppercase">
                <tr><th className="px-4 py-3">Firm</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3 text-center">Team</th><th className="px-4 py-3 text-center">Listings</th><th className="px-4 py-3 text-center">Leads</th><th className="px-4 py-3">Joined</th></tr>
              </thead>
              <tbody>
                {q.data.items.map((o: any) => (
                  <tr key={o.id} onClick={() => setOpen(o.id)} className={cn('cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/50', o.status === 'SUSPENDED' && 'opacity-60')}>
                    <td className="px-4 py-2.5"><div className="flex items-center gap-3"><Avatar name={o.name} src={o.logoUrl} size={34} /><div><p className="font-semibold">{o.name}</p><p className="text-xs text-muted">{o.phone ?? '—'} · /{o.slug}</p></div></div></td>
                    <td className="px-4 py-2.5"><Badge tone="brand">{o.subscription?.plan?.name ?? 'Free'}</Badge></td>
                    <td className="px-4 py-2.5"><Badge tone={VTONE[o.verification]}>{o.verification}</Badge>{o.status === 'SUSPENDED' && <Badge tone="danger" className="ml-1">Suspended</Badge>}</td>
                    <td className="px-4 py-2.5 text-center">{o._count.members}</td>
                    <td className="px-4 py-2.5 text-center">{o._count.listings}</td>
                    <td className="px-4 py-2.5 text-center">{o._count.leads}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onPage={(p) => setF({ ...f, page: p })} />
        </>
      )}
      <OrgSheet id={open} onClose={() => setOpen(null)} />
    </>
  );
}

function OrgSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin-org', id], queryFn: () => api<any>(`/admin/organizations/${id}`), enabled: !!id });
  const plans = useQuery({ queryKey: ['admin-plans'], queryFn: () => api<any[]>('/admin/plans'), enabled: !!id });
  const [plan, setPlan] = useState('');
  const [days, setDays] = useState(30);
  const upd = useApiMutation((b: any) => patch(`/admin/organizations/${id}`, b), { success: 'Updated', invalidate: [['admin-org', id], ['admin-orgs']] });
  const o = q.data;
  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && onClose()} className="max-w-xl">
      {!o ? (
        <Skeleton className="m-5 h-96" />
      ) : (
        <div className="h-full overflow-y-auto p-6">
          <div className="flex items-center gap-4">
            <Avatar name={o.name} src={o.logoUrl} size={60} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-bold">{o.name}</p>
              <p className="text-sm text-muted">{o.phone} · RERA {o.reraNumber ?? '—'} · GST {o.gstNumber ?? '—'}</p>
            </div>
            <Button size="icon-sm" variant="ghost" href={`/brokers/${o.slug}`} external aria-label="Microsite"><ExternalLink className="size-4" /></Button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {[['Listings', o._count.listings], ['Leads', o._count.leads], ['Automations', o._count.automations]].map(([l, n]) => (
              <div key={l} className="rounded-xl bg-surface-2 p-3"><p className="font-display text-xl font-extrabold">{n}</p><p className="text-xs text-muted">{l}</p></div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone={VTONE[o.verification]}>{o.verification}</Badge>
            {o.verification !== 'VERIFIED' && <Button size="xs" variant="success" onClick={() => upd.mutate({ verification: 'VERIFIED' })}><BadgeCheck className="size-3.5" /> Verify firm</Button>}
            {o.verification === 'VERIFIED' && <Button size="xs" variant="secondary" onClick={() => upd.mutate({ verification: 'UNVERIFIED' })}>Remove verification</Button>}
            {o.status === 'ACTIVE' ? (
              <Button size="xs" variant="danger" onClick={() => confirm('Firm suspend करें? सभी members logout हो जाएँगे।') && upd.mutate({ status: 'SUSPENDED' })}><Ban className="size-3.5" /> Suspend</Button>
            ) : (
              <Button size="xs" variant="success" onClick={() => upd.mutate({ status: 'ACTIVE' })}><CheckCircle2 className="size-3.5" /> Reactivate</Button>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-line p-4">
            <p className="font-semibold">Subscription</p>
            <p className="text-sm text-muted">{o.subscription ? `${o.subscription.plan.name} · ${o.subscription.status}${o.subscription.currentPeriodEnd ? ` · till ${formatDate(o.subscription.currentPeriodEnd)}` : ''}` : 'Free (no subscription)'}</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Plan manually assign करें" className="flex-1">
                <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
                  <option value="">चुनें</option>
                  {plans.data?.map((p) => <option key={p.id} value={p.code}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Days" className="w-24"><Input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} /></Field>
              <Button disabled={!plan} onClick={() => upd.mutate({ planCode: plan, periodDays: days })}>Assign</Button>
            </div>
            <p className="mt-2 text-[11px] text-subtle">Offline / bank transfer payment या trial देने के लिए।</p>
          </div>

          <p className="mt-6 mb-2 font-semibold">Team ({o.members.length})</p>
          <div className="divide-y divide-line rounded-2xl border border-line">
            {o.members.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Avatar name={m.name} size={28} />
                <div className="min-w-0 flex-1"><p className="font-medium">{m.name}</p><p className="truncate text-xs text-muted">{m.email}</p></div>
                <Badge>{m.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'}</Badge>
                <span className="text-xs text-subtle">{m.lastLoginAt ? timeAgo(m.lastLoginAt) : '—'}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 mb-2 font-semibold">Connectors</p>
          <div className="flex flex-wrap gap-2">
            {o.connectors.length ? o.connectors.map((c: any) => <Badge key={c.id} tone={c.status === 'ACTIVE' ? 'success' : c.status === 'ERROR' ? 'danger' : 'neutral'}>{c.type} · {c.leadsImported} leads</Badge>) : <p className="text-sm text-muted">कोई connector नहीं</p>}
          </div>

          {o.kycDocuments.length > 0 && (
            <>
              <p className="mt-6 mb-2 font-semibold">KYC documents</p>
              <div className="space-y-2">
                {o.kycDocuments.map((d: any) => (
                  <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm hover:bg-surface-2">
                    <span>{d.docType.replace(/_/g, ' ')} {d.docNumber && <span className="font-mono text-xs text-muted">{d.docNumber}</span>}</span>
                    <Badge tone={VTONE[d.status]}>{d.status}</Badge>
                  </a>
                ))}
              </div>
              <Link href="/admin/kyc" className="mt-2 inline-block text-xs font-semibold text-brand-600">KYC queue →</Link>
            </>
          )}

          {o.payments.length > 0 && (
            <>
              <p className="mt-6 mb-2 font-semibold">Payments</p>
              <div className="space-y-1 text-sm">
                {o.payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-surface-2"><span>{formatDate(p.createdAt)} · {p.purpose}</span><span className="font-semibold">₹{(p.amount / 100).toLocaleString('en-IN')} <Badge tone={p.status === 'PAID' ? 'success' : 'neutral'}>{p.status}</Badge></span></div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
