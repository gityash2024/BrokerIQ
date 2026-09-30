'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Download, ExternalLink, FileBarChart, Facebook, Link2, MessageCircle, QrCode, Share2, Sparkles, Stamp, Trash2 } from 'lucide-react';
import { WATERMARK_POSITIONS, formatINR, type PhotoBranding } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFlag } from '@/lib/config';
import { del, post, useApiMutation } from '@/lib/hooks';
import { API_URL, cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field, Input, Select } from '../ui/field';
import { Badge, Skeleton, Switch } from '../ui/misc';
import { CopyField } from '../panel/integration-card';

const POSITION_LABEL: Record<(typeof WATERMARK_POSITIONS)[number], string> = {
  br: 'नीचे दाएँ',
  bl: 'नीचे बाएँ',
  tr: 'ऊपर दाएँ',
  tl: 'ऊपर बाएँ',
  center: 'बीच में',
};

const put = <T = any,>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });

/** Watermark / auto-enhance for listing photos and Facebook/Instagram auto-post. */
export function BrandingSettings({ isAdmin }: { isAdmin: boolean }) {
  const q = useQuery({ queryKey: ['broker-branding'], queryFn: () => api<any>('/broker/branding') });
  const social = useFlag('social_autopost');
  const branding = useFlag('photo_branding');
  const [b, setB] = useState<PhotoBranding | null>(null);
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (q.data) {
      setB(q.data.photoBranding);
      setAuto(q.data.socialAutoPost);
    }
  }, [q.data]);
  const save = useApiMutation(() => put('/broker/branding', { photoBranding: b, socialAutoPost: auto }), {
    success: 'Save हो गया — नई photos पर लागू होगा',
    invalidate: [['broker-branding']],
  });
  const posts = useQuery({ queryKey: ['social-posts'], queryFn: () => api<any[]>('/broker/social-posts'), enabled: social });
  if (!q.data || !b) return <Skeleton className="h-64 max-w-2xl" />;
  const firm = q.data.firm as string;
  return (
    <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
      {branding && (
        <div className="card p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
              <Stamp className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-display font-bold">Photos पर watermark</p>
              <p className="text-sm text-muted">
                Upload होते ही हर listing photo पर आपकी firm का नाम — portals या WhatsApp पर कोई photo copy करे तो भी नाम आपका दिखे।
              </p>
            </div>
            <Switch checked={b.watermark} disabled={!isAdmin} onCheckedChange={(v) => setB({ ...b, watermark: v })} />
          </div>
          <div className={cn('mt-5 space-y-4', !b.watermark && 'pointer-events-none opacity-50')}>
            <Field label="Watermark text">
              <Input value={b.text ?? ''} placeholder={firm} maxLength={60} onChange={(e) => setB({ ...b, text: e.target.value })} data-no-i18n />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="जगह">
                <Select value={b.position} onChange={(e) => setB({ ...b, position: e.target.value as PhotoBranding['position'] })}>
                  {WATERMARK_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {POSITION_LABEL[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`गहराई (${Math.round(b.opacity * 100)}%)`}>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  value={b.opacity}
                  onChange={(e) => setB({ ...b, opacity: Number(e.target.value) })}
                  className="w-full accent-brand-600"
                />
              </Field>
            </div>
            <WatermarkPreview text={b.text?.trim() || firm} position={b.position} opacity={b.opacity} />
          </div>
          <div className="mt-6 flex items-start gap-3 border-t border-line pt-5">
            <span className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15">
              <Sparkles className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-display font-bold">Auto-enhance</p>
              <p className="text-sm text-muted">अंधेरी या फीकी photos की brightness, रंग और sharpness अपने-आप ठीक।</p>
            </div>
            <Switch checked={b.enhance} disabled={!isAdmin} onCheckedChange={(v) => setB({ ...b, enhance: v })} />
          </div>
        </div>
      )}
      {social && (
        <div className="card p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15">
              <Facebook className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-display font-bold">Facebook + Instagram auto-post</p>
              <p className="text-sm text-muted">
                नई listing live होते ही photo और details आपके अपने Page / Instagram पर। पहले{' '}
                <Link href="/broker/connectors" className="font-semibold text-brand-600">
                  Connectors
                </Link>{' '}
                में &ldquo;Facebook Page + Instagram&rdquo; जोड़ें।
              </p>
            </div>
            <Switch checked={auto} disabled={!isAdmin} onCheckedChange={setAuto} />
          </div>
          <p className="mt-5 mb-2 text-sm font-semibold">हाल के posts</p>
          {!posts.data?.length ? (
            <p className="text-sm text-muted">अभी कोई post नहीं।</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {posts.data.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Badge tone={p.status === 'POSTED' ? 'success' : 'danger'}>{p.platform === 'FACEBOOK' ? 'Facebook' : 'Instagram'}</Badge>
                  <span className="truncate text-xs text-muted">{p.status === 'POSTED' ? new Date(p.createdAt).toLocaleString('en-IN') : p.error}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {isAdmin && (branding || social) && (
        <div className="lg:col-span-2">
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function WatermarkPreview({ text, position, opacity }: { text: string; position: PhotoBranding['position']; opacity: number }) {
  const place = {
    br: 'right-3 bottom-3',
    bl: 'left-3 bottom-3',
    tr: 'right-3 top-3',
    tl: 'left-3 top-3',
    center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
  }[position];
  return (
    <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-gradient-to-br from-sky-300 via-slate-300 to-amber-200 dark:from-sky-900 dark:via-slate-700 dark:to-amber-900">
      <span
        className={cn('absolute rounded-md px-2 py-1 text-sm font-bold text-white', place)}
        style={{ background: `rgba(0,0,0,${(opacity * 0.55).toFixed(2)})`, opacity: Math.min(1, opacity + 0.35) }}
        data-no-i18n
      >
        {text}
      </span>
    </div>
  );
}

/** The signed-in broker's digital visiting card: link, QR, contact file, WhatsApp share. */
export function VisitingCardPanel({ slug }: { slug: string }) {
  const { user } = useAuth();
  const enabled = useFlag('visiting_card');
  const [who, setWho] = useState<'me' | 'firm'>('me');
  if (!enabled || !user) return null;
  const qs = who === 'me' ? `?a=${user.id}` : '';
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/card/${slug}${qs}`;
  const apiBase = `${API_URL}/api/public/card/${slug}`;
  return (
    <div className="grid max-w-4xl gap-5 md:grid-cols-[1fr_240px]">
      <div className="card space-y-4 p-6">
        <div>
          <p className="font-display font-bold">Digital visiting card</p>
          <p className="text-sm text-muted">
            Link या QR भेजें — client एक tap में call, WhatsApp, आपकी listings और &ldquo;Contact save करें&rdquo; कर सकता है। छपे card की ज़रूरत नहीं।
          </p>
        </div>
        <Select value={who} onChange={(e) => setWho(e.target.value as 'me' | 'firm')} className="max-w-xs">
          <option value="me">मेरा card ({user.name})</option>
          <option value="firm">Firm का card</option>
        </Select>
        <CopyField label="Card link" value={url} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="whatsapp" external href={`https://wa.me/?text=${encodeURIComponent(`मेरा digital visiting card: ${url}`)}`}>
            <MessageCircle className="size-4" /> WhatsApp पर भेजें
          </Button>
          <Button size="sm" variant="secondary" href={url} external>
            <ExternalLink className="size-4" /> देखें
          </Button>
          <Button size="sm" variant="secondary" href={`${apiBase}/vcf${qs}`} external>
            <Download className="size-4" /> Contact (.vcf)
          </Button>
        </div>
      </div>
      <div className="card grid place-items-center p-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${apiBase}/qr${qs}`} alt="Visiting card QR" className="size-44 rounded-xl bg-white p-2" />
        <Button size="sm" variant="link" href={`${apiBase}/qr${qs}`} external className="mt-2">
          <QrCode className="size-4" /> QR download
        </Button>
      </div>
    </div>
  );
}

/** Owner report: a read-only link the broker shares with the landlord. */
export function OwnerReportCard({
  owner,
}: {
  owner: { id: string; name: string; phone: string; email?: string | null; reportToken?: string | null; weeklyReport?: boolean };
}) {
  const enabled = useFlag('owner_reports');
  const [url, setUrl] = useState<string | null>(
    owner.reportToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/o/${owner.reportToken}` : null,
  );
  const [weekly, setWeekly] = useState(!!owner.weeklyReport);
  const create = useApiMutation(() => post<any>(`/broker/owners/${owner.id}/report-link`), {
    success: 'Report link बन गया',
    invalidate: [['owners']],
    onSuccess: (r) => setUrl(r.url),
  });
  const revoke = useApiMutation(() => del(`/broker/owners/${owner.id}/report-link`), {
    success: 'Link बंद कर दिया',
    invalidate: [['owners']],
    onSuccess: () => (setUrl(null), setWeekly(false)),
  });
  const setWeeklyM = useApiMutation((on: boolean) => put<any>(`/broker/owners/${owner.id}/weekly-report`, { on }), {
    success: (r: any) => (r.weeklyReport ? 'हर सोमवार owner को email जाएगा' : 'Weekly email बंद'),
    invalidate: [['owners']],
    onSuccess: (r) => (setWeekly(r.weeklyReport), r.url && setUrl(r.url)),
  });
  if (!enabled) return null;
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="flex items-center gap-2 font-semibold">
        <FileBarChart className="size-4 text-brand-600" /> Owner report
      </p>
      <p className="mt-1 text-xs text-muted">
        Owner को दिखाएँ कि आप उनकी property कैसे promote कर रहे हैं — views, enquiries, visits। Tenants के number नहीं दिखते।
      </p>
      {url ? (
        <div className="mt-3 space-y-3">
          <CopyField label="Link" value={url} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="whatsapp"
              external
              href={`https://wa.me/${owner.phone.replace(/\D/g, '').slice(-10) ? `91${owner.phone.replace(/\D/g, '').slice(-10)}` : ''}?text=${encodeURIComponent(`नमस्ते ${owner.name} जी, आपकी property की report यहाँ देखें: ${url}`)}`}
            >
              <Share2 className="size-4" /> Owner को भेजें
            </Button>
            <Button size="sm" variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate(undefined)}>
              <Trash2 className="size-4" /> Link बंद करें
            </Button>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              हर सोमवार email भेजें
              {!owner.email && <span className="block text-xs text-muted">Owner का email जोड़ें</span>}
            </span>
            <Switch checked={weekly} disabled={!owner.email || setWeeklyM.isPending} onCheckedChange={(v) => setWeeklyM.mutate(v)} />
          </label>
        </div>
      ) : (
        <Button size="sm" className="mt-3" loading={create.isPending} onClick={() => create.mutate(undefined)}>
          <Link2 className="size-4" /> Report link बनाएँ
        </Button>
      )}
    </div>
  );
}

/** Pick 2–5 listings (from the lead's matches) → branded comparison PDF to send the client. */
export function ComparisonDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: { id: string; name: string; phone: string };
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const matches = useQuery({ queryKey: ['lead-matches', lead.id], queryFn: () => api<any[]>(`/leads/${lead.id}/matches`), enabled: open });
  const [picked, setPicked] = useState<string[]>([]);
  const [pdf, setPdf] = useState<string | null>(null);
  const create = useApiMutation(() => post<any>('/broker/comparisons', { listingIds: picked, leadId: lead.id }), {
    success: 'Comparison PDF तैयार',
    invalidate: [['lead', lead.id]],
    onSuccess: (r) => setPdf(r.pdfUrl),
  });
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 5 ? (toast.error('ज़्यादा से ज़्यादा 5 properties'), p) : [...p, id]));
  const items = (matches.data as any)?.items ?? matches.data ?? [];
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (onOpenChange(v), !v && (setPdf(null), setPicked([])))}
      size="lg"
      title="Comparison PDF"
      description="2–5 properties चुनें — rent, deposit, area, furnishing, floor, amenities सब एक page पर, आपकी firm के नाम के साथ।"
      footer={
        pdf ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" href={pdf} external>
              <ExternalLink className="size-4" /> PDF खोलें
            </Button>
            <Button
              variant="whatsapp"
              external
              href={`https://wa.me/91${lead.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`${lead.name.split(' ')[0]} जी, आपके लिए properties की तुलना: ${pdf}`)}`}
            >
              <MessageCircle className="size-4" /> WhatsApp पर भेजें
            </Button>
            <Button variant="ghost" onClick={() => (navigator.clipboard?.writeText(pdf), toast.success('Link copy हुआ'))}>
              <Copy className="size-4" /> Copy
            </Button>
          </div>
        ) : (
          <Button disabled={picked.length < 2} loading={create.isPending} onClick={() => create.mutate(undefined)}>
            PDF बनाएँ ({picked.length})
          </Button>
        )
      }
    >
      {matches.isLoading ? (
        <Skeleton className="h-48" />
      ) : !items.length ? (
        <p className="text-sm text-muted">इस lead की requirement से मिलती कोई live property नहीं मिली। Requirement भरें या listings जोड़ें।</p>
      ) : (
        <div className="grid max-h-[26rem] gap-2 overflow-y-auto sm:grid-cols-2">
          {items.map((l: any) => (
            <button
              key={l.id}
              onClick={() => toggle(l.id)}
              className={cn(
                'card flex gap-3 p-3 text-left transition',
                picked.includes(l.id) ? 'border-brand-500 ring-2 ring-brand-500/30' : 'hover:border-brand-300',
              )}
            >
              <input type="checkbox" readOnly checked={picked.includes(l.id)} className="mt-1 accent-brand-600" />
              <div className="min-w-0 text-sm">
                <p className="line-clamp-2 font-semibold" data-no-i18n>
                  {l.title}
                </p>
                <p className="text-xs text-muted">
                  {formatINR(l.price)}/month{l.matchScore ? ` · ${l.matchScore}% match` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
