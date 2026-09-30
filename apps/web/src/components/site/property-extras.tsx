'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Car, Orbit, PlayCircle, Star, TrainFront } from 'lucide-react';
import { OFFICE_HUBS, estimateCommute, formatINR, moveInCost } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Field, Input, Select, Textarea } from '../ui/field';
import { useFlag } from '@/lib/config';

// ------------------------------------------------------------------ video tour
function youtubeId(url: string) {
  return url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
}
const isVideoFile = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || url.includes('/media/f/listing/');

export function VideoTour({ url }: { url: string }) {
  const yt = youtubeId(url);
  if (yt)
    return (
      <div className="card mt-4 aspect-video overflow-hidden">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title="Video tour"
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  if (isVideoFile(url)) return <video className="card mt-4 aspect-video w-full bg-black" src={url} controls preload="metadata" playsInline />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="card mt-4 flex items-center gap-3 p-4 font-semibold text-brand-600">
      <PlayCircle className="size-8" /> Video देखें
    </a>
  );
}

// ------------------------------------------------------------------ 360° viewer (Pannellum, loaded on demand)
const PANNELLUM = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build';
function loadPannellum(): Promise<any> {
  const w = window as any;
  if (w.pannellum) return Promise.resolve(w.pannellum);
  return new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${PANNELLUM}/pannellum.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `${PANNELLUM}/pannellum.js`;
    js.onload = () => resolve(w.pannellum);
    js.onerror = reject;
    document.body.appendChild(js);
  });
}

