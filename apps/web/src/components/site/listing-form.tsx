'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Building2, Check, Home, Landmark, MapPin, Sparkles, Store, Wand2 } from 'lucide-react';
import { FACING_LABELS, FURNISHING_LABELS, PROPERTY_TYPE_CATEGORY, PROPERTY_TYPE_LABELS, formatPriceShort, pricePerSqft, formatINR } from '@brokeriq/shared';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useFlag } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Chip, Field, Input, Select, Textarea } from '../ui/field';
import { Switch } from '../ui/misc';
import { IntegrationBanner } from '../ui/api-error';
import { PhotoUploader, type Photo } from './photo-uploader';
import { Map } from './map';

type Cat = 'RESIDENTIAL' | 'COMMERCIAL' | 'PLOT';
const STEPS = ['Basics', 'Location', 'Details', 'Price & photos', 'Review'];

export interface ListingFormValue {
  purpose: 'SALE' | 'RENT';
  propertyType: string;
  localityId: string;
  societyName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price?: number | null;
  maintenance?: number | null;
  securityDeposit?: number | null;
  priceNegotiable?: boolean;
  bedrooms?: number | null;
  bathrooms?: number | null;
  balconies?: number | null;
  carpetArea?: number | null;
  superArea?: number | null;
  plotArea?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  furnishing?: string | null;
  possession?: string | null;
  ageYears?: number | null;
  facing?: string | null;
  parking?: number | null;
  availableFrom?: string | null;
  preferredTenants?: string[];
  amenities: string[];
  reraNumber?: string | null;
  title?: string | null;
  description?: string | null;
  photos: Photo[];
  videoUrl?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
}

const EMPTY: ListingFormValue = { purpose: 'SALE', propertyType: 'APARTMENT', localityId: '', amenities: [], photos: [], priceNegotiable: false, preferredTenants: [] };

