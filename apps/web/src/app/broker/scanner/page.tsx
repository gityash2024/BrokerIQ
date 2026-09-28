'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { Camera, CheckCircle2, FileImage, FileText, Plus, RotateCcw, RotateCw, ScanLine, Sparkles, Trash2, Upload } from 'lucide-react';
import { BROKERAGE_LABELS, FURNISHING_LABELS, PROPERTY_TYPE_LABELS, RENTABLE_TYPES, formatPriceShort } from '@brokeriq/shared';
import { ApiError, api, errorMessage } from '@/lib/api';
import { post } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/misc';
import { IntegrationBanner } from '@/components/ui/api-error';
import { Dialog } from '@/components/ui/dialog';

interface Row {
  key: string;
  purpose: 'RENT';
  propertyType: string;
  localityId: string | null;
  localityName?: string | null;
  societyName: string | null;
  unit: string | null;
  floor: number | null;
  bedrooms: number | null;
  area: number | null;
  price: number | null;
  securityDeposit?: number | null;
  brokerageType?: string | null;
  brokerageAmount?: number | null;
  availableFrom?: string | null;
  furnishing: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  confidence?: number;
  page?: number;
  error?: string;
}

interface Page {
  key: string;
  dataUrl: string;
  status: 'pending' | 'scanning' | 'done' | 'error';
  rows: number;
  rawText?: string | null;
}

/** Rotate a data URL by 90° clockwise (for pages photographed sideways). */
async function rotate(dataUrl: string): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.height;
  c.height = img.width;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return c.toDataURL('image/jpeg', 0.85);
}

/** Same property twice (across pages)? */
const rowKey = (r: Partial<Row>) => [r.contactPhone ?? '', (r.unit ?? '').toLowerCase(), (r.societyName ?? '').toLowerCase(), r.price ?? ''].join('|');

/** Downscale a photo to a JPEG data URL (keeps the vision request small). */
async function toDataUrl(file: File, max = 1800): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

const blank = (): Row => ({ key: Math.random().toString(36).slice(2), purpose: 'RENT', propertyType: 'APARTMENT', localityId: null, societyName: null, unit: null, floor: null, bedrooms: null, area: null, price: null, furnishing: null, contactName: null, contactPhone: null, notes: null });

