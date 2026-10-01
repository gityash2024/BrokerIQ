'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Building2, Camera, Clock, ExternalLink, Globe, ImagePlus, ShieldCheck, UserCog } from 'lucide-react';
import { api, compressImage, errorMessage, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { patch, useApiMutation } from '@/lib/hooks';
import { cn, img, SITE_URL } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { KycCard, ProfileForm } from '@/components/panel/profile-form';
import { CopyField } from '@/components/panel/integration-card';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Chip, Field, Input, Textarea } from '@/components/ui/field';
import { Avatar, Badge, PageLoader, Switch } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { BrandingSettings, VisitingCardPanel } from '@/components/broker/growth-tools';
import { useFlag, useFreeMode } from '@/lib/config';
import type { LocalityListItem } from '@brokeriq/shared';

const DAYS = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

export default function SettingsPage() {
  const [tab, setTab] = useState<'firm' | 'hours' | 'branding' | 'card' | 'verify' | 'me'>('firm');
  const { user } = useAuth();
  const cardOn = useFlag('visiting_card');
  const q = useQuery({ queryKey: ['broker-profile'], queryFn: () => api<any>('/broker/profile') });
  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  const org = q.data;
  const microsite = `${typeof window !== 'undefined' ? window.location.origin : SITE_URL}/brokers/${org.slug}`;
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Firm profile, microsite, business hours और verification"
        actions={
          <Button size="sm" variant="secondary" href={`/brokers/${org.slug}`} external>
            Microsite देखें <ExternalLink className="size-3.5" />
          </Button>
        }
      />
      <Segmented
        className="mb-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'firm', label: 'Firm profile' },
          { value: 'hours', label: 'Business hours' },
          { value: 'branding', label: 'Photos & social' },
          ...(cardOn ? [{ value: 'card' as const, label: 'Visiting card' }] : []),
          { value: 'verify', label: 'Verification' },
          { value: 'me', label: 'मेरा account' },
        ]}
      />
      {tab === 'firm' && <FirmForm org={org} microsite={microsite} onSaved={() => q.refetch()} />}
      {tab === 'hours' && <Hours org={org} />}
      {tab === 'branding' && <BrandingSettings isAdmin={user?.role === 'BROKER_ADMIN'} />}
      {tab === 'card' && <VisitingCardPanel slug={org.slug} />}
      {tab === 'verify' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'grid size-12 place-items-center rounded-2xl',
                  org.verification === 'VERIFIED' ? 'bg-emerald-600 text-white' : 'bg-surface-2 text-muted',
                )}
              >
                <BadgeCheck className="size-6" />
              </span>
              <div>
                <p className="font-display text-lg font-bold">Verified broker badge</p>
                <Badge tone={org.verification === 'VERIFIED' ? 'success' : org.verification === 'PENDING' ? 'warning' : 'neutral'}>{org.verification}</Badge>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-muted">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 text-emerald-500" /> Search और microsite पर ✔ Verified badge
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 text-emerald-500" /> Brokers directory में ऊपर ranking
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 text-emerald-500" /> Buyers का ज़्यादा भरोसा = ज़्यादा enquiries
              </li>
            </ul>
            <p className="mt-4 text-xs text-subtle">HRERA agent certificate (और GST, अगर है) upload करें — admin 24–48 घंटे में verify करेगा।</p>
          </div>
          <KycCard broker />
        </div>
      )}
      {tab === 'me' && <ProfileForm />}
    </>
  );
}

