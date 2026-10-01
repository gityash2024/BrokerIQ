'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { CalendarCheck, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, MapPin, MessageCircle, Navigation, Phone, Star, X } from 'lucide-react';
import { VISIT_STATUS_LABELS, whatsappLink, type VisitStatus } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDate, img, qs, toLocalInput } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { VisitSlotsButton } from '@/components/broker/visit-slots';
import { LeadPicker, ListingPicker } from '@/components/broker/lead-picker';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { VideoJoin } from '@/components/site/video-join';
import { ApiErrorState } from '@/components/ui/api-error';

const STATUS_TONE: Record<VisitStatus, 'brand' | 'info' | 'success' | 'danger' | 'neutral'> = {
  SCHEDULED: 'brand',
  CONFIRMED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  NO_SHOW: 'danger',
};

/** Rolling 7-day window that starts today (so upcoming visits are always visible). */
function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export default function VisitsPage() {
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [day, setDay] = useState<Date | null>(null);
  const [complete, setComplete] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const end = new Date(week.getTime() + 7 * 86400_000);
  const q = useQuery({
    queryKey: ['visits', week.toISOString()],
    queryFn: () => api<any[]>(`/visits${qs({ from: week.toISOString(), to: end.toISOString() })}`),
  });
  const update = useApiMutation(({ id, ...b }: any) => patch(`/visits/${id}`, b), { invalidate: [['visits'], ['broker-dashboard']] });
  const days = Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * 86400_000));
  const list = useMemo(() => (q.data ?? []).filter((v) => !day || sameDay(new Date(v.scheduledAt), day)), [q.data, day]);

  const checkIn = (v: any) => {
    if (!navigator.geolocation) return toast.error('इस browser में location नहीं है');
    navigator.geolocation.getCurrentPosition(
      (p) =>
        update.mutate({ id: v.id, checkInLat: p.coords.latitude, checkInLng: p.coords.longitude }, { onSuccess: () => toast.success('Check-in हो गया 📍') }),
      () => toast.error('Location permission दें'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <>
      <PageHeader
        title="Site visits"
        subtitle="Client को visit से पहले automatic reminder जाता है (WhatsApp/push, अगर connected है)"
        actions={
          <div className="flex gap-2">
            <VisitSlotsButton />
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <CalendarPlus className="size-4" /> Visit schedule करें
            </Button>
          </div>
        }
      />

      <div className="card mb-5 p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="font-display font-bold">{formatDate(week, { month: 'long', year: 'numeric' })}</p>
          <div className="flex gap-1">
            <Button size="icon-sm" variant="ghost" onClick={() => (setWeek(new Date(week.getTime() - 7 * 86400_000)), setDay(null))} aria-label="Previous week">
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="xs" variant="secondary" onClick={() => (setWeek(startOfWeek(new Date())), setDay(null))}>
              आज से
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => (setWeek(new Date(week.getTime() + 7 * 86400_000)), setDay(null))} aria-label="Next week">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const n = (q.data ?? []).filter((v) => sameDay(new Date(v.scheduledAt), d) && v.status !== 'CANCELLED').length;
            const active = day && sameDay(day, d);
            const today = sameDay(d, new Date());
            return (
              <button
                key={d.toISOString()}
                onClick={() => setDay(active ? null : d)}
                className={cn('relative flex flex-col items-center rounded-xl py-2.5 transition', active ? 'text-white' : 'hover:bg-surface-2')}
              >
                {active && <motion.span layoutId="visit-day" className="absolute inset-0 rounded-xl bg-brand-600" />}
                <span className={cn('relative text-[11px] font-semibold uppercase', active ? 'text-white/80' : 'text-subtle')}>
                  {formatDate(d, { weekday: 'short' })}
                </span>
                <span className={cn('relative font-display text-lg font-extrabold', today && !active && 'text-brand-600')}>{d.getDate()}</span>
                <span className="relative flex h-2 gap-0.5">
                  {Array.from({ length: Math.min(n, 4) }, (_, i) => (
                    <span key={i} className={cn('size-1.5 rounded-full', active ? 'bg-white' : 'bg-saffron-500')} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !list.length ? (
        <Empty
          icon={<CalendarCheck className="size-7" />}
          title={day ? 'इस दिन कोई visit नहीं' : 'इन 7 दिनों में कोई visit नहीं'}
          text="Lead page से या ऊपर वाले button से visit schedule करें।"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((v, i) => {
            const past = new Date(v.scheduledAt) < new Date();
            const open = v.status === 'SCHEDULED' || v.status === 'CONFIRMED';
            const loc = v.listing?.latitude ? `${v.listing.latitude},${v.listing.longitude}` : (v.address ?? v.listing?.address);
            return (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card overflow-hidden"
              >
                <div className="flex gap-3 p-4">
                  <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-surface-2 py-2 text-center">
                    <span className="text-[11px] font-bold text-subtle uppercase">{formatDate(v.scheduledAt, { weekday: 'short' })}</span>
                    <span className="font-display text-xl leading-none font-extrabold">{new Date(v.scheduledAt).getDate()}</span>
                    <span className="text-[11px] font-semibold text-brand-600">{formatDate(v.scheduledAt, { timeStyle: 'short' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/broker/leads/${v.lead.id}`} className="font-semibold hover:text-brand-600">
                        {v.lead.name || v.lead.phone}
                      </Link>
                      <Badge tone={STATUS_TONE[v.status as VisitStatus]}>{VISIT_STATUS_LABELS[v.status as VisitStatus]}</Badge>
                      {v.mode === 'VIDEO' && <Badge tone="info">Video</Badge>}
                    </div>
                    {v.listing ? (
                      <Link href={`/property/${v.listing.slug}`} target="_blank" className="mt-1 flex items-center gap-2 text-sm text-muted hover:text-fg">
                        {v.listing.coverUrl && <img src={img(v.listing.coverUrl, 80)} alt="" className="size-8 rounded-lg object-cover" />}
                        <span className="line-clamp-1">{v.listing.title}</span>
                      </Link>
                    ) : (
                      v.address && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                          <MapPin className="size-3.5" /> {v.address}
                        </p>
                      )
                    )}
                    {v.checkInAt && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                        <Navigation className="size-3" /> Checked-in {formatDate(v.checkInAt, { timeStyle: 'short' })}
                      </p>
                    )}
                    {v.feedback && <p className="mt-1 line-clamp-2 text-xs text-muted">“{v.feedback}”</p>}
                    {v.rating && (
                      <p className="mt-1 flex">
                        {Array.from({ length: 5 }, (_, k) => (
                          <Star key={k} className={cn('size-3.5', k < v.rating ? 'fill-saffron-500 text-saffron-500' : 'text-line')} />
                        ))}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-surface-2/50 px-4 py-2.5">
                  {!past && <VideoJoin visit={v} size="xs" />}
                  <Button size="icon-sm" variant="ghost" href={`tel:${v.lead.phone}`} aria-label="Call">
                    <Phone className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    external
                    href={whatsappLink(
                      v.lead.phone,
                      `Hi ${v.lead.name ?? ''}, ${formatDate(v.scheduledAt, { dateStyle: 'medium', timeStyle: 'short' })} पर site visit confirm है। ${v.listing?.title ?? ''}`,
                    )}
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="size-4 text-emerald-600" />
                  </Button>
                  {loc && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      external
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc)}`}
                      aria-label="Directions"
                    >
                      <Navigation className="size-4" />
                    </Button>
                  )}
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {open && v.status === 'SCHEDULED' && !past && (
                      <Button size="xs" variant="secondary" onClick={() => update.mutate({ id: v.id, status: 'CONFIRMED' })}>
                        Confirm
                      </Button>
                    )}
                    {open && !v.checkInAt && (
                      <Button size="xs" variant="secondary" onClick={() => checkIn(v)}>
                        <MapPin className="size-3.5" /> Check-in
                      </Button>
                    )}
                    {open && (
                      <Button size="xs" variant="success" onClick={() => setComplete(v)}>
                        <Check className="size-3.5" /> Done
                      </Button>
                    )}
                    {open && past && (
                      <Button size="xs" variant="ghost" onClick={() => update.mutate({ id: v.id, status: 'NO_SHOW' })}>
                        No-show
                      </Button>
                    )}
                    {open && !past && (
                      <Button size="icon-sm" variant="ghost" onClick={() => update.mutate({ id: v.id, status: 'CANCELLED' })} aria-label="Cancel">
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      <CompleteVisit
        visit={complete}
        onClose={() => setComplete(null)}
        onSave={(b) =>
          update.mutate({ id: complete.id, status: 'COMPLETED', ...b }, { onSuccess: () => (setComplete(null), toast.success('Visit completed')) })
        }
        saving={update.isPending}
      />
      <AddVisit open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function CompleteVisit({
  visit,
  onClose,
  onSave,
  saving,
}: {
  visit: any;
  onClose: () => void;
  onSave: (b: { feedback: string | null; rating: number | null }) => void;
  saving: boolean;
}) {
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState(0);
  return (
    <Dialog
      open={!!visit}
      onOpenChange={(v) => !v && onClose()}
      title="Visit कैसी रही?"
      description="Client का interest और feedback — अगला step तय करने में मदद करेगा।"
      size="sm"
      footer={
        <Button variant="success" loading={saving} onClick={() => onSave({ feedback: feedback || null, rating: rating || null })}>
          Save
        </Button>
      }
    >
      <p className="mb-2 text-sm font-semibold">Client interest</p>
      <div className="mb-4 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} star`}>
            <Star className={cn('size-8 transition', n <= rating ? 'scale-110 fill-saffron-500 text-saffron-500' : 'text-line hover:text-saffron-300')} />
          </button>
        ))}
      </div>
      <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="जैसे: Layout पसंद आया, price पर negotiate करना चाहते हैं" />
    </Dialog>
  );
}

function AddVisit({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [lead, setLead] = useState<any>(null);
  const [listingId, setListingId] = useState('');
  const [at, setAt] = useState(() => {
    const d = new Date(Date.now() + 86400_000);
    d.setHours(11, 0, 0, 0);
    return toLocalInput(d);
  });
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const create = useApiMutation(
    () =>
      post('/visits', { leadId: lead.id, listingId: listingId || null, scheduledAt: new Date(at).toISOString(), address: address || null, note: note || null }),
    {
      success: 'Visit scheduled — lead stage "Site visit" पर गया',
      invalidate: [['visits'], ['broker-dashboard'], ['kanban'], ['leads']],
      onSuccess: () => {
        onOpenChange(false);
        setLead(null);
        setListingId('');
        setNote('');
      },
    },
  );
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Site visit schedule करें"
      footer={
        <Button disabled={!lead} loading={create.isPending} onClick={() => create.mutate(undefined)}>
          <Clock className="size-4" /> Schedule
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Lead" required>
          <LeadPicker value={lead} onChange={setLead} />
        </Field>
        <Field label="Property">
          <ListingPicker value={listingId} onChange={setListingId} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time" required>
            <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </Field>
          <Field label="Meeting point">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="जैसे: Society main gate" />
          </Field>
        </div>
        <Field label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
