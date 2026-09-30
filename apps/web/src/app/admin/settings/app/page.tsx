'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Save } from 'lucide-react';
import type { AppConfig } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { FieldInput, type CrudField } from '@/components/admin/crud';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PageLoader } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

const SECTIONS: { id: string; title: string; desc: string; fields: CrudField[] }[] = [
  {
    id: 'brand',
    title: 'Brand & contact',
    desc: 'Website, app, emails और invoices पर दिखता है',
    fields: [
      { key: 'siteName', label: 'Site name', required: true },
      { key: 'tagline', label: 'Tagline' },
      { key: 'city', label: 'City' },
      { key: 'siteUrl', label: 'Website URL', placeholder: 'https://brokeriq.in' },
      { key: 'supportEmail', label: 'Support email' },
      { key: 'supportPhone', label: 'Support phone' },
      { key: 'supportWhatsApp', label: 'Support WhatsApp' },
      { key: 'officeAddress', label: 'Office address' },
      { key: 'logoUrl', label: 'Logo', type: 'image' },
      { key: 'primaryColor', label: 'Primary color', type: 'color' },
      { key: 'accentColor', label: 'Accent color', type: 'color' },
    ],
  },
  {
    id: 'social',
    title: 'Social & apps',
    desc: 'Footer links और app download buttons',
    fields: [
      { key: 'social.facebook', label: 'Facebook' },
      { key: 'social.instagram', label: 'Instagram' },
      { key: 'social.linkedin', label: 'LinkedIn' },
      { key: 'social.youtube', label: 'YouTube' },
      { key: 'social.x', label: 'X (Twitter)' },
      { key: 'playStoreUrl', label: 'Play Store URL' },
      { key: 'appStoreUrl', label: 'App Store URL' },
    ],
  },
  {
    id: 'announce',
    title: 'Announcement bar & maintenance',
    desc: 'पूरी website के ऊपर offer/notice दिखाएँ, या maintenance mode चालू करें',
    fields: [
      { key: 'announcement.enabled', label: 'Announcement on', type: 'switch' },
      {
        key: 'announcement.tone',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'info', label: 'Info' },
          { value: 'promo', label: 'Promo' },
          { value: 'warning', label: 'Warning' },
        ],
      },
      { key: 'announcement.text', label: 'Text', wide: true },
      { key: 'announcement.link', label: 'Link', wide: true },
      { key: 'maintenance.enabled', label: 'Maintenance mode', type: 'switch', hint: 'Public site और app पर maintenance message दिखेगा' },
      { key: 'maintenance.message', label: 'Maintenance message', wide: true },
    ],
  },
  {
    id: 'mobile',
    title: 'Mobile app versions',
    desc: 'Force-update: minVersion से पुराने app को update करना ज़रूरी होगा',
    fields: [
      { key: 'mobile.minVersion', label: 'Minimum version', placeholder: '1.0.0' },
      { key: 'mobile.latestVersion', label: 'Latest version', placeholder: '1.0.0' },
      { key: 'mobile.forceUpdateMessage', label: 'Update message', wide: true },
    ],
  },
  {
    id: 'listing',
    title: 'Listing rules',
    desc: 'Marketplace की policies · हर listing (user या broker) Super Admin approval के बाद ही live होती है — यह हमेशा चालू है',
    fields: [
      { key: 'listing.contactRevealRequiresLogin', label: 'Number देखने के लिए login ज़रूरी', type: 'switch' },
      { key: 'listing.expiryDays', label: 'Listing expiry (days)', type: 'number' },
      { key: 'listing.maxPhotos', label: 'Max photos', type: 'number' },
    ],
  },
  {
    id: 'auth',
    title: 'Login options',
    desc: 'कौन-से login तरीके चालू हैं',
    fields: [
      { key: 'auth.allowEmailOtp', label: 'Email OTP', type: 'switch' },
      { key: 'auth.allowPasswordLogin', label: 'Password login', type: 'switch' },
      { key: 'auth.allowGoogle', label: 'Google login', type: 'switch', hint: 'Credentials center में Google OAuth भी चाहिए' },
      {
        key: 'auth.allowBrokerSignup',
        label: 'नए broker signups (open)',
        type: 'switch',
        hint: 'OFF = नया broker सिर्फ़ invite code से जुड़ेगा (Admin → Broker invites)',
      },
    ],
  },
  {
    id: 'brokerReferrals',
    title: 'Broker referrals',
    desc: 'हर broker को अपना invite link मिलता है — उससे जुड़ने वाले broker को यह plan free मिलता है',
    fields: [
      { key: 'brokerReferrals.enabled', label: 'Broker referrals चालू', type: 'switch' },
      { key: 'brokerReferrals.planCode', label: 'Free plan code', hint: 'जैसे BUSINESS / PRO' },
      { key: 'brokerReferrals.months', label: 'कितने महीने free', type: 'number', hint: '0 = हमेशा' },
      { key: 'brokerReferrals.maxUsesPerBroker', label: 'हर broker कितने invite कर सकता है', type: 'number' },
    ],
  },
  {
    id: 'seo',
    title: 'SEO defaults',
    desc: 'Google search और social share previews',
    fields: [
      { key: 'seo.defaultTitle', label: 'Default title', wide: true },
      { key: 'seo.defaultDescription', label: 'Default description', type: 'textarea' },
      { key: 'seo.ogImage', label: 'Share image (OG)', type: 'image' },
    ],
  },
  {
    id: 'money',
    title: 'Free mode, AI & invoices',
    desc: 'Launch phase में सब free · AI fair-use limit · boost price, GST और invoice पर company details',
    fields: [
      { key: 'monetization.freeMode', label: 'Free mode — कोई plan limit, pricing, billing या boost नहीं', type: 'switch' },
      {
        key: 'ai.dailyCap',
        label: 'AI calls / firm / दिन (free mode में, 0 = कोई limit नहीं)',
        type: 'number',
        hint: 'Free AI providers की limit में रहने के लिए',
      },
      { key: 'ai.providerOrder', label: 'AI provider क्रम', hint: 'openrouter,groq,gemini — पहला fail हो तो अगला' },
      { key: 'monetization.boostPricePerWeek', label: 'Listing boost price / week (₹)', type: 'number' },
      { key: 'monetization.gstPercent', label: 'GST %', type: 'number' },
      { key: 'monetization.invoicePrefix', label: 'Invoice prefix' },
      { key: 'monetization.companyName', label: 'Company legal name' },
      { key: 'monetization.companyGstin', label: 'Company GSTIN' },
      { key: 'monetization.companyAddress', label: 'Company address', wide: true },
    ],
  },
  {
    id: 'finance',
    title: 'Calculators (Haryana)',
    desc: 'EMI और stamp duty tools के default rates',
    fields: [
      { key: 'finance.defaultInterestRate', label: 'Home loan rate %', type: 'number' },
      { key: 'finance.stampDutyMalePct', label: 'Stamp duty — male %', type: 'number' },
      { key: 'finance.stampDutyFemalePct', label: 'Stamp duty — female %', type: 'number' },
      { key: 'finance.stampDutyJointPct', label: 'Stamp duty — joint %', type: 'number' },
      { key: 'finance.registrationFeeMax', label: 'Registration fee max (₹)', type: 'number' },
    ],
  },
];