export function PanoramaButton({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    let viewer: any;
    const t = setTimeout(() => {
      loadPannellum()
        .then((p) => {
          if (box.current) viewer = p.viewer(box.current, { type: 'equirectangular', panorama: urls[idx], autoLoad: true, showZoomCtrl: true, compass: false });
        })
        .catch(() => toast.error('360° viewer load नहीं हुआ'));
    }, 50);
    return () => {
      clearTimeout(t);
      viewer?.destroy?.();
    };
  }, [open, idx, urls]);
  if (!urls.length) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Orbit className="size-4" /> 360° view{urls.length > 1 ? ` (${urls.length})` : ''}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} size="xl" title="360° view" description="घुमाकर देखें — drag करें या phone घुमाएँ">
        <div ref={box} className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900" />
        {urls.length > 1 && (
          <div className="mt-3 flex gap-2">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn('rounded-lg border px-3 py-1 text-sm', i === idx ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line')}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
}

// ------------------------------------------------------------------ first-month cost
export function MoveInCard({ l }: { l: any }) {
  if (l.purpose !== 'RENT') return null;
  const depositMonths = l.securityDeposit && l.price ? l.securityDeposit / l.price : 0;
  const c = moveInCost({
    rent: l.price,
    depositMonths,
    brokerage: (l.brokerageType ?? 'NONE') as any,
    brokerageFixed: l.brokerageAmount ?? 0,
    maintenance: l.maintenance ?? 0,
  });
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">पहले महीने का कुल खर्च</h2>
        <p className="font-display text-2xl font-extrabold">{formatINR(c.total)}</p>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        {c.lines.map((x) => (
          <div key={x.label} className="flex justify-between gap-3">
            <dt className="text-muted">{x.label}</dt>
            <dd className="font-medium">{formatINR(x.amount)}</dd>
          </div>
        ))}
      </dl>
      {c.refundable > 0 && <p className="mt-2 text-xs text-emerald-600">इसमें {formatINR(c.refundable)} deposit है जो घर छोड़ने पर वापस मिलता है।</p>}
    </section>
  );
}

/** Hidden while Super Admin has "commute" switched off. */
export function CommuteCard(props: { l: any }) {
  return useFlag('commute') ? <CommuteCardInner {...props} /> : null;
}

// ------------------------------------------------------------------ commute to an office hub
function CommuteCardInner({ l }: { l: any }) {
  const [hub, setHub] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('biq.officeHub')) || 'cyber-city');
  const from =
    l.latitude != null && l.longitude != null
      ? { lat: l.latitude, lng: l.longitude }
      : l.locality?.latitude != null
        ? { lat: l.locality.latitude, lng: l.locality.longitude }
        : null;
  if (!from) return null;
  const h = OFFICE_HUBS.find((x) => x.key === hub) ?? OFFICE_HUBS[0];
  const e = estimateCommute(from, h);
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Office से दूरी</h2>
        <Select className="h-9 w-48" value={hub} onChange={(ev) => (setHub(ev.target.value), localStorage.setItem('biq.officeHub', ev.target.value))}>
          {OFFICE_HUBS.map((x) => (
            <option key={x.key} value={x.key}>
              {x.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className={cn('rounded-xl border p-3', e.mode === 'car' ? 'border-brand-500' : 'border-line')}>
          <p className="flex items-center gap-1.5 text-muted">
            <Car className="size-4" /> Car / cab
          </p>
          <p className="mt-1 font-display text-xl font-bold">~{e.carMin} मिनट</p>
        </div>
        <div className={cn('rounded-xl border p-3', e.mode === 'metro' ? 'border-brand-500' : 'border-line')}>
          <p className="flex items-center gap-1.5 text-muted">
            <TrainFront className="size-4" /> Metro
          </p>
          <p className="mt-1 font-display text-xl font-bold">{e.metroMin != null ? `~${e.metroMin} मिनट` : '—'}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-subtle">अनुमानित, peak hours में · {e.km} km सीधी दूरी</p>
    </section>
  );
}

// ------------------------------------------------------------------ resident reviews (locality / society)
const DIMS: [string, string][] = [
  ['water', 'पानी'],
  ['power', 'Power backup'],
  ['safety', 'सुरक्षा'],
  ['parking', 'Parking'],
  ['connectivity', 'Connectivity'],
  ['maintenance', 'Maintenance'],
];

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n}`}>
          <Star className={cn('size-4', n <= value ? 'fill-amber-400 text-amber-400' : 'text-subtle')} />
        </button>
      ))}
    </span>
  );
}

/** Hidden while Super Admin has "locality_reviews" switched off. */
export function ResidentReviews(props: { localitySlug: string; society?: string | null; title?: string }) {
  return useFlag('locality_reviews') ? <ResidentReviewsInner {...props} /> : null;
}

function ResidentReviewsInner({ localitySlug, society, title }: { localitySlug: string; society?: string | null; title?: string }) {
  const q = useQuery({
    queryKey: ['loc-reviews', localitySlug, society ?? ''],
    queryFn: () => api<any>(`/public/localities/${localitySlug}/reviews${society ? `?society=${encodeURIComponent(society)}` : ''}`, { auth: false }),
  });
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const d = q.data;
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{title ?? (society ? `${society} — रहने वालों की राय` : 'रहने वालों की राय')}</h2>
        {user && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Review लिखें
          </Button>
        )}
      </div>
      {!d?.count ? (
        <p className="mt-3 text-sm text-muted">अभी कोई review नहीं। यहाँ रहते हैं? पानी, power backup, सुरक्षा के बारे में बताइए।</p>
      ) : (
        <>
          <div className="card mt-4 grid gap-3 p-4 sm:grid-cols-3">
            {DIMS.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted">{label}</span>
                <span className="flex items-center gap-1 font-semibold">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" /> {d.avg[k] ?? '—'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {d.items.slice(0, 6).map((r: any) => (
              <div key={r.id} className="card p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <Building2 className="size-4 text-muted" /> <span data-no-i18n>{r.societyName || 'Locality'}</span> · <span data-no-i18n>{r.author}</span>
                  {r.isResident ? ' · Resident' : ''}
                </p>
                {r.pros && (
                  <p className="mt-1.5">
                    <span className="font-semibold text-emerald-600">👍 </span>
                    <span data-no-i18n>{r.pros}</span>
                  </p>
                )}
                {r.cons && (
                  <p className="mt-1">
                    <span className="font-semibold text-rose-600">👎 </span>
                    <span data-no-i18n>{r.cons}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <ReviewDialog open={open} onClose={() => setOpen(false)} localitySlug={localitySlug} society={society} />
    </section>
  );
}

function ReviewDialog({ open, onClose, localitySlug, society }: { open: boolean; onClose: () => void; localitySlug: string; society?: string | null }) {
  const [f, setF] = useState<Record<string, any>>({
    societyName: society ?? '',
    water: 0,
    power: 0,
    safety: 0,
    parking: 0,
    connectivity: 0,
    maintenance: 0,
    pros: '',
    cons: '',
    isResident: true,
  });
  const [busy, setBusy] = useState(false);
  const ready = DIMS.every(([k]) => f[k] > 0);
  const save = async () => {
    setBusy(true);
    try {
      await api(`/localities/${localitySlug}/reviews`, {
        method: 'POST',
        body: { ...f, societyName: f.societyName || undefined, pros: f.pros || undefined, cons: f.cons || undefined },
      });
      toast.success('धन्यवाद! Review जाँच के बाद दिखेगा।');
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
      title="Review लिखें"
      description="सच्ची राय दूसरे tenants की मदद करती है"
      footer={
        <Button onClick={save} loading={busy} disabled={!ready}>
          Submit
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Society / building (optional)">
          <Input value={f.societyName} onChange={(e) => setF({ ...f, societyName: e.target.value })} />
        </Field>
        {DIMS.map(([k, label]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-sm">
            <span>{label}</span>
            <Stars value={f[k]} onChange={(v) => setF({ ...f, [k]: v })} />
          </div>
        ))}
        <Field label="अच्छी बातें">
          <Textarea rows={2} value={f.pros} onChange={(e) => setF({ ...f, pros: e.target.value })} />
        </Field>
        <Field label="कमियाँ">
          <Textarea rows={2} value={f.cons} onChange={(e) => setF({ ...f, cons: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-600" checked={f.isResident} onChange={(e) => setF({ ...f, isResident: e.target.checked })} /> मैं यहाँ
          रहता / रहती हूँ या रह चुका / चुकी हूँ
        </label>
      </div>
    </Dialog>
  );
}
