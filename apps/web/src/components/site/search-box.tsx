'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Building, Building2, Clock, Loader2, MapPin, Search, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'SALE', label: 'Buy', path: '/buy' },
  { key: 'RENT', label: 'Rent', path: '/rent' },
  { key: 'COMMERCIAL', label: 'Commercial', path: '/commercial' },
  { key: 'PLOT', label: 'Plots', path: '/plots' },
  { key: 'PROJECTS', label: 'New Projects', path: '/projects' },
] as const;

const RECENT_KEY = 'biq.recent-searches';

export function HeroSearch({ tabs = TABS.map((t) => t.key) }: { tabs?: string[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('SALE');
  const visible = TABS.filter((t) => tabs.includes(t.key));
  return (
    <div className="w-full max-w-3xl">
      <div className="mb-3 flex flex-wrap gap-1">
        {visible.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('relative rounded-full px-4 py-2 text-sm font-semibold transition', tab === t.key ? 'text-slate-950' : 'text-white/80 hover:text-white')}
          >
            {tab === t.key && <motion.span layoutId="hero-tab" className="absolute inset-0 rounded-full bg-white shadow-lg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
      <SearchInput basePath={TABS.find((t) => t.key === tab)!.path} large />
    </div>
  );
}

export function SearchInput({ basePath = '/buy', large, defaultValue = '', className }: { basePath?: string; large?: boolean; defaultValue?: string; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<{ label: string; href: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const dq = useDebounced(q, 200);
  const { data, isFetching } = useQuery({ queryKey: ['suggest', dq], queryFn: () => api<any>(`/public/suggest?q=${encodeURIComponent(dq)}`, { auth: false }), enabled: dq.trim().length >= 2 });

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'));
    } catch {}
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (href: string, label: string) => {
    const next = [{ label, href }, ...recent.filter((r) => r.href !== href)].slice(0, 5);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
    setOpen(false);
    router.push(href);
  };
  const submit = () => (q.trim() ? go(`${basePath}?q=${encodeURIComponent(q.trim())}`, q.trim()) : router.push(basePath));
  const withParam = (key: string, val: string) => `${basePath}${basePath.includes('?') ? '&' : '?'}${key}=${val}`;
  const hasResults = data && (data.localities.length || data.projects.length || data.brokers.length);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn('flex items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-brand-950/30 ring-1 ring-black/5 dark:bg-surface dark:ring-white/10', large ? 'pl-4' : 'pl-3')}
      >
        <Search className={cn('shrink-0 text-subtle', large ? 'size-5' : 'size-4')} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Sector, locality, society, project या builder खोजें…"
          className={cn('min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-fg', large ? 'h-12 text-base' : 'h-10 text-sm')}
          aria-label="Search"
        />
        {isFetching && <Loader2 className="size-4 animate-spin text-subtle" />}
        <button type="submit" className={cn('shrink-0 rounded-xl bg-brand-600 font-semibold text-white transition hover:bg-brand-700 active:scale-95', large ? 'h-12 px-6' : 'h-10 px-4 text-sm')}>
          Search
        </button>
      </form>
      <AnimatePresence>
        {open && (hasResults || (!q && recent.length > 0)) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-line bg-surface p-2 text-left shadow-2xl"
          >
            {!q &&
              recent.map((r) => (
                <Row key={r.href} icon={<Clock className="size-4" />} title={r.label} onClick={() => go(r.href, r.label)} />
              ))}
            {data?.localities.map((l: any) => (
              <Row key={l.id} icon={<MapPin className="size-4" />} title={l.name} sub={l.zone} onClick={() => go(withParam('localities', l.slug), l.name)} />
            ))}
            {data?.projects.map((p: any) => (
              <Row key={p.id} icon={<Building2 className="size-4" />} title={p.name} sub={`${p.builder?.name ?? ''} · ${p.locality?.name ?? ''}`} onClick={() => go(`/projects/${p.slug}`, p.name)} />
            ))}
            {data?.brokers.map((b: any) => (
              <Row key={b.id} icon={<User className="size-4" />} title={b.name} sub="Broker" onClick={() => go(`/brokers/${b.slug}`, b.name)} />
            ))}
            {q && (
              <Row icon={<Building className="size-4" />} title={`"${q}" के लिए सभी properties`} onClick={submit} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub?: string | null; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{title}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </button>
  );
}