const get = (o: any, p: string) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setIn = (o: any, p: string, v: any): any => {
  const [h, ...r] = p.split('.');
  return { ...o, [h]: r.length ? setIn(o?.[h] ?? {}, r.join('.'), v) : v };
};

export default function AppConfigPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-app-config'], queryFn: () => api<AppConfig>('/admin/app-config') });
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [active, setActive] = useState('brand');
  useEffect(() => {
    if (q.data) setCfg(q.data);
  }, [q.data]);
  const save = useApiMutation(() => patch('/admin/app-config', cfg), {
    success: 'App config saved — website और app पर तुरंत लागू',
    invalidate: [['admin-app-config']],
    onSuccess: () => qc.invalidateQueries(),
  });
  if (q.isLoading || !cfg) return q.isError ? <ApiErrorState error={q.error} /> : <PageLoader />;
  const dirty = JSON.stringify(cfg) !== JSON.stringify(q.data);
  return (
    <>
      <PageHeader
        title="App config"
        subtitle="Website और mobile app की हर setting — कोई code change नहीं"
        actions={
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!dirty}>
            <Save className="size-4" /> Save changes
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="hidden space-y-1 lg:sticky lg:top-24 lg:block lg:h-fit">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              className={cn(
                'relative block rounded-xl px-3 py-2 text-sm font-semibold',
                active === s.id ? 'text-brand-700 dark:text-white' : 'text-muted hover:text-fg',
              )}
            >
              {active === s.id && <motion.span layoutId="cfg-nav" className="absolute inset-0 rounded-xl bg-brand-50 dark:bg-brand-500/15" />}
              <span className="relative">{s.title}</span>
            </a>
          ))}
        </nav>
        <div className="space-y-5">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="card scroll-mt-24 p-6">
              <p className="font-display text-lg font-bold">{s.title}</p>
              <p className="mb-5 text-sm text-muted">{s.desc}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {s.fields.map((f) => (
                  <Field key={f.key} label={f.label} hint={f.hint} className={cn((f.wide || f.type === 'textarea' || f.type === 'image') && 'sm:col-span-2')}>
                    <FieldInput f={f} value={get(cfg, f.key)} onChange={(v) => setCfg((c) => setIn(c, f.key, f.type === 'number' ? (v ?? 0) : v))} />
                  </Field>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {dirty && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          className="fixed inset-x-0 bottom-5 z-30 mx-auto flex w-fit items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-2xl"
        >
          <span className="text-sm font-semibold">Unsaved changes</span>
          <Button size="sm" variant="ghost" onClick={() => setCfg(q.data!)}>
            Discard
          </Button>
          <Button size="sm" onClick={() => save.mutate(undefined)} loading={save.isPending}>
            Save
          </Button>
        </motion.div>
      )}
    </>
  );
}
