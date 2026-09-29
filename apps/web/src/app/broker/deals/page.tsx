'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { BadgeIndianRupee, Handshake, IndianRupee, Pencil, Plus, TrendingUp, Wallet } from 'lucide-react';
import { formatINR, formatPriceShort } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDate, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { LeadPicker, ListingPicker } from '@/components/broker/lead-picker';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton, Stat } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';
import { CountUp } from '@/components/motion/reveal';

const commissionOf = (d: any) => d.commissionAmount ?? (d.commissionPct ? (d.dealValue * d.commissionPct) / 100 : 0);

export default function DealsPage() {
  const { user } = useAuth();
  const admin = user?.role === 'BROKER_ADMIN';
  const [status, setStatus] = useState<'' | 'OPEN' | 'CLOSED' | 'CANCELLED'>('');
  const [edit, setEdit] = useState<any>(null);
  const q = useQuery({ queryKey: ['deals', status], queryFn: () => api<any[]>(`/deals${qs({ status })}`) });
  const all = useQuery({ queryKey: ['deals', 'all'], queryFn: () => api<any[]>('/deals') });
  const d = all.data ?? [];
  const open = d.filter((x) => x.status === 'OPEN');
  const closed = d.filter((x) => x.status === 'CLOSED');
  const earned = closed.reduce((s, x) => s + commissionOf(x), 0);
  const received = closed.reduce((s, x) => s + (x.commissionReceived ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Deals & commission"
        subtitle="हर closed deal, commission और agent share का हिसाब एक जगह"
        actions={<Button size="sm" onClick={() => setEdit({})}><Plus className="size-4" /> Deal जोड़ें</Button>}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open deals" value={<><CountUp to={open.length} /> <span className="text-sm font-semibold text-muted">· {formatPriceShort(open.reduce((s, x) => s + x.dealValue, 0))}</span></>} icon={<Handshake className="size-5" />} />
        <Stat label="Closed value" value={formatPriceShort(closed.reduce((s, x) => s + x.dealValue, 0))} icon={<TrendingUp className="size-5" />} tone="success" hint={`${closed.length} deals`} />
        <Stat label="Commission earned" value={formatINR(earned)} icon={<BadgeIndianRupee className="size-5" />} tone="info" />
        <Stat label="Pending collection" value={formatINR(Math.max(0, earned - received))} icon={<Wallet className="size-5" />} tone={earned - received > 0 ? 'warning' : 'success'} hint={`${formatINR(received)} received`} />
      </div>
      <Segmented value={status} onChange={setStatus} className="mb-4" options={[{ value: '', label: 'All' }, { value: 'OPEN', label: 'Open' }, { value: 'CLOSED', label: 'Closed' }, { value: 'CANCELLED', label: 'Cancelled' }]} />

      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !q.data.length ? (
        <Empty icon={<Handshake className="size-7" />} title="अभी कोई deal नहीं" text="Lead जीतने पर यहाँ deal जोड़ें — commission और agent payout track होगा।" action={<Button onClick={() => setEdit({})}><Plus className="size-4" /> पहली deal जोड़ें</Button>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold tracking-wide text-subtle uppercase">
              <tr>
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Collected</th>
                {admin && <th className="px-4 py-3">Agent</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {q.data.map((x, i) => {
                const c = commissionOf(x);
                const pct = c ? Math.min(100, ((x.commissionReceived ?? 0) / c) * 100) : 0;
                return (
                  <motion.tr key={x.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-line last:border-0 hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{x.title}</p>
                      <p className="text-xs text-muted">
                        <Link href={`/broker/leads/${x.lead.id}`} className="hover:text-brand-600">{x.lead.name || x.lead.phone}</Link>
                        {x.listing && <> · <Link href={`/property/${x.listing.slug}`} target="_blank" className="hover:text-brand-600">{x.listing.title}</Link></>}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatPriceShort(x.dealValue)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c ? formatINR(c) : '—'}</p>
                      {x.commissionPct != null && <p className="text-xs text-muted">{x.commissionPct}%{x.agentSharePct ? ` · agent ${x.agentSharePct}% = ${formatINR((c * x.agentSharePct) / 100)}` : ''}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold">{formatINR(x.commissionReceived ?? 0)}</p>
                      <div className="mt-1 h-1.5 w-24 rounded-full bg-surface-2">
                        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-saffron-500')} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    {admin && <td className="px-4 py-3">{x.agent ? <span className="inline-flex items-center gap-2 whitespace-nowrap"><Avatar name={x.agent.name} size={24} /> {x.agent.name}</span> : '—'}</td>}
                    <td className="px-4 py-3">
                      <Badge tone={x.status === 'CLOSED' ? 'success' : x.status === 'OPEN' ? 'brand' : 'neutral'}>{x.status === 'CLOSED' ? `Closed ${formatDate(x.closedAt, { day: 'numeric', month: 'short' })}` : x.status === 'OPEN' ? 'Open' : 'Cancelled'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {x.status === 'CLOSED' && <Button size="xs" variant="ghost" href={`/broker/invoices?deal=${x.id}`}>Invoice</Button>}
                      <Button size="icon-sm" variant="ghost" onClick={() => setEdit(x)} aria-label="Edit"><Pencil className="size-4" /></Button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <DealDialog deal={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function DealDialog({ deal, onClose }: { deal: any; onClose: () => void }) {
  const isNew = deal && !deal.id;
  const [lead, setLead] = useState<any>(null);
  const [f, setF] = useState<any>({});
  useEffect(() => {
    if (!deal) return;
    setLead(deal.lead ?? null);
    setF({
      title: deal.title ?? '',
      listingId: deal.listingId ?? '',
      dealValue: deal.dealValue ?? '',
      commissionPct: deal.commissionPct ?? '',
      agentSharePct: deal.agentSharePct ?? '',
      commissionReceived: deal.commissionReceived ?? '',
      status: deal.status ?? 'OPEN',
      notes: deal.notes ?? '',
    });
  }, [deal]);
  const set = (k: string) => (e: any) => setF((p: any) => ({ ...p, [k]: e.target.value }));
  const num = (v: any) => (v === '' || v == null ? null : Number(v));
  const body = () => ({
    title: f.title,
    listingId: f.listingId || null,
    dealValue: Number(f.dealValue),
    commissionPct: num(f.commissionPct),
    commissionAmount: f.commissionPct !== '' && f.dealValue ? (Number(f.dealValue) * Number(f.commissionPct)) / 100 : null,
    agentSharePct: num(f.agentSharePct),
    commissionReceived: num(f.commissionReceived) ?? 0,
    notes: f.notes || null,
  });
  const save = useApiMutation(
    () => (isNew ? post('/deals', { ...body(), leadId: lead.id, closedAt: f.status === 'CLOSED' ? new Date().toISOString() : null }) : patch(`/deals/${deal.id}`, { ...body(), status: f.status })),
    { success: isNew ? 'Deal जुड़ गई 🎉' : 'Deal updated', invalidate: [['deals'], ['kanban'], ['leads'], ['broker-dashboard']], onSuccess: onClose },
  );
  const commission = f.dealValue && f.commissionPct ? (Number(f.dealValue) * Number(f.commissionPct)) / 100 : 0;
  return (
    <Dialog
      open={!!deal}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? 'नई deal' : 'Deal edit करें'}
      size="lg"
      footer={<Button loading={save.isPending} disabled={!f.title || !f.dealValue || (isNew && !lead)} onClick={() => save.mutate(undefined)}>Save deal</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {isNew && <Field label="Lead" required className="sm:col-span-2"><LeadPicker value={lead} onChange={setLead} /></Field>}
        <Field label="Title" required className="sm:col-span-2"><Input value={f.title ?? ''} onChange={set('title')} placeholder="जैसे: 3 BHK, DLF Park Place — resale" /></Field>
        <Field label="Property" className="sm:col-span-2"><ListingPicker value={f.listingId ?? ''} onChange={(id) => setF((p: any) => ({ ...p, listingId: id }))} /></Field>
        <Field label="Deal value (₹)" required><Input type="number" inputMode="numeric" value={f.dealValue ?? ''} onChange={set('dealValue')} /></Field>
        <Field label="Commission %" hint={commission ? `= ${formatINR(commission)}` : undefined}><Input type="number" step="0.1" value={f.commissionPct ?? ''} onChange={set('commissionPct')} placeholder="जैसे 1 या 2" /></Field>
        <Field label="Agent share %" hint={commission && f.agentSharePct ? `Agent को ${formatINR((commission * Number(f.agentSharePct)) / 100)}` : undefined}><Input type="number" value={f.agentSharePct ?? ''} onChange={set('agentSharePct')} /></Field>
        <Field label="Commission received (₹)"><Input type="number" value={f.commissionReceived ?? ''} onChange={set('commissionReceived')} icon={<IndianRupee className="size-4" />} /></Field>
        <Field label="Status">
          <Select value={f.status ?? 'OPEN'} onChange={set('status')}>
            <option value="OPEN">Open (negotiation / token)</option>
            <option value="CLOSED">Closed — lead WON</option>
            {!isNew && <option value="CANCELLED">Cancelled</option>}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes ?? ''} onChange={set('notes')} /></Field>
      </div>
    </Dialog>
  );
}