function FirmForm({ org, microsite, onSaved }: { org: any; microsite: string; onSaved: () => void }) {
  const { setSession } = useAuth();
  const freeMode = useFreeMode();
  const { data: locs } = useQuery({
    queryKey: ['localities-all'],
    queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }),
    staleTime: 600_000,
  });
  const [f, setF] = useState<any>(null);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setF({
      firmName: org.name ?? '',
      phone: org.phone ?? '',
      whatsapp: org.whatsapp ?? '',
      reraNumber: org.reraNumber ?? '',
      gstNumber: org.gstNumber ?? '',
      about: org.about ?? '',
      address: org.address ?? '',
      website: org.website ?? '',
      experienceYears: org.experienceYears ?? '',
      logoUrl: org.logoUrl ?? '',
      coverUrl: org.coverUrl ?? '',
      localityIds: (org.localities ?? []).map((l: any) => l.id),
    });
  }, [org]);
  if (!f) return null;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const upload = async (file: File | undefined, key: 'logoUrl' | 'coverUrl') => {
    if (!file) return;
    try {
      const { url } = await uploadFile(await compressImage(file, key === 'logoUrl' ? 600 : 1800), key === 'logoUrl' ? 'logo' : 'cover');
      setF((x: any) => ({ ...x, [key]: url }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const save = async () => {
    setSaving(true);
    try {
      const r = await api<any>('/broker/onboarding', {
        method: 'POST',
        body: {
          ...f,
          experienceYears: f.experienceYears === '' ? null : Number(f.experienceYears),
          logoUrl: f.logoUrl || null,
          coverUrl: f.coverUrl || null,
          whatsapp: f.whatsapp || null,
          reraNumber: f.reraNumber || null,
          gstNumber: f.gstNumber || null,
        },
      });
      setSession(r);
      toast.success('Firm profile saved');
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const toggle = (id: string) =>
    setF((x: any) => ({ ...x, localityIds: x.localityIds.includes(id) ? x.localityIds.filter((y: string) => y !== id) : [...x.localityIds, id].slice(0, 30) }));
  return (
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <div className="card overflow-hidden">
        <label className="group relative block h-40 cursor-pointer bg-gradient-to-br from-brand-600 to-violet-600">
          {f.coverUrl && <img src={img(f.coverUrl, 1200)} alt="" className="h-full w-full object-cover" />}
          <span className="absolute inset-0 grid place-items-center bg-black/30 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">
            <span className="flex items-center gap-2">
              <ImagePlus className="size-5" /> Cover photo बदलें
            </span>
          </span>
          <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], 'coverUrl')} />
        </label>
        <div className="p-6 pt-0">
          <label className="group relative -mt-10 inline-block cursor-pointer rounded-full ring-4 ring-surface">
            <Avatar name={f.firmName} src={f.logoUrl} size={84} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
              <Camera className="size-5" />
            </span>
            <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], 'logoUrl')} />
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Firm name" required>
              <Input value={f.firmName} onChange={set('firmName')} />
            </Field>
            <Field label="Business phone" required>
              <Input value={f.phone} onChange={set('phone')} />
            </Field>
            <Field label="WhatsApp">
              <Input value={f.whatsapp} onChange={set('whatsapp')} />
            </Field>
            <Field label="Experience (years)">
              <Input inputMode="numeric" value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="HRERA agent no.">
              <Input value={f.reraNumber} onChange={set('reraNumber')} />
            </Field>
            <Field label="GSTIN">
              <Input value={f.gstNumber} onChange={set('gstNumber')} />
            </Field>
            <Field label="Website" className="sm:col-span-2">
              <Input icon={<Globe className="size-4" />} value={f.website} onChange={set('website')} placeholder="https://" />
            </Field>
            <Field label="Office address" className="sm:col-span-2">
              <Input value={f.address} onChange={set('address')} />
            </Field>
            <Field label="About" className="sm:col-span-2">
              <Textarea rows={4} value={f.about} onChange={set('about')} />
            </Field>
          </div>
          <p className="mt-6 text-sm font-semibold">Expertise localities ({f.localityIds.length}/30)</p>
          <Input className="mt-2" placeholder="Sector खोजें…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
            {(locs ?? [])
              .filter((l) => f.localityIds.includes(l.id) || !q || l.name.toLowerCase().includes(q.toLowerCase()))
              .slice(0, 80)
              .map((l) => (
                <Chip key={l.id} active={f.localityIds.includes(l.id)} onClick={() => toggle(l.id)}>
                  {l.name}
                </Chip>
              ))}
          </div>
          <Button className="mt-6" onClick={save} loading={saving} disabled={!f.firmName || !f.phone}>
            <Building2 className="size-4" /> Save profile
          </Button>
        </div>
      </div>
      <div className="space-y-5">
        <div className="card space-y-3 p-5">
          <p className="font-display font-bold">आपकी microsite</p>
          <p className="text-sm text-muted">
            Listings, reviews और WhatsApp button के साथ आपकी अपनी website। इसे Instagram bio, visiting card और WhatsApp status पर लगाएँ — इससे आने वाली हर
            enquiry सीधे आपके CRM में आएगी।
          </p>
          <CopyField label="Microsite link" value={microsite} />
          <Button size="sm" variant="whatsapp" external href={`https://wa.me/?text=${encodeURIComponent(`हमारी सारी properties यहाँ देखें: ${microsite}`)}`}>
            WhatsApp पर share करें
          </Button>
        </div>
        {!freeMode && (
          <div className="card p-5 text-sm">
            <p className="font-display font-bold">Plan usage</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs text-muted">Agents</p>
                <p className="font-bold">
                  {org.usage.agents} / {org.plan.limits.agents}
                </p>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs text-muted">Active listings</p>
                <p className="font-bold">
                  {org.usage.activeListings} / {org.plan.limits.activeListings}
                </p>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs text-muted">AI credits</p>
                <p className="font-bold">
                  {org.usage.aiThisMonth} / {org.plan.limits.aiCredits}
                </p>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs text-muted">Plan</p>
                <p className="font-bold">{org.plan.plan}</p>
              </div>
            </div>
            <Button size="sm" variant="link" href="/broker/billing" className="mt-3">
              Upgrade →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Hours({ org }: { org: any }) {
  const bh = org.businessHours ?? { enabled: true, start: '09:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] };
  const [h, setH] = useState(bh);
  const save = useApiMutation(() => patch('/broker/business-hours', h), { success: 'Business hours saved', invalidate: [['broker-profile']] });
  return (
    <div className="card max-w-2xl p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <Clock className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-display font-bold">Business hours (IST)</p>
          <p className="text-sm text-muted">
            &ldquo;Business hours में भेजें&rdquo; वाली automations रात में message नहीं भेजेंगी — अगले working समय पर भेजेंगी।
          </p>
        </div>
        <Switch checked={h.enabled} onCheckedChange={(v) => setH({ ...h, enabled: v })} />
      </div>
      <div className={cn('mt-6 space-y-5', !h.enabled && 'pointer-events-none opacity-50')}>
        <div>
          <p className="mb-2 text-sm font-semibold">Working days</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <Chip
                key={i}
                active={h.days.includes(i)}
                onClick={() => setH({ ...h, days: h.days.includes(i) ? h.days.filter((x: number) => x !== i) : [...h.days, i].sort() })}
              >
                {d}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start">
            <Input type="time" value={h.start} onChange={(e) => setH({ ...h, start: e.target.value })} />
          </Field>
          <Field label="End">
            <Input type="time" value={h.end} onChange={(e) => setH({ ...h, end: e.target.value })} />
          </Field>
        </div>
      </div>
      <Button className="mt-6" onClick={() => save.mutate(undefined)} loading={save.isPending}>
        <UserCog className="size-4" /> Save
      </Button>
    </div>
  );
}
