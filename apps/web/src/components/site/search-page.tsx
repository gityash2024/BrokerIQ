'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as Pop from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { BellPlus, Check, ChevronDown, LayoutGrid, List, Map as MapIcon, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { formatPriceShort, FURNISHING_LABELS, PROPERTY_TYPE_CATEGORY, PROPERTY_TYPE_LABELS, RENTABLE_TYPES, plural } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, qs } from '@/lib/utils';
import type { ListingCard as LC, Paged } from '@/lib/types';
import { Chip, Input, Select } from '../ui/field';
import { Button } from '../ui/button';
import { Empty, Switch } from '../ui/misc';
import { RequirementButton } from './requirement';
import { Sheet } from '../ui/dialog';
import { ApiErrorState } from '../ui/api-error';
import { ListingCard, ListingCardSkeleton } from './listing-card';
import { Map } from './map';
import { SearchInput } from './search-box';

export type SearchMode = 'buy' | 'rent' | 'commercial' | 'plots';

// Rental marketplace: every mode searches rent listings ('buy' / 'plots' routes redirect to /rent).
const MODE: Record<SearchMode, { purpose?: 'SALE' | 'RENT'; category?: string; title: string; base: string }> = {
  buy: { purpose: 'RENT', category: 'RESIDENTIAL', title: 'Homes for rent', base: '/rent' },
  rent: { purpose: 'RENT', category: 'RESIDENTIAL', title: 'Homes for rent', base: '/rent' },
  commercial: { purpose: 'RENT', category: 'COMMERCIAL', title: 'Commercial space for rent', base: '/commercial' },
  plots: { purpose: 'RENT', category: 'RESIDENTIAL', title: 'Homes for rent', base: '/rent' },
};

const BEDS = ['1', '2', '3', '4', '5+'];

