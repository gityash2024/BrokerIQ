'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ClipboardCheck, IndianRupee, KeyRound, MessageCircle, Phone, Plus, RefreshCw, Search, UserRound } from 'lucide-react';
import { formatINR, whatsappLink } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, post, useApiMutation } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { OwnerReportCard } from '@/components/broker/growth-tools';
import { InspectionDialog, OwnerPaymentCard, RentDialog } from '@/components/broker/lease-tools';
import { useFlag } from '@/lib/config';

const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400_000);

function OwnersInner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<'owners' | 'leases'>(sp.get('tab') === 'leases' ? 'leases' : 'owners');
  return (
    <>
      <PageHeader
        title="Owners & leases"
        subtitle="आपके landlords, उनकी properties और चल रहे leases — lease ख़त्म होने से पहले renewal / re-rent reminder मिलता है"
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'owners', label: 'Owners' },
          { value: 'leases', label: 'Leases' },
        ]}
      />
      <div className="mt-5">{tab === 'owners' ? <Owners /> : <Leases />}</div>
    </>
  );
}

function Owners() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<any>(null);
  const [add, setAdd] = useState(false);
  const list = useQuery({ queryKey: ['owners', q], queryFn: () => api<any[]>(`/broker/owners${q ? `?q=${encodeURIComponent(q)}` : ''}`) });
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input className="pl-9" placeholder="नाम या number…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => setAdd(true)}>
          <Plus className="size-4" /> Owner जोड़ें
        </Button>
      </div>
      {list.isLoading ? (
        <Skeleton className="h-48" />
      ) : !list.data?.length ? (
        <Empty icon={<UserRound className="size-6" />} title="अभी कोई owner नहीं" text="Listings में owner का नाम और number भरें — वो यहाँ अपने-आप आ जाएँगे।" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.map((o) => (
            <button key={o.id} onClick={() => setOpen(o.id)} className="card p-4 text-left transition hover:border-brand-300">
              <p className="font-semibold" data-no-i18n>
                {o.name}
              </p>
              <p className="text-sm text-muted">{o.phone}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{o._count.listings} listings</Badge>
                {o.tenancies[0] && (
                  <Badge tone={daysLeft(o.tenancies[0].endDate) <= 30 ? 'warning' : 'success'}>Lease {daysLeft(o.tenancies[0].endDate)} दिन</Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      <OwnerDialog id={open} onClose={() => setOpen(null)} />
      <AddOwner open={add} onClose={() => setAdd(false)} />
    </>
  );
}

function OwnerDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['owner', id], queryFn: () => api<any>(`/broker/owners/${id}`), enabled: !!id });
  const o = q.data;
  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()} size="lg" title={o?.name ?? 'Owner'} description={o?.phone}>
      {!o ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" href={`tel:${o.phone}`}>
              <Phone className="size-4" /> Call
            </Button>
            <Button size="sm" variant="whatsapp" href={whatsappLink(o.phone, `नमस्ते ${o.name} जी,`)} external>
              <MessageCircle className="size-4" /> WhatsApp
            </Button>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Properties</p>
            {o.listings.length ? (
              o.listings.map((l: any) => (
                <Link
                  key={l.id}
                  href={`/property/${l.slug}`}
                  target="_blank"
                  className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0"
                >
                  <span className="truncate" data-no-i18n>
                    {l.title}
                  </span>
                  <span className="shrink-0 text-muted">
                    {formatINR(l.price)} · {l.status}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted">कोई listing नहीं</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Leases</p>
            {o.tenancies.length ? (
              o.tenancies.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
                  <span data-no-i18n>{t.tenantName}</span>
                  <span className="text-muted">
                    {formatDate(t.startDate)} → {formatDate(t.endDate)} · {t.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">कोई lease नहीं</p>
            )}
          </div>
          {o.notes && (
            <p className="rounded-xl bg-surface-2 p-3 text-sm" data-no-i18n>
              {o.notes}
            </p>
          )}
          <OwnerPaymentCard key={`pay-${o.id}`} owner={o} />
          <OwnerReportCard key={o.id} owner={o} />
        </div>
      )}
    </Dialog>
  );
}

function AddOwner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', notes: '' });
  const save = useApiMutation(() => post('/broker/owners', { ...f, email: f.email || undefined }), {
    success: 'Owner जोड़ा गया',
    invalidate: [['owners']],
    onSuccess: () => (onClose(), setF({ name: '', phone: '', email: '', notes: '' })),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Owner जोड़ें"
      footer={
        <Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!f.name || !f.phone}>
          Save
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="नाम" required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Mobile" required>
          <Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}

function Leases() {
  const list = useQuery({ queryKey: ['tenancies'], queryFn: () => api<any[]>('/broker/tenancies') });
  const [add, setAdd] = useState(false);
  const renew = useApiMutation((id: string) => patch(`/broker/tenancies/${id}`, { renewMonths: 11 }), {
    success: 'Lease 11 महीने के लिए renew',
    invalidate: [['tenancies']],
  });
  const end = useApiMutation((id: string) => patch(`/broker/tenancies/${id}`, { status: 'ENDED' }), { success: 'Lease बंद', invalidate: [['tenancies']] });
  const rentOn = useFlag('rent_tracker');
  const inspectOn = useFlag('inspections');
  const [rentFor, setRentFor] = useState<string | null>(null);
  const [checkFor, setCheckFor] = useState<any>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAdd(true)}>
          <Plus className="size-4" /> Lease जोड़ें
        </Button>
      </div>
      {list.isLoading ? (
        <Skeleton className="h-48" />
      ) : !list.data?.length ? (
        <Empty
          icon={<KeyRound className="size-6" />}
          title="अभी कोई lease नहीं"
          text="Rent deal close करने पर lease अपने-आप बनता है (11 महीने)। पुराने leases यहाँ जोड़ें।"
        />
      ) : (
        <div className="space-y-3">
          {list.data.map((t) => {
            const left = daysLeft(t.endDate);
            return (
              <div key={t.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={t.status !== 'ACTIVE' ? 'neutral' : left <= 30 ? 'warning' : 'success'}>
                      {t.status === 'ACTIVE' ? (left >= 0 ? `${left} दिन बाकी` : 'ख़त्म') : t.status}
                    </Badge>
                    <span className="font-semibold" data-no-i18n>
                      {t.tenantName}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    <span data-no-i18n>{t.listing?.title ?? 'Property'}</span> · {formatINR(t.rent)}/month · {formatDate(t.startDate)} → {formatDate(t.endDate)}
                  </p>
                  {t.owner && (
                    <p className="text-xs text-muted">
                      Owner: <span data-no-i18n>{t.owner.name}</span> · {t.owner.phone}
                    </p>
                  )}
                </div>
                {t.status === 'ACTIVE' && (
                  <div className="flex flex-wrap gap-2">
                    {rentOn && (
                      <Button size="sm" variant="secondary" onClick={() => setRentFor(t.id)}>
                        <IndianRupee className="size-4" /> किराया
                      </Button>
                    )}
                    {inspectOn && (
                      <Button size="sm" variant="secondary" onClick={() => setCheckFor(t)}>
                        <ClipboardCheck className="size-4" /> Checklist
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => renew.mutate(t.id)}>
                      <RefreshCw className="size-4" /> Renew
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => end.mutate(t.id)}>
                      बंद करें
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <AddLease open={add} onClose={() => setAdd(false)} />
      <RentDialog tenancyId={rentFor} onClose={() => setRentFor(null)} />
      <InspectionDialog tenancy={checkFor} onClose={() => setCheckFor(null)} />
    </>
  );
}

function AddLease({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ tenantName: '', tenantPhone: '', rent: '', startDate: '', endDate: '' });
  const save = useApiMutation(
    () =>
      post('/broker/tenancies', {
        tenantName: f.tenantName,
        tenantPhone: f.tenantPhone || undefined,
        rent: Number(f.rent),
        startDate: f.startDate,
        endDate: f.endDate || undefined,
      }),
    { success: 'Lease जोड़ा गया', invalidate: [['tenancies']], onSuccess: () => onClose() },
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Lease जोड़ें"
      description="End date खाली छोड़ें तो 11 महीने माना जाएगा"
      footer={
        <Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!f.tenantName || !f.rent || !f.startDate}>
          Save
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tenant का नाम" required>
          <Input value={f.tenantName} onChange={(e) => setF({ ...f, tenantName: e.target.value })} />
        </Field>
        <Field label="Tenant mobile">
          <Input inputMode="tel" value={f.tenantPhone} onChange={(e) => setF({ ...f, tenantPhone: e.target.value })} />
        </Field>
        <Field label="Rent (₹/month)" required>
          <Input inputMode="numeric" value={f.rent} onChange={(e) => setF({ ...f, rent: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <div />
        <Field label="Start date" required>
          <Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
        </Field>
        <Field label="End date">
          <Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
        </Field>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <CalendarClock className="size-3.5" /> Lease ख़त्म होने से 60, 30 और 7 दिन पहले reminder मिलेगा।
      </p>
    </Dialog>
  );
}

export default function OwnersPage() {
  return (
    <Suspense>
      <OwnersInner />
    </Suspense>
  );
}
