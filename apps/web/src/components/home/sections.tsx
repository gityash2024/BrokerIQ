'use client';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, BadgeCheck, Calculator, IndianRupee, Landmark, MapPinned, MessagesSquare, Scale, ShieldCheck, Smartphone, Sparkles, Star, Wallet } from 'lucide-react';
import { CountUp, Reveal, Stagger, StaggerItem } from '../motion/reveal';
import { HeroSearch } from '../site/search-box';
import { ListingCard } from '../site/listing-card';
import { BrokerCard, LocalityCard, ProjectCard } from '../site/cards';
import { SectionTitle } from '../site/page-shell';
import { Map } from '../site/map';
import { Button } from '../ui/button';
import { useConfig } from '@/lib/config';
import { img } from '@/lib/utils';

const ICONS: Record<string, any> = { 'shield-check': ShieldCheck, 'map-pinned': MapPinned, 'messages-square': MessagesSquare, sparkles: Sparkles, star: Star, 'badge-check': BadgeCheck };

export function HeroSection({ s }: { s: any }) {
  const stats = s.data ?? {};
  const bg = s.config?.backgroundUrl;
  return (
    <section className="relative -mt-16 overflow-hidden pt-16">
      <div className="mesh-hero absolute inset-0" />
      {bg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-overlay" />
      )}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><path d=%22M0 39.5h40M39.5 0v40%22 stroke=%22white%22 stroke-opacity=%220.05%22/></svg>')]" />
      <Skyline />
      <div className="container-x relative flex min-h-[640px] flex-col justify-center py-20 lg:min-h-[700px]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Gurgaon का सबसे smart property hub
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
            {s.title?.includes('Gurgaon') ? (
              <>
                {s.title.split('Gurgaon')[0]}
                <span className="text-gradient">Gurgaon</span>
                {s.title.split('Gurgaon').slice(1).join('Gurgaon')}
              </>
            ) : (
              s.title
            )}
          </h1>
          {s.subtitle && <p className="mt-5 max-w-2xl text-lg text-white/75">{s.subtitle}</p>}
        </motion.div>
        <motion.div className="mt-9" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
          <HeroSearch tabs={s.config?.tabs} />
        </motion.div>
        {s.config?.stats !== false && (
          <motion.div className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            {[
              [stats.listings, 'Live properties'],
              [stats.localities, 'Localities covered'],
              [stats.brokers, 'Verified brokers'],
            ]
              .filter(([n]) => n != null)
              .map(([n, label]) => (
                <div key={label as string}>
                  <p className="font-display text-3xl font-extrabold">
                    <CountUp to={Number(n)} suffix="+" />
                  </p>
                  <p className="text-sm text-white/60">{label}</p>
                </div>
              ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}

function Skyline() {
  return (
    <svg className="pointer-events-none absolute right-0 bottom-0 left-0 h-40 w-full text-white/[0.07] sm:h-56" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden>
      <path
        fill="currentColor"
        d="M0 220V150h40v-30h30v30h20V90h50v130h20V60h60v160h20v-90h40v90h30V30h26l4-20 4 20h26v190h20v-70h60v70h20V80h70v140h20v-50h40v50h30V50h40v-20h20v20h40v170h20v-110h60v110h20V70h50v150h30v-80h40v80h20V20h60v200h20v-60h50v60h30V100h50v120h20V60h70v160h30v-90h40v90h20V40h60v180z"
      />
    </svg>
  );
}

export function LocalitiesSection({ s }: { s: any }) {
  const items = (s.data ?? []) as any[];
  if (!items.length) return null;
  return (
    <section className="container-x py-16">
      <SectionTitle title={s.title} subtitle={s.subtitle} action={<Button href="/localities" variant="secondary" size="sm">All localities <ArrowRight className="size-4" /></Button>} />
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {items.map((l, i) => (
          <StaggerItem key={l.id}>
            <LocalityCard l={l} i={i} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function ListingsSection({ s }: { s: any }) {
  const items = (s.data ?? []) as any[];
  if (!items.length) return null;
  return (
    <section className="bg-surface/60 py-16">
      <div className="container-x">
        <SectionTitle title={s.title} subtitle={s.subtitle} action={<Button href="/buy" variant="secondary" size="sm">View all <ArrowRight className="size-4" /></Button>} />
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((l) => (
            <StaggerItem key={l.id}>
              <ListingCard l={l} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function MapExplorerSection({ s }: { s: any }) {
  const locs = ((s.data ?? []) as any[]).filter((l) => l.latitude && l.longitude);
  const points = locs.map((l) => ({ id: l.id, lat: l.latitude, lng: l.longitude, label: `${l.name} · ${(l.listingsSale ?? 0) + (l.listingsRent ?? 0)} listings`, href: `/locality/${l.slug}`, dot: true }));
  return (
    <section className="container-x py-16">
      <SectionTitle title={s.title} subtitle={s.subtitle} />
      <Reveal>
        <div className="card relative h-[460px] overflow-hidden">
          <Map points={points} fit={false} zoom={11} scrollWheelZoom={false} />
          <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-2xl bg-surface/90 p-3 text-xs shadow-lg backdrop-blur">
            <p className="font-semibold">{locs.length} localities</p>
            <p className="text-muted">किसी भी sector पर click करें</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function ProjectsSection({ s }: { s: any }) {
  const items = (s.data ?? []) as any[];
  if (!items.length) return null;
  return (
    <section className="container-x py-16">
      <SectionTitle title={s.title} subtitle={s.subtitle} action={<Button href="/projects" variant="secondary" size="sm">All projects <ArrowRight className="size-4" /></Button>} />
      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <StaggerItem key={p.id}>
            <ProjectCard p={p} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function BrokersSection({ s }: { s: any }) {
  const items = (s.data ?? []) as any[];
  if (!items.length) return null;
  return (
    <section className="bg-surface/60 py-16">
      <div className="container-x">
        <SectionTitle title={s.title} subtitle={s.subtitle} action={<Button href="/brokers" variant="secondary" size="sm">All brokers <ArrowRight className="size-4" /></Button>} />
        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((b) => (
            <StaggerItem key={b.id}>
              <BrokerCard b={b} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function ToolsSection({ s }: { s: any }) {
  const tools = [
    { href: '/tools?t=emi', icon: Calculator, title: 'EMI Calculator', text: 'Monthly EMI और total interest तुरंत', c: 'from-indigo-500 to-violet-600' },
    { href: '/tools?t=afford', icon: Wallet, title: 'Affordability', text: 'आपकी income में कितना घर', c: 'from-emerald-500 to-teal-600' },
    { href: '/tools?t=stamp', icon: Landmark, title: 'Stamp Duty (Haryana)', text: 'Registration cost का सही अंदाज़ा', c: 'from-amber-400 to-orange-600' },
    { href: '/tools?t=rentbuy', icon: Scale, title: 'Rent vs Buy', text: 'कौन सा option बेहतर है', c: 'from-sky-500 to-blue-600' },
  ];
  return (
    <section className="container-x py-16">
      <SectionTitle title={s.title} subtitle={s.subtitle} />
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((t) => (
          <StaggerItem key={t.href}>
            <Link href={t.href} className="group card flex h-full flex-col p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
              <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${t.c}`}>
                <t.icon className="size-6" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{t.title}</h3>
              <p className="mt-1 text-sm text-muted">{t.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                Calculate <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function WhyUsSection({ s }: { s: any }) {
  const items = (s.config?.items ?? []) as any[];
  if (!items.length) return null;
  return (
    <section className="py-16">
      <div className="container-x">
        <div className="relative overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white sm:p-12">
          <div className="absolute -top-24 -right-24 size-72 rounded-full bg-brand-600/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 size-72 rounded-full bg-saffron-500/20 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold">{s.title}</h2>
            {s.subtitle && <p className="mt-2 text-white/60">{s.subtitle}</p>}
            <Stagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((it, i) => {
                const Icon = ICONS[it.icon] ?? Sparkles;
                return (
                  <StaggerItem key={i}>
                    <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                      <Icon className="size-7 text-saffron-400" />
                      <h3 className="mt-3 font-display font-bold">{it.title}</h3>
                      <p className="mt-1 text-sm text-white/65">{it.text}</p>
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection({ s }: { s: any }) {
  const items = (s.config?.items ?? []) as any[];
  if (!items.length) return null;
  return (
    <section className="container-x py-16">
      <SectionTitle title={s.title} subtitle={s.subtitle} />
      <Stagger className="grid gap-5 md:grid-cols-3">
        {items.map((t, i) => (
          <StaggerItem key={i}>
            <figure className="card h-full p-6">
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating ?? 5 }).map((_, j) => (
                  <Star key={j} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="mt-3 text-sm leading-6 text-muted">“{t.text}”</blockquote>
              <figcaption className="mt-4 text-sm font-semibold">{t.name}</figcaption>
            </figure>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function AppDownloadSection({ s }: { s: any }) {
  const { app } = useConfig();
  if (!app.playStoreUrl && !app.appStoreUrl) return null;
  return (
    <section className="container-x py-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 p-8 text-white sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <Smartphone className="size-10 text-saffron-400" />
              <h2 className="mt-4 font-display text-3xl font-extrabold">{s.title}</h2>
              <p className="mt-2 text-white/75">{s.subtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {app.playStoreUrl && (
                  <Button href={app.playStoreUrl} external variant="accent">
                    Get it on Google Play
                  </Button>
                )}
                {app.appStoreUrl && (
                  <Button href={app.appStoreUrl} external variant="secondary" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                    Download on App Store
                  </Button>
                )}
              </div>
            </div>
            <div className="relative mx-auto hidden h-64 w-40 animate-[float_6s_ease-in-out_infinite] rounded-[28px] border-4 border-white/20 bg-slate-950/40 shadow-2xl lg:block">
              <div className="absolute inset-3 rounded-2xl bg-gradient-to-b from-white/20 to-white/5" />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function BlogSection({ s }: { s: any }) {
  const items = (s.data ?? []) as any[];
  if (!items.length) return null;
  return (
    <section className="container-x py-16">
      <SectionTitle title={s.title} subtitle={s.subtitle} action={<Button href="/blog" variant="secondary" size="sm">All articles <ArrowRight className="size-4" /></Button>} />
      <Stagger className="grid gap-5 md:grid-cols-3">
        {items.map((p) => (
          <StaggerItem key={p.id}>
            <Link href={`/blog/${p.slug}`} className="group card block overflow-hidden transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
              <div className="aspect-[16/9] bg-gradient-to-br from-brand-100 to-saffron-100 dark:from-brand-950 dark:to-surface-2">
                {p.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverUrl} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-5">
                <h3 className="font-display font-bold group-hover:text-brand-600">{p.title}</h3>
                {p.excerpt && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.excerpt}</p>}
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function CtaBannerSection({ s }: { s: any }) {
  return (
    <section className="container-x py-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] border border-line bg-surface p-8 sm:p-12">
          <div className="absolute -top-20 -right-10 size-64 rounded-full bg-saffron-400/30 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <IndianRupee className="size-3.5" /> Brokers के लिए
              </span>
              <h2 className="mt-3 font-display text-3xl font-extrabold">{s.title}</h2>
              <p className="mt-2 text-muted">{s.subtitle}</p>
            </div>
            <Button href={s.config?.ctaLink ?? '/for-brokers'} size="lg">
              {s.config?.ctaLabel ?? 'Get started'} <ArrowRight className="size-5" />
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** Admin-managed image banner — used for sponsored builder / project promotions. */
export function BannerSection({ s }: { s: any }) {
  const c = s.config ?? {};
  if (!c.imageUrl) return null;
  const inner = (
    <div className="group relative overflow-hidden rounded-[28px] border border-line bg-surface-2 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img(c.imageUrl, 1600)} alt={s.title ?? ''} className="aspect-[21/7] w-full object-cover transition duration-700 group-hover:scale-[1.02]" />
      {(s.title || s.subtitle) && (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-black/10 to-transparent p-6 sm:p-10">
          <div>
            {s.title && <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">{s.title}</h2>}
            {s.subtitle && <p className="mt-1 max-w-xl text-white/85">{s.subtitle}</p>}
          </div>
        </div>
      )}
      {c.sponsor && <span className="absolute top-4 right-4 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">Sponsored · {c.sponsor}</span>}
    </div>
  );
  return (
    <section className="container-x py-10">
      <Reveal>{c.link ? <a href={c.link} target={String(c.link).startsWith('http') ? '_blank' : undefined} rel="noreferrer">{inner}</a> : inner}</Reveal>
    </section>
  );
}