export function SearchPage({ mode, initial }: { mode: SearchMode; initial?: Paged<LC> | null }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const m = MODE[mode];
  const [view, setView] = useState<'grid' | 'list' | 'map'>('grid');
  const [moreOpen, setMoreOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState(false);
  const [pendingBbox, setPendingBbox] = useState<string | null>(null);

  const f = useMemo(() => Object.fromEntries(sp.entries()) as Record<string, string>, [sp]);
  const purpose = m.purpose ?? 'RENT';
  const filters = { ...f, purpose, category: m.category, sort: f.sort ?? 'relevance' };

  const setF = (patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v == null || v === '' ? next.delete(k) : next.set(k, v));
    router.replace(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };
  const toggleCsv = (key: string, val: string) => {
    const set = new Set((f[key] ?? '').split(',').filter(Boolean));
    set.has(val) ? set.delete(val) : set.add(val);
    setF({ [key]: [...set].join(',') });
  };
  const csvHas = (key: string, val: string) => (f[key] ?? '').split(',').includes(val);

  const { data: tax } = useQuery({ queryKey: ['taxonomies'], queryFn: () => api<any>('/public/taxonomies', { auth: false }), staleTime: 600_000 });
  const { data: locs } = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000 });

  const key = qs(filters);
  const q = useInfiniteQuery({
    queryKey: ['search', key],
    queryFn: ({ pageParam }) => api<Paged<LC>>(`/listings${qs({ ...filters, page: pageParam, pageSize: 18 })}`, { auth: false }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    initialData: initial && !Object.keys(f).length ? { pages: [initial], pageParams: [1] } : undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;

  const mapQ = useQuery({ queryKey: ['search-map', key], queryFn: () => api<any[]>(`/listings/map${key}`, { auth: false }), enabled: view === 'map' });

  const types = (tax?.propertyTypes ?? []).filter((t: any) => (m.category ? t.category === m.category : true) && RENTABLE_TYPES.includes(t.value));
  const budgets: number[] = tax?.budgets?.[purpose] ?? [];
  const selectedLocs = (f.localities ?? '').split(',').filter(Boolean);
  const activeCount = ['types', 'minPrice', 'maxPrice', 'bedrooms', 'furnishing', 'possession', 'postedBy', 'verified', 'amenities', 'localities', 'q', 'minArea', 'maxArea'].filter((k) => f[k]).length;

  const saveSearch = async () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(pathname + '?' + sp.toString())}`);
    const locNames = selectedLocs.map((s) => locs?.find((l) => l.slug === s)?.name ?? s).join(', ');
    const name = [f.bedrooms ? `${f.bedrooms} BHK` : '', m.title, locNames ? `in ${locNames}` : 'in Gurgaon'].filter(Boolean).join(' ');
    try {
      await api('/me/saved-searches', { method: 'POST', body: { name, filters: { ...filters }, alertsEnabled: true } });
      toast.success('Search saved — नई properties आते ही alert मिलेगा 🔔');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    if (areaSearch && pendingBbox) setF({ bbox: pendingBbox });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBbox, areaSearch]);

  return (
    <div className="min-h-dvh">
      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="container-x flex flex-col gap-3 py-3">
          <div className="flex items-center gap-2">
            <SearchInput basePath={m.base} defaultValue={f.q ?? ''} className="flex-1" />
            <div className="hidden items-center rounded-xl border border-line bg-surface p-1 md:flex">
              {(
                [
                  ['grid', LayoutGrid],
                  ['list', List],
                  ['map', MapIcon],
                ] as const
              ).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)} className={cn('grid size-9 place-items-center rounded-lg transition', view === v ? 'bg-brand-600 text-white' : 'text-muted hover:bg-surface-2')} aria-label={v}>
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <LocalityPicker locs={locs ?? []} selected={selectedLocs} onChange={(v) => setF({ localities: v.join(',') })} />
            <Pop.Root>
              <Pop.Trigger asChild>
                <button className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium', f.minPrice || f.maxPrice ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-line bg-surface text-muted')}>
                  {f.minPrice || f.maxPrice ? `${f.minPrice ? formatPriceShort(+f.minPrice) : 'Any'} – ${f.maxPrice ? formatPriceShort(+f.maxPrice) : 'Any'}` : 'Budget'} <ChevronDown className="size-4" />
                </button>
              </Pop.Trigger>
              <Pop.Portal>
                <Pop.Content sideOffset={8} align="start" className="z-50 w-72 rounded-2xl border border-line bg-surface p-4 shadow-xl">
                  <p className="mb-2 text-sm font-semibold">Budget</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={f.minPrice ?? ''} onChange={(e) => setF({ minPrice: e.target.value })}>
                      <option value="">Min</option>
                      {budgets.map((b) => (
                        <option key={b} value={b}>
                          {formatPriceShort(b)}
                        </option>
                      ))}
                    </Select>
                    <Select value={f.maxPrice ?? ''} onChange={(e) => setF({ maxPrice: e.target.value })}>
                      <option value="">Max</option>
                      {budgets.map((b) => (
                        <option key={b} value={b}>
                          {formatPriceShort(b)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Pop.Content>
              </Pop.Portal>
            </Pop.Root>
            {m.category === 'RESIDENTIAL' &&
              BEDS.map((b) => (
                <Chip key={b} active={csvHas('bedrooms', b)} onClick={() => toggleCsv('bedrooms', b)}>
                  {b} BHK
                </Chip>
              ))}
            {m.category === 'RESIDENTIAL' && (
              <Chip active={csvHas('furnishing', 'FULLY_FURNISHED')} onClick={() => toggleCsv('furnishing', 'FULLY_FURNISHED')}>
                Furnished
              </Chip>
            )}
            <Chip active={f.verified === 'true'} onClick={() => setF({ verified: f.verified === 'true' ? null : 'true' })}>
              <Check className="size-3.5" /> Verified
            </Chip>
            <Chip active={f.postedBy === 'OWNER'} onClick={() => setF({ postedBy: f.postedBy === 'OWNER' ? null : 'OWNER' })}>
              Owner
            </Chip>
            <Button size="sm" variant="secondary" className="shrink-0 rounded-full" onClick={() => setMoreOpen(true)}>
              <SlidersHorizontal className="size-4" /> Filters {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-[10px] text-white">{activeCount}</span>}
            </Button>
            {activeCount > 0 && (
              <button onClick={() => router.replace(pathname)} className="shrink-0 px-2 text-sm font-semibold text-brand-600 hover:underline">
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={cn(view === 'map' ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : '')}>
        <div className={cn(view === 'map' ? 'px-4 sm:px-6' : 'container-x', 'py-6')}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight">
                {f.bedrooms ? `${f.bedrooms} BHK ` : ''}
                {m.title}
                {selectedLocs.length ? ` in ${selectedLocs.map((s) => locs?.find((l) => l.slug === s)?.name ?? s).join(', ')}` : ' in Gurgaon'}
              </h1>
              <p className="mt-1 text-sm text-muted">{q.isLoading ? 'Searching…' : `${plural(total, 'property', 'properties')} found`}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={saveSearch}>
                <BellPlus className="size-4" /> Save search
              </Button>
              <Select value={f.sort ?? 'relevance'} onChange={(e) => setF({ sort: e.target.value })} className="h-9 w-44 text-sm">
                <option value="relevance">Relevance</option>
                <option value="newest">Newest first</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="psf_asc">₹/sq.ft: low to high</option>
                <option value="area_desc">Largest area</option>
              </Select>
            </div>
          </div>

          {q.error ? (
            <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : q.isLoading ? (
            <div className={cn('grid gap-5', view === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1')}>
              {Array.from({ length: 6 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : !items.length ? (
            <Empty
              icon={<Search className="size-6" />}
              title="कोई property नहीं मिली"
              text="Filters थोड़े कम करके देखें, या search save करें — नई property आते ही हम बता देंगे।"
              action={
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => router.replace(pathname)}>
                    Clear filters
                  </Button>
                  <Button onClick={saveSearch}>
                    <BellPlus className="size-4" /> Alert me
                  </Button>
                  <RequirementButton prefill={{ bedrooms: (f.bedrooms ?? '').split(',').map(Number).filter((n: number) => n > 0), maxBudget: f.maxPrice ? Number(f.maxPrice) : undefined, localitySlugs: selectedLocs }} />
                </div>
              }
            />
          ) : (
            <>
              <div className={cn('grid gap-5', view === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : view === 'map' ? 'sm:grid-cols-2' : 'grid-cols-1')}>
                <AnimatePresence initial={false}>
                  {items.map((l, i) => (
                    <motion.div key={l.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(i % 18, 8) * 0.03 }}>
                      <ListingCard l={l} layout={view === 'list' ? 'row' : 'grid'} active={hovered === l.id} onHover={setHovered} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {q.hasNextPage && (
                <div className="mt-8 text-center">
                  <Button variant="secondary" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>
                    Load more properties
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {view === 'map' && (
          <div className="sticky top-[136px] hidden h-[calc(100dvh-136px)] lg:block">
            <Map
              points={(mapQ.data ?? []).map((p) => ({ id: p.id, lat: p.latitude, lng: p.longitude, price: p.price, href: `/property/${p.slug}` }))}
              activeId={hovered}
              onBounds={(b) => setPendingBbox(b)}
              fit={!f.bbox}
            />
            <div className="absolute top-4 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-surface px-4 py-2 text-sm font-semibold shadow-lg">
              <label className="flex items-center gap-2">
                <Switch
                  checked={areaSearch}
                  onCheckedChange={(v) => {
                    setAreaSearch(v);
                    if (!v) setF({ bbox: null });
                  }}
                />
                Map move करने पर search करें
              </label>
            </div>
          </div>
        )}
      </div>

      <button onClick={() => setView(view === 'map' ? 'grid' : 'map')} className="fixed bottom-6 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-2xl md:hidden">
        {view === 'map' ? <List className="size-4" /> : <MapIcon className="size-4" />} {view === 'map' ? 'List' : 'Map'}
      </button>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="All filters">
        <div className="space-y-6 p-5">
          <FilterGroup title="Property type">
            {types.map((t: any) => (
              <Chip key={t.value} active={csvHas('types', t.value)} onClick={() => toggleCsv('types', t.value)}>
                {t.label}
              </Chip>
            ))}
          </FilterGroup>
          {m.category !== 'PLOT' && (
            <FilterGroup title="Furnishing">
              {Object.entries(FURNISHING_LABELS).map(([v, l]) => (
                <Chip key={v} active={csvHas('furnishing', v)} onClick={() => toggleCsv('furnishing', v)}>
                  {l}
                </Chip>
              ))}
            </FilterGroup>
          )}
          {purpose === 'SALE' && (
            <FilterGroup title="Possession">
              <Chip active={f.possession === 'READY_TO_MOVE'} onClick={() => setF({ possession: f.possession === 'READY_TO_MOVE' ? null : 'READY_TO_MOVE' })}>
                Ready to move
              </Chip>
              <Chip active={f.possession === 'UNDER_CONSTRUCTION'} onClick={() => setF({ possession: f.possession === 'UNDER_CONSTRUCTION' ? null : 'UNDER_CONSTRUCTION' })}>
                Under construction
              </Chip>
            </FilterGroup>
          )}
          <FilterGroup title="Posted by">
            {(['OWNER', 'BROKER', 'BUILDER'] as const).map((p) => (
              <Chip key={p} active={f.postedBy === p} onClick={() => setF({ postedBy: f.postedBy === p ? null : p })}>
                {p[0] + p.slice(1).toLowerCase()}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup title="Area (sq.ft)">
            <div className="grid w-full grid-cols-2 gap-2">
              <Input type="number" placeholder="Min" defaultValue={f.minArea} onBlur={(e) => setF({ minArea: e.target.value })} />
              <Input type="number" placeholder="Max" defaultValue={f.maxArea} onBlur={(e) => setF({ maxArea: e.target.value })} />
            </div>
          </FilterGroup>
          <FilterGroup title="Amenities">
            {(tax?.amenities ?? [])
              .filter((a: any) => (m.category === 'COMMERCIAL' ? a.category !== 'flat' : a.category !== 'commercial'))
              .map((a: any) => (
                <Chip key={a.key} active={csvHas('amenities', a.key)} onClick={() => toggleCsv('amenities', a.key)}>
                  {a.label}
                </Chip>
              ))}
          </FilterGroup>
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t border-line bg-surface p-4">
          <Button variant="secondary" className="flex-1" onClick={() => router.replace(pathname)}>
            Reset
          </Button>
          <Button className="flex-1" onClick={() => setMoreOpen(false)}>
            Show {total} results
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-sm font-bold">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function LocalityPicker({ locs, selected, onChange }: { locs: any[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const filtered = locs.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.zone?.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  const label = selected.length ? (selected.length === 1 ? (locs.find((l) => l.slug === selected[0])?.name ?? '1 locality') : `${selected.length} localities`) : 'Locality';
  return (
    <Pop.Root>
      <Pop.Trigger asChild>
        <button className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium', selected.length ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-line bg-surface text-muted')}>
          <MapPin className="size-4" /> {label} <ChevronDown className="size-4" />
        </button>
      </Pop.Trigger>
      <Pop.Portal>
        <Pop.Content sideOffset={8} align="start" className="z-50 w-80 rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <Input autoFocus placeholder="Sector / locality खोजें" value={q} onChange={(e) => setQ(e.target.value)} className="h-10" />
          {selected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.map((s) => (
                <button key={s} onClick={() => onChange(selected.filter((x) => x !== s))} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
                  {locs.find((l) => l.slug === s)?.name ?? s} <X className="size-3" />
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 max-h-72 overflow-y-auto">
            {filtered.map((l) => {
              const on = selected.includes(l.slug);
              return (
                <button key={l.id} onClick={() => onChange(on ? selected.filter((x) => x !== l.slug) : [...selected, l.slug])} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2">
                  <span>
                    <span className="font-medium">{l.name}</span>
                    <span className="block text-xs text-subtle">{l.zone}</span>
                  </span>
                  {on && <Check className="size-4 text-brand-600" />}
                </button>
              );
            })}
          </div>
        </Pop.Content>
      </Pop.Portal>
    </Pop.Root>
  );
}

export const TYPE_CATEGORY = PROPERTY_TYPE_CATEGORY;
export const TYPE_LABELS = PROPERTY_TYPE_LABELS;
