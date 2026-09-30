'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Bot, CalendarClock, Check, ChevronDown, Inbox, LineChart, MessageCircle, ScanLine, Sparkles, Users, Zap, Globe } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { cn } from '@/lib/utils';
import { Reveal, Stagger, StaggerItem } from '../motion/reveal';
import { Button } from '../ui/button';
import { Segmented } from '../ui/tabs';
import { useFreeMode } from '@/lib/config';

const SOURCES = [
  ['Housing.com', '#6D28D9'],
  ['99acres', '#0369A1'],
  ['MagicBricks', '#DC2626'],
  ['NoBroker', '#E11D48'],
  ['Facebook Ads', '#1877F2'],
  ['Instagram', '#DB2777'],
  ['WhatsApp', '#16A34A'],
  ['Website', '#4F46E5'],
];

const FEATURES = [
  { icon: Inbox, t: 'Unified lead inbox', d: 'हर portal, ad और WhatsApp की lead एक जगह — duplicate अपने-आप merge।' },
  { icon: MessageCircle, t: 'WhatsApp automation', d: 'नई lead आते ही 5 seconds में आपके number से welcome message।' },
  { icon: Zap, t: 'Drip & follow-ups', d: 'Day 0, 1, 3 के automatic messages और call reminders — कोई lead ठंडी नहीं होगी।' },
  { icon: ScanLine, t: 'AI listing-book scanner', d: 'Register की photo खींचिए — AI सारी listings inventory में डाल देगा।' },
  { icon: Bot, t: 'AI lead insights', d: 'हर lead का summary, hot/warm/cold score और अगला best step।' },
  { icon: Users, t: 'Team & round-robin', d: 'Agents invite करें, leads बारी-बारी assign, performance leaderboard।' },
  { icon: CalendarClock, t: 'Site visits & deals', d: 'Visit calendar, GPS check-in, commission tracking और invoices।' },
  { icon: Globe, t: 'Your own microsite', d: 'Listings, reviews और WhatsApp button के साथ आपकी अपनी website।' },
  { icon: LineChart, t: 'Source-wise ROI', d: 'कौन-सा portal सबसे ज़्यादा deals दे रहा है — साफ़ analytics।' },
];

