'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ClipboardCheck, ExternalLink, IndianRupee, MessageCircle, Plus, Receipt, Trash2, X } from 'lucide-react';
import { INSPECTION_CONDITIONS, INSPECTION_TEMPLATE, formatINR, whatsappLink, type InspectionItem, type InspectionRoom } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useFlag } from '@/lib/config';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field, Input, Select, Textarea } from '../ui/field';
import { Badge, Skeleton } from '../ui/misc';
import { Segmented } from '../ui/tabs';
import { CopyField } from '../panel/integration-card';
import { PhotoUploader } from '../site/photo-uploader';

const put = <T = any,>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
const istMonth = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// ------------------------------------------------------------------ rent
/** Rent due day + tenant contact (for reminders), month-wise "paid" records and receipts. */
export function RentDialog({ tenancyId, onClose }: { tenancyId: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['tenancy-rent', tenancyId], queryFn: () => api<any>(`/broker/tenancies/${tenancyId}/rent`), enabled: !!tenancyId });
  const t = q.data;
  const [s, setS] = useState({ rentDueDay: '', tenantEmail: '', tenantPhone: '' });
  const [pay, setPay] = useState({ month: istMonth(), amount: '', mode: 'UPI', reference: '' });
  useEffect(() => {
    if (t) {
      setS({ rentDueDay: t.rentDueDay ? String(t.rentDueDay) : '', tenantEmail: t.tenantEmail ?? '', tenantPhone: t.tenantPhone ?? '' });
      setPay((p) => ({ ...p, amount: String(t.rent) }));
    }
  }, [t]);
  const save = useApiMutation(
    () =>
      patch(`/broker/tenancies/${tenancyId}/rent`, {
        rentDueDay: s.rentDueDay ? Number(s.rentDueDay) : null,
        tenantEmail: s.tenantEmail || null,
        tenantPhone: s.tenantPhone || null,
      }),
    { success: 'Rent reminder settings save', invalidate: [['tenancy-rent', tenancyId], ['tenancies']] },
  );
  const mark = useApiMutation(
    () =>
      post(`/broker/tenancies/${tenancyId}/rent-payments`, { month: pay.month, amount: Number(pay.amount), mode: pay.mode, reference: pay.reference || null }),
    { success: 'Paid mark हुआ — tenant को receipt भेज दी', invalidate: [['tenancy-rent', tenancyId]] },
  );
  const remove = useApiMutation((id: string) => del(`/broker/rent-payments/${id}`), { success: 'Entry हटाई', invalidate: [['tenancy-rent', tenancyId]] });
  return (
    <Dialog
      open={!!tenancyId}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="किराया"
      description={t ? `${t.tenantName} · ${formatINR(t.rent)}/month` : undefined}
    >
      {!t ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-line p-4">
            <p className="font-semibold">Monthly reminder</p>
            <p className="mb-3 text-xs text-muted">
              Due date से 3 दिन पहले और उसी दिन tenant को reminder (app notification + email{t.owner?.upiId ? ', owner के UPI link के साथ' : ''})। Paid mark
              होते ही बंद।
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="हर महीने की तारीख">
                <Select value={s.rentDueDay} onChange={(e) => setS({ ...s, rentDueDay: e.target.value })}>
                  <option value="">Reminder बंद</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tenant email">
                <Input type="email" value={s.tenantEmail} onChange={(e) => setS({ ...s, tenantEmail: e.target.value })} data-no-i18n />
              </Field>
              <Field label="Tenant mobile">
                <Input inputMode="tel" value={s.tenantPhone} onChange={(e) => setS({ ...s, tenantPhone: e.target.value })} />
              </Field>
            </div>
            {!t.owner?.upiId && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Owner का UPI ID जोड़ें (Owners → owner खोलें) ताकि tenant सीधे pay कर सके।</p>
            )}
            <Button size="sm" className="mt-3" loading={save.isPending} onClick={() => save.mutate(undefined)}>
              Save
            </Button>
          </div>

          <div className="rounded-2xl border border-line p-4">
            <p className="mb-3 font-semibold">किराया मिला — paid mark करें</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="महीना">
                <Input type="month" value={pay.month} onChange={(e) => setPay({ ...pay, month: e.target.value })} />
              </Field>
              <Field label="Amount (₹)">
                <Input inputMode="numeric" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Mode">
                <Select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>
                  {['UPI', 'BANK', 'CASH', 'CHEQUE'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Ref / UTR">
                <Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
              </Field>
            </div>
            <Button size="sm" className="mt-3" loading={mark.isPending} disabled={!pay.amount || !pay.month} onClick={() => mark.mutate(undefined)}>
              <IndianRupee className="size-4" /> Paid mark करें + receipt
            </Button>
          </div>

          <div>
            <p className="mb-2 font-semibold">History</p>
            {!t.rentPayments.length ? (
              <p className="text-sm text-muted">अभी कोई entry नहीं।</p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
                {t.rentPayments.map((p: any) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="font-semibold">{monthLabel(p.month)}</span>
                    <span>{formatINR(p.amount)}</span>
                    <span className="text-xs text-muted">
                      {p.mode} · {formatDate(p.paidOn)}
                    </span>
                    <span className="ml-auto flex gap-1">
                      <Button size="xs" variant="secondary" href={p.receiptUrl} external>
                        <Receipt className="size-3.5" /> Receipt
                      </Button>
                      <Button size="xs" variant="ghost" aria-label="Delete" onClick={() => confirm('यह entry हटाएँ?') && remove.mutate(p.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ------------------------------------------------------------------ move-in / move-out checklist
type Item = InspectionItem;
type Room = InspectionRoom;
const TEMPLATE = INSPECTION_TEMPLATE;
const COND_TONE: Record<string, string> = {
  GOOD: 'bg-emerald-600 text-white',
  OK: 'bg-sky-600 text-white',
  DAMAGED: 'bg-amber-500 text-white',
  MISSING: 'bg-rose-600 text-white',
};

export function InspectionDialog({ tenancy, onClose }: { tenancy: any | null; onClose: () => void }) {
  const [kind, setKind] = useState<'MOVE_IN' | 'MOVE_OUT'>('MOVE_IN');
  const q = useQuery({ queryKey: ['inspections', tenancy?.id], queryFn: () => api<any[]>(`/broker/tenancies/${tenancy.id}/inspections`), enabled: !!tenancy });
  const current = q.data?.find((i) => i.kind === kind);
  const moveIn = q.data?.find((i) => i.kind === 'MOVE_IN');
  const [rooms, setRooms] = useState<Room[]>(TEMPLATE);
  const [f, setF] = useState({ electricity: '', water: '', gas: '', keys: '', notes: '', deposit: '' });
  const [deductions, setDeductions] = useState<{ reason: string; amount: string }[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  useEffect(() => {
    const src = current ?? (kind === 'MOVE_OUT' ? moveIn : null);
    setRooms((src?.rooms as Room[]) ?? TEMPLATE);
    const m = (src?.meters ?? {}) as Record<string, string>;
    setF({
      electricity: current ? (m.electricity ?? '') : '',
      water: current ? (m.water ?? '') : '',
      gas: current ? (m.gas ?? '') : '',
      keys: src?.keys != null ? String(src.keys) : '',
      notes: current?.notes ?? '',
      deposit: current?.depositAmount != null ? String(current.depositAmount) : '',
    });
    setDeductions(((current?.deductions as any[]) ?? []).map((d) => ({ reason: d.reason, amount: String(d.amount) })));
    setPhotos(current?.photos ?? []);
  }, [current, moveIn, kind]);
  const save = useApiMutation(
    () =>
      put(`/broker/tenancies/${tenancy.id}/inspections`, {
        kind,
        rooms: rooms.map((r) => ({ ...r, items: r.items.filter((i) => i.name.trim()) })).filter((r) => r.name.trim()),
        meters: { ...(f.electricity && { electricity: f.electricity }), ...(f.water && { water: f.water }), ...(f.gas && { gas: f.gas }) },
        keys: f.keys ? Number(f.keys) : null,
        photos,
        notes: f.notes || null,
        depositAmount: kind === 'MOVE_OUT' && f.deposit ? Number(f.deposit) : null,
        deductions: kind === 'MOVE_OUT' ? deductions.filter((d) => d.reason && d.amount).map((d) => ({ reason: d.reason, amount: Number(d.amount) })) : null,
      }),
    { success: 'Checklist save — अब दोनों से confirm करवाएँ', invalidate: [['inspections', tenancy?.id]] },
  );
  const setItem = (ri: number, ii: number, patchItem: Partial<Item>) =>
    setRooms(rooms.map((r, i) => (i !== ri ? r : { ...r, items: r.items.map((it, j) => (j === ii ? { ...it, ...patchItem } : it)) })));
  const refund = Number(f.deposit || 0) - deductions.reduce((s, d) => s + Number(d.amount || 0), 0);
  return (
    <Dialog
      open={!!tenancy}
      onOpenChange={(v) => !v && onClose()}
      size="xl"
      title="Move-in / move-out checklist"
      description="Room-wise हालत, meter readings, चाबियाँ — landlord और tenant दोनों OTP से confirm करते हैं। Deposit के झगड़े ख़त्म।"
      footer={
        <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'MOVE_IN', label: 'Move-in' },
            { value: 'MOVE_OUT', label: 'Move-out' },
          ]}
        />
        {current && (
          <div className="space-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone={current.landlordConfirmedAt ? 'success' : 'warning'}>Landlord {current.landlordConfirmedAt ? '✓ confirmed' : 'pending'}</Badge>
              <Badge tone={current.tenantConfirmedAt ? 'success' : 'warning'}>Tenant {current.tenantConfirmedAt ? '✓ confirmed' : 'pending'}</Badge>
            </div>
            <CopyField label="दोनों को यह link भेजें (OTP से confirm)" value={current.url} />
            <div className="flex flex-wrap gap-2">
              {tenancy.tenantPhone && (
                <Button size="sm" variant="whatsapp" external href={whatsappLink(tenancy.tenantPhone, `Checklist देखें और confirm करें: ${current.url}`)}>
                  <MessageCircle className="size-4" /> Tenant को
                </Button>
              )}
              {tenancy.owner?.phone && (
                <Button size="sm" variant="whatsapp" external href={whatsappLink(tenancy.owner.phone, `Checklist देखें और confirm करें: ${current.url}`)}>
                  <MessageCircle className="size-4" /> Owner को
                </Button>
              )}
              <Button size="sm" variant="secondary" href={current.pdfUrl} external>
                <ExternalLink className="size-4" /> PDF
              </Button>
            </div>
          </div>
        )}
        {rooms.map((r, ri) => (
          <div key={ri} className="rounded-2xl border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <Input
                className="h-9 font-semibold"
                value={r.name}
                onChange={(e) => setRooms(rooms.map((x, i) => (i === ri ? { ...x, name: e.target.value } : x)))}
              />
              <Button size="icon-sm" variant="ghost" aria-label="Room हटाएँ" onClick={() => setRooms(rooms.filter((_, i) => i !== ri))}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {r.items.map((it, ii) => (
                <div key={ii} className="flex flex-wrap items-center gap-2">
                  <Input className="h-9 min-w-36 flex-1" value={it.name} onChange={(e) => setItem(ri, ii, { name: e.target.value })} />
                  <div className="flex gap-1">
                    {INSPECTION_CONDITIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setItem(ri, ii, { condition: c })}
                        className={cn('rounded-lg px-2 py-1 text-xs font-semibold', it.condition === c ? COND_TONE[c] : 'bg-surface-2 text-muted')}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <Input className="h-9 min-w-32 flex-1" placeholder="Note" value={it.note ?? ''} onChange={(e) => setItem(ri, ii, { note: e.target.value })} />
                </div>
              ))}
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setRooms(rooms.map((x, i) => (i === ri ? { ...x, items: [...x.items, { name: '', condition: 'GOOD' }] } : x)))}
              >
                <Plus className="size-3.5" /> Item
              </Button>
            </div>
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setRooms([...rooms, { name: `Room ${rooms.length + 1}`, items: [{ name: '', condition: 'GOOD' }] }])}
        >
          <Plus className="size-4" /> Room जोड़ें
        </Button>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Electricity meter">
            <Input value={f.electricity} onChange={(e) => setF({ ...f, electricity: e.target.value })} />
          </Field>
          <Field label="Water meter">
            <Input value={f.water} onChange={(e) => setF({ ...f, water: e.target.value })} />
          </Field>
          <Field label="Gas meter">
            <Input value={f.gas} onChange={(e) => setF({ ...f, gas: e.target.value })} />
          </Field>
          <Field label="चाबियाँ (गिनती)">
            <Input inputMode="numeric" value={f.keys} onChange={(e) => setF({ ...f, keys: e.target.value.replace(/\D/g, '') })} />
          </Field>
        </div>
        <Field label="Photos" hint="दीवारें, फ़र्श, fittings, meter — deposit के झगड़े में यही सबूत हैं। PDF में भी छपती हैं।">
          <PhotoUploader plain kind="inspection" max={40} value={photos.map((url) => ({ url }))} onChange={(v) => setPhotos(v.map((p) => p.url))} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {kind === 'MOVE_OUT' && (
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-3 font-semibold">Deposit settlement</p>
            <Field label="Security deposit (₹)">
              <Input inputMode="numeric" value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <div className="mt-3 space-y-2">
              {deductions.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Deduction का कारण"
                    value={d.reason}
                    onChange={(e) => setDeductions(deductions.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))}
                  />
                  <Input
                    className="w-32"
                    inputMode="numeric"
                    placeholder="₹"
                    value={d.amount}
                    onChange={(e) => setDeductions(deductions.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/\D/g, '') } : x)))}
                  />
                  <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button size="xs" variant="ghost" onClick={() => setDeductions([...deductions, { reason: '', amount: '' }])}>
                <Plus className="size-3.5" /> Deduction
              </Button>
            </div>
            {f.deposit && (
              <p className="mt-3 text-sm">
                Tenant को refund: <b>{formatINR(Math.max(0, refund))}</b>
              </p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------ owner payment details
export function OwnerPaymentCard({ owner }: { owner: { id: string; upiId?: string | null; pan?: string | null; email?: string | null } }) {
  const [f, setF] = useState({ upiId: owner.upiId ?? '', pan: owner.pan ?? '', email: owner.email ?? '' });
  const save = useApiMutation(() => patch(`/broker/owners/${owner.id}/payment`, f), {
    success: 'Owner details save',
    invalidate: [['owner', owner.id], ['owners']],
  });
  const rentOn = useFlag('rent_tracker');
  if (!rentOn) return null;
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="flex items-center gap-2 font-semibold">
        <ClipboardCheck className="size-4 text-brand-600" /> Rent & receipts
      </p>
      <p className="mt-1 mb-3 text-xs text-muted">
        UPI ID rent reminders में जाता है (tenant सीधे owner को pay करता है)। PAN rent receipt पर छपता है (HRA के लिए)।
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="UPI ID">
          <Input value={f.upiId} placeholder="name@okhdfcbank" onChange={(e) => setF({ ...f, upiId: e.target.value })} data-no-i18n />
        </Field>
        <Field label="PAN">
          <Input value={f.pan} maxLength={10} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} data-no-i18n />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-no-i18n />
        </Field>
      </div>
      <Button size="sm" className="mt-3" loading={save.isPending} onClick={() => save.mutate(undefined)}>
        <Check className="size-4" /> Save
      </Button>
    </div>
  );
}