export function ListingForm({ initial, listingId, afterSave, role = 'owner' }: { initial?: Partial<ListingFormValue>; listingId?: string; afterSave: (l: any) => void; role?: 'owner' | 'broker' }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [v, setV] = useState<ListingFormValue>({ ...EMPTY, ...initial } as ListingFormValue);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<ApiError | null>(null);
  const aiOn = useFlag('ai_assist');
  const set = (patch: Partial<ListingFormValue>) => setV((p) => ({ ...p, ...patch }));
  const cat: Cat = (PROPERTY_TYPE_CATEGORY as any)[v.propertyType] ?? 'RESIDENTIAL';

  const { data: tax } = useQuery({ queryKey: ['taxonomies'], queryFn: () => api<any>('/public/taxonomies', { auth: false }), staleTime: 600_000 });
  const { data: locs } = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const [locQ, setLocQ] = useState('');
  const loc = locs?.find((l) => l.id === v.localityId);
  const area = v.superArea ?? v.carpetArea ?? v.plotArea;
  const psf = pricePerSqft(v.price ?? null, area ?? null);

  const validate = (s: number): string | null => {
    if (s === 0 && !v.propertyType) return 'Property type चुनें';
    if (s === 1 && !v.localityId) return 'Locality / sector चुनें';
    if (s === 2 && cat === 'RESIDENTIAL' && v.propertyType !== 'PG' && !v.bedrooms) return 'BHK चुनें';
    if (s === 2 && !area) return 'Area डालें';
    if (s === 3 && !v.price) return 'Price डालें';
    return null;
  };
  const go = (d: number) => {
    if (d > 0) {
      const err = validate(step);
      if (err) return toast.error(err);
    }
    setDir(d);
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + d)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const payload = (submit: boolean) => {
    const num = (x: any) => (x === '' || x == null || Number.isNaN(Number(x)) ? null : Number(x));
    return {
      ...v,
      price: Number(v.price),
      maintenance: num(v.maintenance),
      securityDeposit: num(v.securityDeposit),
      bedrooms: num(v.bedrooms),
      bathrooms: num(v.bathrooms),
      balconies: num(v.balconies),
      carpetArea: num(v.carpetArea),
      superArea: num(v.superArea),
      plotArea: num(v.plotArea),
      floor: num(v.floor),
      totalFloors: num(v.totalFloors),
      ageYears: num(v.ageYears),
      parking: num(v.parking),
      title: v.title?.trim() || undefined,
      videoUrl: v.videoUrl || null,
      availableFrom: v.availableFrom ? new Date(v.availableFrom).toISOString() : null,
      contactPhone: v.contactPhone || null,
      submit,
    };
  };

  const save = async (submit: boolean) => {
    for (let s = 0; s < 4; s++) {
      const err = validate(s);
      if (err) {
        setStep(s);
        return toast.error(err);
      }
    }
    setSaving(true);
    try {
      const l = listingId ? await api<any>(`/listings/${listingId}`, { method: 'PATCH', body: payload(submit) }) : await api<any>('/listings', { method: 'POST', body: payload(submit) });
      if (l?.status === 'PENDING_REVIEW') toast.success('Review के लिए भेज दी गई — admin approval के बाद live होगी ✅');
      afterSave(l);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const aiWrite = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await api<{ description: string }>('/listings/ai/description', { method: 'POST', body: { ...payload(false), tone: 'professional', language: 'en' } });
      set({ description: r.description });
      toast.success('AI ने description लिख दी ✨ — ज़रूरत हो तो edit करें');
    } catch (e) {
      if (e instanceof ApiError && e.isNotConfigured) setAiError(e);
      else toast.error(errorMessage(e));
    } finally {
      setAiLoading(false);
    }
  };

  const types = useMemo(() => (tax?.propertyTypes ?? []).filter((t: any) => t.category === cat), [tax, cat]);
  const amenities = (tax?.amenities ?? []).filter((a: any) => (cat === 'COMMERCIAL' ? a.category !== 'flat' : a.category !== 'commercial'));

  return (
    <div className="mx-auto max-w-3xl">
      {/* stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => (i < step ? (setDir(-1), setStep(i)) : undefined)} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={cn('grid size-9 place-items-center rounded-full text-sm font-bold transition', i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-600 text-white ring-4 ring-brand-500/20' : 'bg-surface-2 text-subtle')}>{i < step ? <Check className="size-4" /> : i + 1}</span>
              <span className={cn('hidden text-xs font-semibold sm:block', i === step ? 'text-fg' : 'text-subtle')}>{s}</span>
            </button>
          ))}
        </div>
        <div className="relative mt-3 h-1.5 rounded-full bg-surface-2">
          <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-500 to-brand-700" animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -dir * 40 }} transition={{ duration: 0.25 }} className="card space-y-6 p-6 sm:p-8">
          {step === 0 && (
            <>
              <h2 className="font-display text-2xl font-bold">आप क्या करना चाहते हैं?</h2>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['SALE', 'Sell', 'Property बेचनी है'],
                    ['RENT', cat === 'COMMERCIAL' ? 'Lease' : 'Rent out', 'किराये पर देनी है'],
                  ] as const
                ).map(([p, t, d]) => (
                  <button type="button" key={p} onClick={() => set({ purpose: p })} className={cn('rounded-2xl border-2 p-4 text-left transition', v.purpose === p ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-500/10' : 'border-line hover:border-brand-300')}>
                    <p className="font-display text-lg font-bold">{t}</p>
                    <p className="text-sm text-muted">{d}</p>
                  </button>
                ))}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Category</p>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ['RESIDENTIAL', Home, 'Residential', 'APARTMENT'],
                      ['COMMERCIAL', Store, 'Commercial', 'OFFICE'],
                      ['PLOT', Landmark, 'Plot / Land', 'RESIDENTIAL_PLOT'],
                    ] as const
                  ).map(([c, Icon, label, def]) => (
                    <button type="button" key={c} onClick={() => set({ propertyType: def })} className={cn('flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition', cat === c ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-500/10' : 'border-line hover:border-brand-300')}>
                      <Icon className="size-7 text-brand-600" />
                      <span className="text-sm font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Property type</p>
                <div className="flex flex-wrap gap-2">
                  {types.map((t: any) => (
                    <Chip key={t.value} active={v.propertyType === t.value} onClick={() => set({ propertyType: t.value })}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-display text-2xl font-bold">Property कहाँ है?</h2>
              <Field label="Sector / Locality" required>
                <Input icon={<MapPin className="size-4" />} placeholder="Sector 65, Golf Course Road…" value={loc && !locQ ? loc.name : locQ} onChange={(e) => setLocQ(e.target.value)} onFocus={() => setLocQ('')} />
              </Field>
              {(locQ || !loc) && (
                <div className="max-h-60 overflow-y-auto rounded-xl border border-line">
                  {(locs ?? [])
                    .filter((l) => !locQ || l.name.toLowerCase().includes(locQ.toLowerCase()) || l.zone?.toLowerCase().includes(locQ.toLowerCase()))
                    .slice(0, 40)
                    .map((l) => (
                      <button type="button" key={l.id} onClick={() => (set({ localityId: l.id, latitude: l.latitude, longitude: l.longitude }), setLocQ(''))} className={cn('flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-surface-2', l.id === v.localityId && 'bg-brand-50 dark:bg-brand-500/10')}>
                        <span>
                          <span className="font-medium">{l.name}</span> <span className="text-xs text-subtle">· {l.zone}</span>
                        </span>
                        {l.id === v.localityId && <Check className="size-4 text-brand-600" />}
                      </button>
                    ))}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={cat === 'COMMERCIAL' ? 'Building / project' : 'Society / project'}>
                  <Input value={v.societyName ?? ''} onChange={(e) => set({ societyName: e.target.value })} placeholder="e.g. M3M Golf Estate" />
                </Field>
                <Field label="Address / landmark">
                  <Input value={v.address ?? ''} onChange={(e) => set({ address: e.target.value })} placeholder="Tower, near …" />
                </Field>
              </div>
              {loc && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Exact location (map पर click करके pin लगाएँ)</p>
                  <div className="h-72 overflow-hidden rounded-2xl border border-line">
                    <Map
                      points={v.latitude && v.longitude ? [{ id: 'pin', lat: v.latitude, lng: v.longitude, label: '📍 Property' }] : []}
                      center={[v.latitude ?? loc.latitude, v.longitude ?? loc.longitude]}
                      zoom={15}
                      fit={false}
                      recenter
                      onPick={(lat, lng) => set({ latitude: lat, longitude: lng })}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-display text-2xl font-bold">Property details</h2>
              {cat === 'RESIDENTIAL' && v.propertyType !== 'PG' && (
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    BHK <span className="text-rose-500">*</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6].map((b) => (
                      <Chip key={b} active={v.bedrooms === b} onClick={() => set({ bedrooms: b })}>
                        {b === 6 ? '6+' : b} BHK
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {cat !== 'PLOT' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumField label="Bathrooms" value={v.bathrooms} onChange={(x) => set({ bathrooms: x })} />
                  {cat === 'RESIDENTIAL' && <NumField label="Balconies" value={v.balconies} onChange={(x) => set({ balconies: x })} />}
                  <NumField label="Parking" value={v.parking} onChange={(x) => set({ parking: x })} />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {cat === 'PLOT' ? (
                  <NumField label="Plot area (sq.ft)" required value={v.plotArea} onChange={(x) => set({ plotArea: x })} />
                ) : (
                  <>
                    <NumField label="Super / built-up area (sq.ft)" required value={v.superArea} onChange={(x) => set({ superArea: x })} />
                    <NumField label="Carpet area (sq.ft)" value={v.carpetArea} onChange={(x) => set({ carpetArea: x })} />
                  </>
                )}
              </div>
              {cat !== 'PLOT' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumField label="Floor" value={v.floor} onChange={(x) => set({ floor: x })} />
                    <NumField label="Total floors" value={v.totalFloors} onChange={(x) => set({ totalFloors: x })} />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Furnishing</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(FURNISHING_LABELS).map(([k, l]) => (
                        <Chip key={k} active={v.furnishing === k} onClick={() => set({ furnishing: k })}>
                          {l}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {v.purpose === 'SALE' ? (
                  <Field label="Possession">
                    <Select value={v.possession ?? ''} onChange={(e) => set({ possession: e.target.value || null })}>
                      <option value="">Select</option>
                      <option value="READY_TO_MOVE">Ready to move</option>
                      <option value="UNDER_CONSTRUCTION">Under construction</option>
                    </Select>
                  </Field>
                ) : (
                  <Field label="Available from">
                    <Input type="date" value={v.availableFrom?.slice(0, 10) ?? ''} onChange={(e) => set({ availableFrom: e.target.value })} />
                  </Field>
                )}
                <Field label="Facing">
                  <Select value={v.facing ?? ''} onChange={(e) => set({ facing: e.target.value || null })}>
                    <option value="">Select</option>
                    {Object.entries(FACING_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                <NumField label="Property age (years)" value={v.ageYears} onChange={(x) => set({ ageYears: x })} />
                <Field label="RERA number">
                  <Input value={v.reraNumber ?? ''} onChange={(e) => set({ reraNumber: e.target.value })} placeholder="optional" />
                </Field>
              </div>
              {v.purpose === 'RENT' && cat === 'RESIDENTIAL' && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Preferred tenants</p>
                  <div className="flex flex-wrap gap-2">
                    {['Family', 'Bachelors', 'Company lease', 'Any'].map((t) => (
                      <Chip key={t} active={v.preferredTenants?.includes(t)} onClick={() => set({ preferredTenants: v.preferredTenants?.includes(t) ? v.preferredTenants.filter((x) => x !== t) : [...(v.preferredTenants ?? []), t] })}>
                        {t}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-sm font-semibold">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((a: any) => (
                    <Chip key={a.key} active={v.amenities.includes(a.key)} onClick={() => set({ amenities: v.amenities.includes(a.key) ? v.amenities.filter((x) => x !== a.key) : [...v.amenities, a.key] })}>
                      {a.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-display text-2xl font-bold">Price और photos</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={v.purpose === 'RENT' ? 'Monthly rent (₹)' : 'Expected price (₹)'} required hint={v.price ? `${formatPriceShort(Number(v.price))}${psf && v.purpose === 'SALE' ? ` · ${formatINR(psf)}/sq.ft` : ''}` : undefined}>
                  <Input inputMode="numeric" value={v.price ?? ''} onChange={(e) => set({ price: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} placeholder={v.purpose === 'RENT' ? '45000' : '15000000'} />
                </Field>
                <NumField label="Maintenance (₹/month)" value={v.maintenance} onChange={(x) => set({ maintenance: x })} />
                {v.purpose === 'RENT' && <NumField label="Security deposit (₹)" value={v.securityDeposit} onChange={(x) => set({ securityDeposit: x })} />}
                <label className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                  <Switch checked={!!v.priceNegotiable} onCheckedChange={(x) => set({ priceNegotiable: x })} />
                  <span className="text-sm font-medium">Price negotiable</span>
                </label>
              </div>
              <PhotoUploader value={v.photos} onChange={(photos) => set({ photos })} />
              <Field label="Video tour link (YouTube / Drive)">
                <Input value={v.videoUrl ?? ''} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="https://" />
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="font-display text-2xl font-bold">Review और description</h2>
              <Field label="Title" hint="खाली छोड़ें तो अपने-आप बनेगा">
                <Input value={v.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={`${v.bedrooms ? `${v.bedrooms} BHK ` : ''}${(PROPERTY_TYPE_LABELS as any)[v.propertyType]} for ${v.purpose === 'SALE' ? 'Sale' : 'Rent'} in ${loc?.name ?? ''}`} />
              </Field>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-semibold">Description</span>
                  {aiOn && (
                    <Button type="button" size="xs" variant="secondary" onClick={aiWrite} loading={aiLoading}>
                      <Wand2 className="size-3.5" /> AI से लिखवाएँ
                    </Button>
                  )}
                </div>
                {aiError?.body.integration && <div className="mb-2"><IntegrationBanner compact name={aiError.body.integration.name} message={aiError.body.message} /></div>}
                <Textarea rows={7} value={v.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Property की खास बातें — view, ventilation, nearby school/metro, society facilities…" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact name" hint={role === 'broker' ? 'खाली = firm का नाम' : undefined}>
                  <Input value={v.contactName ?? ''} onChange={(e) => set({ contactName: e.target.value })} />
                </Field>
                <Field label="Contact phone" hint="Buyers को login के बाद दिखेगा">
                  <Input inputMode="tel" value={v.contactPhone ?? ''} onChange={(e) => set({ contactPhone: e.target.value })} />
                </Field>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-saffron-50 p-5 dark:from-brand-500/10 dark:to-saffron-500/5">
                <p className="flex items-center gap-2 font-semibold">
                  <Sparkles className="size-4 text-saffron-500" /> Summary
                </p>
                <p className="mt-1 text-sm text-muted">
                  {(PROPERTY_TYPE_LABELS as any)[v.propertyType]} · {v.purpose === 'SALE' ? 'Sale' : 'Rent'} · {loc?.name} · {v.price ? formatPriceShort(Number(v.price)) : '—'} · {v.photos.length} photos
                </p>
                {v.photos.length < 3 && <p className="mt-2 text-xs font-semibold text-amber-600">💡 3+ photos वाली listings को 5x ज़्यादा enquiries मिलती हैं</p>}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <Button variant="secondary" onClick={() => save(false)} loading={saving}>
                Save draft
              </Button>
              <Button variant="accent" onClick={() => save(true)} loading={saving}>
                <Building2 className="size-4" /> {listingId ? 'Save & submit' : 'Post property'}
              </Button>
            </>
          ) : (
            <Button onClick={() => go(1)}>
              Next <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, required }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void; required?: boolean }) {
  return (
    <Field label={label} required={required}>
      <Input inputMode="numeric" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value.replace(/[^\d.-]/g, '')))} />
    </Field>
  );
}

/** Map an API listing to form values (for edit). */
export function listingToForm(l: any): Partial<ListingFormValue> {
  const keys: (keyof ListingFormValue)[] = ['purpose', 'propertyType', 'localityId', 'societyName', 'address', 'latitude', 'longitude', 'price', 'maintenance', 'securityDeposit', 'priceNegotiable', 'bedrooms', 'bathrooms', 'balconies', 'carpetArea', 'superArea', 'plotArea', 'floor', 'totalFloors', 'furnishing', 'possession', 'ageYears', 'facing', 'parking', 'availableFrom', 'preferredTenants', 'amenities', 'reraNumber', 'title', 'description', 'videoUrl', 'contactName', 'contactPhone'];
  const out: any = {};
  for (const k of keys) out[k] = l[k] ?? (k === 'amenities' || k === 'preferredTenants' ? [] : null);
  out.localityId = l.localityId ?? l.locality?.id;
  out.photos = (l.media ?? []).filter((m: any) => m.kind === 'PHOTO').map((m: any) => ({ url: m.url, caption: m.caption, publicId: m.publicId }));
  return out;
}