export function BrokerLanding({ plans, faqs }: { plans: any[]; faqs: any[] }) {
  const freeMode = useFreeMode();
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [open, setOpen] = useState<number | null>(0);
  // An invite link (/for-brokers?invite=CODE) carries the code through to signup.
  const [signupHref, setSignupHref] = useState('/signup?type=broker');
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('invite');
    if (code) setSignupHref(`/signup?type=broker&invite=${encodeURIComponent(code)}`);
  }, []);
  return (
    <>
      <section className="relative -mt-16 overflow-hidden pt-16">
        <div className="mesh-hero absolute inset-0" />
        <div className="container-x relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-white">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="size-3.5 text-saffron-400" /> Gurgaon brokers के लिए बना CRM
            </span>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              हर lead, <span className="text-gradient">एक app</span> में। हर reply, <span className="text-gradient">automatic</span>।
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">Housing, 99acres, MagicBricks, Facebook और WhatsApp की leads को एक inbox में लाइए। Automatic WhatsApp, follow-up reminders और AI के साथ ज़्यादा deals close करें।</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={signupHref} size="lg" variant="accent">
                Free में शुरू करें <ArrowRight className="size-5" />
              </Button>
              <Button href="#pricing" size="lg" variant="secondary" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                {freeMode ? 'क्या-क्या free है' : 'Pricing देखें'}
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/60">No credit card · Free plan हमेशा के लिए</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl">
              <div className="rounded-2xl bg-surface p-4 text-fg">
                <p className="text-xs font-bold text-muted uppercase">Live lead inbox</p>
                <div className="mt-3 space-y-2.5">
                  {[
                    ['Rahul S.', 'Housing.com', '3 BHK · Sector 65', '#6D28D9', 'Just now'],
                    ['Priya V.', '99acres', '2 BHK rent · Sohna Rd', '#0369A1', '2m'],
                    ['Amit K.', 'Facebook Ads', 'Plot · New Gurgaon', '#1877F2', '9m'],
                    ['Neha G.', 'WhatsApp', 'Office · Cyber City', '#16A34A', '14m'],
                  ].map(([n, s, r, c, t], i) => (
                    <motion.div key={n} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.15 }} className="flex items-center gap-3 rounded-xl border border-line p-3">
                      <span className="grid size-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: c }}>
                        {n[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{n}</p>
                        <p className="truncate text-xs text-muted">{r}</p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: c }}>
                          {s}
                        </span>
                        <p className="mt-1 text-[10px] text-subtle">{t}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <MessageCircle className="size-4" /> WhatsApp welcome sent to Rahul S. automatically
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-b border-line bg-surface py-8">
        <div className="container-x">
          <p className="text-center text-sm font-semibold text-muted">इन सब जगहों की leads अपने-आप BrokerIQ में</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {SOURCES.map(([n, c]) => (
              <span key={n} className="rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm" style={{ background: c }}>
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-20">
        <Reveal>
          <h2 className="text-center font-display text-3xl font-extrabold sm:text-4xl">Deals close करने के लिए जो चाहिए, सब एक जगह</h2>
        </Reveal>
        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <StaggerItem key={f.t}>
              <div className="card h-full p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
                  <f.icon className="size-6" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{f.t}</h3>
                <p className="mt-1 text-sm text-muted">{f.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {freeMode ? (
        <FreeForBrokers signupHref={signupHref} />
      ) : (
      <section id="pricing" className="bg-surface/70 py-20">
        <div className="container-x">
          <div className="text-center">
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">Simple pricing</h2>
            <p className="mt-2 text-muted">Free से शुरू करें, बढ़ने पर upgrade करें।</p>
            <Segmented className="mt-6" value={cycle} onChange={setCycle} options={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'YEARLY', label: 'Yearly · 2 months free' }]} />
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const price = cycle === 'YEARLY' ? p.priceYearly : p.priceMonthly;
              return (
                <div key={p.id} className={cn('card relative flex flex-col p-6', p.isPopular && 'border-2 border-brand-600 shadow-[var(--shadow-lift)] lg:-translate-y-3')}>
                  {p.isPopular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">Most popular</span>}
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className="mt-1 min-h-10 text-sm text-muted">{p.description}</p>
                  <p className="mt-4 font-display text-4xl font-extrabold">
                    {price ? formatINR(price) : 'Free'}
                    {price ? <span className="text-sm font-medium text-muted">/{cycle === 'YEARLY' ? 'yr' : 'mo'}</span> : null}
                  </p>
                  {p.trialDays > 0 && <p className="mt-1 text-xs font-semibold text-emerald-600">{p.trialDays}-day free trial</p>}
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {p.features.map((f: string) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button href={signupHref} className="mt-6 w-full" variant={p.isPopular ? 'primary' : 'secondary'}>
                    {price ? 'Start trial' : 'Start free'}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-subtle">Prices exclusive of GST.</p>
        </div>
      </section>
      )}

      {faqs.length > 0 && (
        <section className="container-x max-w-3xl py-20">
          <h2 className="text-center font-display text-3xl font-extrabold">सवाल-जवाब</h2>
          <div className="mt-10 space-y-3">
            {faqs.map((f, i) => (
              <div key={f.id} className="card overflow-hidden">
                <button className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold" onClick={() => setOpen(open === i ? null : i)}>
                  {f.question}
                  <ChevronDown className={cn('size-5 shrink-0 transition', open === i && 'rotate-180')} />
                </button>
                <motion.div initial={false} animate={{ height: open === i ? 'auto' : 0 }} className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-6 text-muted">{f.answer}</p>
                </motion.div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="container-x pb-10">
        <div className="relative overflow-hidden rounded-[32px] bg-slate-950 p-10 text-center text-white">
          <div className="absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-brand-600/40 blur-3xl" />
          <h2 className="relative font-display text-3xl font-extrabold">आज ही शुरू करें — setup 5 मिनट</h2>
          <p className="relative mt-2 text-white/70">Account बनाइए, portal inbox और WhatsApp जोड़िए, और leads आने दीजिए।</p>
          <Button href={signupHref} size="lg" variant="accent" className="relative mt-6">
            Free broker account <ArrowRight className="size-5" />
          </Button>
        </div>
      </section>
    </>
  );
}

const FREE_POINTS = [
  'Unlimited listings, leads और team members',
  'Housing, 99acres, MagicBricks, Facebook leads — सब connectors',
  'WhatsApp automation, follow-ups और AI assistant',
  'Co-broking network, share kit, visiting card',
  'Invoices, rent agreements, owner reports',
  'Microsite, reviews और analytics',
];

/** Launch phase (free mode): no plans or prices — every feature is free for invited brokers. */
function FreeForBrokers({ signupHref }: { signupHref: string }) {
  return (
    <section id="pricing" className="bg-surface/70 py-20">
      <div className="container-x max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Sparkles className="size-3.5" /> Launch offer
        </span>
        <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">अभी सब कुछ free है</h2>
        <p className="mt-2 text-muted">कोई plan नहीं, कोई limit नहीं, कोई card नहीं — invite से जुड़ें और पूरा BrokerIQ इस्तेमाल करें।</p>
        <ul className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-2">
          {FREE_POINTS.map((p) => (
            <li key={p} className="card flex gap-2 p-4 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /> {p}
            </li>
          ))}
        </ul>
        <Button href={signupHref} size="lg" className="mt-8">
          Free में शुरू करें <ArrowRight className="size-5" />
        </Button>
      </div>
    </section>
  );
}
