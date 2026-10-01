'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Field, Input, Select, Textarea } from '../ui/field';
import { Skeleton } from '../ui/misc';
import { Segmented } from '../ui/tabs';
import { useFlag } from '@/lib/config';

/** Anti-scam reminder shown next to every contact option. */
export function SafetyNote({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300', className)}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <span>Property देखे बिना token / advance न दें। Payment हमेशा visit और agreement के बाद करें — शक हो तो listing report करें।</span>
    </p>
  );
}

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const timeLabel = (at: string) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/** Pick one of the broker's free visit slots (next 7 days) and book it. */
export function SlotBooking({
  listingId,
  open,
  onClose,
  onBooked,
}: {
  listingId: string;
  open: boolean;
  onClose: () => void;
  onBooked: (when: string) => void;
}) {
  const q = useQuery({ queryKey: ['slots', listingId], queryFn: () => api<any>(`/listings/${listingId}/slots?days=7`, { auth: false }), enabled: open });
  const [day, setDay] = useState<string | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'IN_PERSON' | 'VIDEO'>('IN_PERSON');
  const videoOn = useFlag('video_visits');
  const [busy, setBusy] = useState(false);
  const days: { date: string; slots: { at: string; available: number }[] }[] = q.data?.days ?? [];
  const activeDay = day ?? days.find((d) => d.slots.some((s) => s.available > 0))?.date ?? null;
  const book = async () => {
    if (!at) return;
    setBusy(true);
    try {
      const r = await api<any>(`/listings/${listingId}/book-visit`, { method: 'POST', body: { at, note: note || undefined, mode } });
      toast.success(
        mode === 'VIDEO'
          ? `Video visit book हो गई: ${r.when} 🎉 — call link “Visits” में और reminder में मिलेगा`
          : `Visit book हो गई: ${r.when} 🎉 — एक दिन पहले और 1 घंटा पहले reminder मिलेगा`,
      );
      onBooked(r.when);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      q.refetch();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Site visit book करें"
      description="Broker के खाली समय में से चुनें — booking तुरंत confirm होती है।"
      footer={
        <Button onClick={book} loading={busy} disabled={!at}>
          Visit book करें
        </Button>
      }
    >
      {q.isLoading ? (
        <Skeleton className="h-40" />
      ) : !days.length ? (
        <p className="text-sm text-muted">अगले 7 दिन में कोई slot खाली नहीं — enquiry भेजें, broker समय तय करेंगे।</p>
      ) : (
        <div className="space-y-4">
          {videoOn && (
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'IN_PERSON', label: 'Property पर जाकर' },
                { value: 'VIDEO', label: '🎥 Video call पर' },
              ]}
            />
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d.date}
                onClick={() => (setDay(d.date), setAt(null))}
                className={cn(
                  'shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold',
                  activeDay === d.date ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/10' : 'border-line',
                )}
              >
                {dayLabel(d.date)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {days
              .find((d) => d.date === activeDay)
              ?.slots.map((s) => (
                <button
                  key={s.at}
                  disabled={s.available <= 0}
                  onClick={() => setAt(s.at)}
                  className={cn(
                    'rounded-xl border px-2 py-2 text-sm',
                    s.available <= 0
                      ? 'cursor-not-allowed border-line text-subtle line-through'
                      : at === s.at
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-line hover:border-brand-400',
                  )}
                >
                  {timeLabel(s.at)}
                </button>
              ))}
          </div>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="जैसे: family के साथ आएँगे" />
          </Field>
          <SafetyNote />
        </div>
      )}
    </Dialog>
  );
}

/** Record a token / advance paid to the broker directly (UPI / cash) — BrokerIQ never handles the money. */
export function TokenDialog({ listingId, open, onClose }: { listingId: string; open: boolean; onClose: () => void }) {
  const info = useQuery({ queryKey: ['token-info', listingId], queryFn: () => api<any>(`/listings/${listingId}/token-info`), enabled: open });
  const [f, setF] = useState({ amount: '', mode: 'UPI', ref: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const d = info.data;
  const upi = d?.org?.upiId
    ? `upi://pay?${new URLSearchParams({ pa: d.org.upiId, pn: d.org.upiName || d.org.name, am: f.amount || '', cu: 'INR', tn: 'Token' }).toString()}`
    : null;
  const save = async () => {
    setBusy(true);
    try {
      await api(`/listings/${listingId}/token`, {
        method: 'POST',
        body: { amount: Number(f.amount), mode: f.mode, ref: f.ref || undefined, notes: f.notes || undefined },
      });
      toast.success('Record हो गया — broker के confirm करने पर आपको बताएँगे');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Token / advance का record"
      description="Payment सीधे broker को होता है। यहाँ सिर्फ़ record रखें ताकि broker confirm करे और हिसाब साफ़ रहे।"
      footer={
        <Button onClick={save} loading={busy} disabled={!Number(f.amount)}>
          Record करें
        </Button>
      }
    >
      {!d ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="space-y-3">
          <SafetyNote />
          {d.alreadyTaken && <p className="text-sm font-semibold text-amber-700">इस property पर पहले ही token लिया जा चुका है — broker से बात करें।</p>}
          {d.org?.upiId && (
            <div className="rounded-xl border border-line p-3 text-sm">
              Broker का UPI: <b data-no-i18n>{d.org.upiId}</b>
              {upi && Number(f.amount) > 0 && (
                <a href={upi} className="mt-2 block rounded-lg bg-emerald-600 px-3 py-2 text-center font-semibold text-white">
                  UPI app से {formatINR(Number(f.amount))} भेजें
                </a>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount (₹)" required>
              <Input
                inputMode="numeric"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })}
                placeholder={d.rent ? String(Math.round(d.rent / 4)) : ''}
              />
            </Field>
            <Field label="कैसे दिया">
              <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank transfer</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
          </div>
          <Field label="Reference (UTR / txn id)">
            <Input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} />
          </Field>
          <Field label="Note">
            <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