export default function ScannerPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState<false | 'draft' | 'submit'>(false);
  const [done, setDone] = useState<{ created: number; submitted: boolean } | null>(null);
  const [notConfigured, setNotConfigured] = useState<ApiError | null>(null);
  const { data: locs } = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const preview = pages.find((p) => p.key === active)?.dataUrl ?? pages[pages.length - 1]?.dataUrl ?? null;

  /** OCR + AI-extract pages one at a time (small requests, visible progress). */
  const processPages = async (list: Page[]) => {
    setScanning(true);
    let added = 0;
    for (const pg of list) {
      setActive(pg.key);
      setPages((ps) => ps.map((p) => (p.key === pg.key ? { ...p, status: 'scanning' } : p)));
      try {
        const pageNo = pages.findIndex((p) => p.key === pg.key) + 1 || undefined;
        const res = await post<{ rows: Omit<Row, 'key'>[]; rawText?: string | null }>('/ai/scan', { image: pg.dataUrl, hint: hint || undefined, page: pageNo });
        setRows((rs) => {
          const seen = new Set(rs.map(rowKey));
          const fresh = res.rows.filter((r) => !seen.has(rowKey(r))).map((r) => ({ ...r, key: Math.random().toString(36).slice(2) }) as Row);
          added += fresh.length;
          return [...rs, ...fresh];
        });
        setPages((ps) => ps.map((p) => (p.key === pg.key ? { ...p, status: 'done', rows: res.rows.length, rawText: res.rawText } : p)));
      } catch (e) {
        setPages((ps) => ps.map((p) => (p.key === pg.key ? { ...p, status: 'error' } : p)));
        if (e instanceof ApiError && e.isNotConfigured) {
          setNotConfigured(e);
          break;
        }
        toast.error(errorMessage(e));
      }
    }
    setScanning(false);
    if (added) toast.success(`${added} ${added === 1 ? 'property' : 'properties'} पढ़ी गईं — check करके import करें`);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setDone(null);
    setNotConfigured(null);
    const fresh: Page[] = [];
    for (const f of Array.from(files).slice(0, 20)) fresh.push({ key: Math.random().toString(36).slice(2), dataUrl: await toDataUrl(f), status: 'pending', rows: 0 });
    setPages((ps) => [...ps, ...fresh]);
    await processPages(fresh);
  };
  const rotateAndRescan = async (pg: Page) => {
    const dataUrl = await rotate(pg.dataUrl);
    const next = { ...pg, dataUrl, status: 'pending' as const };
    setPages((ps) => ps.map((p) => (p.key === pg.key ? next : p)));
    await processPages([next]);
  };

  const upd = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, error: undefined } : r)));
  const numOrNull = (v: string) => (v === '' ? null : Number(v));

  const importAll = async (submit: boolean) => {
    setImporting(submit ? 'submit' : 'draft');
    try {
      const payload = rows.map(({ key, localityName, confidence, error, page, ...r }) => (void key, void localityName, void confidence, void error, void page, { ...r, purpose: 'RENT' }));
      const res = await post<{ created: number; errors: { index: number; error: string }[] }>('/ai/scan/import', { rows: payload, submit });
      const failed = new Set(res.errors.map((e) => e.index));
      setRows((rs) => rs.map((r, i) => ({ ...r, error: res.errors.find((e) => e.index === i)?.error })).filter((_, i) => failed.has(i)));
      setDone({ created: res.created, submitted: submit });
      toast.success(submit ? `${res.created} listings admin approval के लिए भेजी गईं` : `${res.created} draft listings बन गईं`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <PageHeader title="AI listing-book scanner" subtitle="Register / diary के एक या कई पन्नों की photo डालें — OCR + AI हर rent property को row में बदल देगा। Check करें और approval के लिए भेजें।" />
      {notConfigured?.body.integration && (
        <div className="mb-5">
          <IntegrationBanner name={notConfigured.body.integration.name} message={notConfigured.body.message} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="card relative overflow-hidden p-5">
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border-2 border-dashed border-line bg-surface-2">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Scanned page" className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center">
                  <div>
                    <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-lg shadow-brand-600/30">
                      <ScanLine className="size-8" />
                    </div>
                    <p className="mt-4 font-semibold">पन्नों की photos डालें</p>
                    <p className="mt-1 text-sm text-muted">एक साथ 20 पन्ने तक। अच्छी रोशनी, page सीधा और पूरा frame में। Hindi / English handwriting दोनों चलती है।</p>
                  </div>
                </div>
              )}
              <AnimatePresence>
                {scanning && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-brand-950/40">
                    <motion.div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-brand-400/60 to-transparent" animate={{ top: ['-20%', '100%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} />
                    <div className="absolute inset-x-0 bottom-4 text-center">
                      <Badge tone="dark"><Sparkles className="size-3.5" /> AI पढ़ रहा है…</Badge>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Input className="mt-4" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Hint (optional): जैसे 'सब rent की हैं, Sector 57'" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => camRef.current?.click()} loading={scanning}>
                <Camera className="size-4" /> Camera
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={scanning}>
                <Upload className="size-4" /> Upload
              </Button>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
            {pages.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {pages.map((pg, i) => (
                  <div key={pg.key} className="shrink-0 text-center">
                    <button type="button" onClick={() => setActive(pg.key)} className={cn('relative block h-24 w-[72px] overflow-hidden rounded-xl border-2', pg.status === 'error' ? 'border-rose-500' : pg.status === 'done' ? 'border-emerald-500' : 'border-line', active === pg.key && 'ring-2 ring-brand-500')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pg.dataUrl} alt={`Page ${i + 1}`} className="h-full w-full object-cover" />
                      {pg.status === 'scanning' && <span className="absolute inset-0 grid place-items-center bg-brand-950/40"><Sparkles className="size-5 animate-pulse text-white" /></span>}
                    </button>
                    <p className={cn('mt-1 text-[11px]', pg.status === 'error' ? 'font-semibold text-rose-600' : 'text-muted')}>{pg.status === 'done' ? `P${i + 1} · ${pg.rows}` : pg.status === 'error' ? 'Error' : `P${i + 1}`}</p>
                    <div className="flex justify-center gap-1">
                      <button type="button" title="Rotate & rescan" disabled={scanning} onClick={() => rotateAndRescan(pg)} className="text-subtle hover:text-brand-600 disabled:opacity-40"><RotateCw className="size-3.5" /></button>
                      {pg.rawText && <button type="button" title="मूल text (OCR)" onClick={() => setRawOpen(pg.key)} className="text-subtle hover:text-brand-600"><FileText className="size-3.5" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-5 text-sm text-muted">
            <p className="mb-2 font-semibold text-fg">कैसे काम करता है</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>हर पन्ना OCR + AI (Groq / Gemini vision) से पढ़ा जाता है — मूल text भी देख सकते हैं</li>
              <li>Sector, society, BHK, rent, deposit, brokerage, owner contact निकाले जाते हैं</li>
              <li>आप check / edit करते हैं</li>
              <li><b>Approval के लिए भेजें</b> — admin approve करते ही live, या <b>Drafts</b> में रखकर photos जोड़ें</li>
            </ol>
          </div>
        </div>

        <div className="min-w-0">
          {done && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="size-5" />
              <p className="flex-1 font-semibold">{done.created} listings {done.submitted ? 'admin approval के लिए भेजी गईं' : 'drafts में जुड़ गईं'}{rows.length ? ` · ${rows.length} rows में सुधार चाहिए` : ''}</p>
              <Button size="sm" variant="success" href="/broker/listings">Inventory देखें</Button>
            </motion.div>
          )}
          {!rows.length ? (
            <div className="card grid min-h-[420px] place-items-center p-8 text-center">
              <div>
                <FileImage className="mx-auto size-10 text-subtle" />
                <p className="mt-3 font-semibold">Scan की गई rows यहाँ दिखेंगी</p>
                <p className="mt-1 text-sm text-muted">या बिना photo के manually rows जोड़ें।</p>
                <Button className="mt-4" variant="secondary" size="sm" onClick={() => setRows([blank()])}><Plus className="size-4" /> Manual row</Button>
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
                <p className="font-display font-bold">{rows.length} {rows.length === 1 ? 'row' : 'rows'}</p>
                <p className="text-xs text-muted">Locality और price हर row में ज़रूरी हैं</p>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => (setRows([]), setPages([]))}><RotateCcw className="size-4" /> Reset</Button>
                  <Button size="sm" variant="secondary" onClick={() => setRows((r) => [...r, blank()])}><Plus className="size-4" /> Row</Button>
                  <Button size="sm" variant="secondary" loading={importing === 'draft'} disabled={!!importing} onClick={() => importAll(false)}>Drafts में डालें</Button>
                  <Button size="sm" loading={importing === 'submit'} disabled={!!importing} onClick={() => importAll(true)}>{rows.length} approval के लिए भेजें</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] text-sm">
                  <thead className="bg-surface-2/60 text-left text-[11px] font-bold tracking-wide text-subtle uppercase">
                    <tr>
                      {['', 'Type', 'Locality *', 'Society', 'Unit', 'BHK', 'Floor', 'Area sqft', 'Rent ₹/mo *', 'Deposit ₹', 'Brokerage', 'Furnishing', 'Owner', 'Phone', ''].map((h, i) => (
                        <th key={i} className="px-2 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {rows.map((r) => {
                        const c = 'h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm focus:border-brand-500 focus:outline-none';
                        return (
                          <motion.tr key={r.key} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className={cn('border-t border-line align-top', r.error && 'bg-rose-50/60 dark:bg-rose-500/5')}>
                            <td className="px-2 py-2">
                              {r.confidence != null && <span title="AI confidence" className={cn('inline-block size-2.5 rounded-full', r.confidence > 0.75 ? 'bg-emerald-500' : r.confidence > 0.5 ? 'bg-amber-500' : 'bg-rose-500')} />}
                            </td>
                            <td className="px-1 py-2">
                              <select className={cn(c, 'w-32')} value={r.propertyType} onChange={(e) => upd(r.key, { propertyType: e.target.value })}>
                                {RENTABLE_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>)}
                              </select>
                            </td>
                            <td className="px-1 py-2">
                              <select className={cn(c, 'w-40', !r.localityId && 'border-amber-400')} value={r.localityId ?? ''} onChange={(e) => upd(r.key, { localityId: e.target.value || null })}>
                                <option value="">{r.localityName ? `? ${r.localityName}` : 'चुनें'}</option>
                                {locs?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                              </select>
                              {r.error && <p className="mt-1 text-[11px] font-semibold text-rose-600">{r.error}</p>}
                            </td>
                            <td className="px-1 py-2"><input className={cn(c, 'w-36')} value={r.societyName ?? ''} onChange={(e) => upd(r.key, { societyName: e.target.value || null })} /></td>
                            <td className="px-1 py-2"><input className={cn(c, 'w-20')} value={r.unit ?? ''} onChange={(e) => upd(r.key, { unit: e.target.value || null })} /></td>
                            <td className="px-1 py-2"><input className={cn(c, 'w-14')} type="number" value={r.bedrooms ?? ''} onChange={(e) => upd(r.key, { bedrooms: numOrNull(e.target.value) })} /></td>
                            <td className="px-1 py-2"><input className={cn(c, 'w-14')} type="number" value={r.floor ?? ''} onChange={(e) => upd(r.key, { floor: numOrNull(e.target.value) })} /></td>
                            <td className="px-1 py-2"><input className={cn(c, 'w-24')} type="number" value={r.area ?? ''} onChange={(e) => upd(r.key, { area: numOrNull(e.target.value) })} /></td>
                            <td className="px-1 py-2">
                              <input className={cn(c, 'w-28', !r.price && 'border-amber-400')} type="number" value={r.price ?? ''} onChange={(e) => upd(r.key, { price: numOrNull(e.target.value) })} />
                              {r.price ? <p className="mt-0.5 text-[11px] text-muted">{formatPriceShort(r.price)}</p> : null}
                            </td>
                            <td className="px-1 py-2"><input className={cn(c, 'w-28')} type="number" value={r.securityDeposit ?? ''} onChange={(e) => upd(r.key, { securityDeposit: numOrNull(e.target.value) })} /></td>
                            <td className="px-1 py-2">
                              <select className={cn(c, 'w-32')} value={r.brokerageType ?? ''} onChange={(e) => upd(r.key, { brokerageType: e.target.value || null })}>
                                <option value="">—</option>
                                {Object.entries(BROKERAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                              {r.brokerageType === 'FIXED' && <input className={cn(c, 'mt-1 w-32')} type="number" placeholder="₹" value={r.brokerageAmount ?? ''} onChange={(e) => upd(r.key, { brokerageAmount: numOrNull(e.target.value) })} />}
                            </td>
                            <td className="px-1 py-2">
                              <select className={cn(c, 'w-28')} value={r.furnishing ?? ''} onChange={(e) => upd(r.key, { furnishing: e.target.value || null })}>
                                <option value="">—</option>
                                {Object.entries(FURNISHING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </td>
                            <td className="px-1 py-2"><input className={cn(c, 'w-28')} value={r.contactName ?? ''} onChange={(e) => upd(r.key, { contactName: e.target.value || null })} /></td>
                            <td className="px-1 py-2"><input className={cn(c, 'w-32')} value={r.contactPhone ?? ''} onChange={(e) => upd(r.key, { contactPhone: e.target.value || null })} /></td>
                            <td className="px-1 py-2">
                              <button onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="grid size-9 place-items-center rounded-lg text-subtle hover:bg-rose-50 hover:text-rose-600" aria-label="Remove row">
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-subtle">
            AI credits आपके plan में शामिल हैं — <Link href="/broker/billing" className="font-semibold text-brand-600">usage देखें</Link>
          </p>
        </div>
      </div>
      <Dialog open={!!rawOpen} onOpenChange={(o) => !o && setRawOpen(null)} title="मूल text (OCR)" description="Rows को इस text से मिलाकर check करें">
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-surface-2 p-4 font-sans text-sm whitespace-pre-wrap">{pages.find((p) => p.key === rawOpen)?.rawText || '—'}</pre>
      </Dialog>
    </>
  );
}
