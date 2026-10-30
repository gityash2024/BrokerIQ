'use client';
import { InventoryDetails } from '@/components/broker/launch/inventory-details';
import { PublicPublish } from '@/components/broker/launch/public-publish';
import { inventoryTitle, inventoryPrice, readableValue, floorLabel } from '@brokeriq/shared';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, SlidersHorizontal, Search, X, Phone, MessageCircle } from 'lucide-react';
import { type LedgerItem, type PagedLedger, INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES, INVENTORY_FILTER_LABELS, formatINR } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Dialog } from '@/components/ui/dialog';
import { AdvancedFilters } from '@/components/broker/launch/advanced-filters';
import { PropertyForm } from '@/components/broker/launch/property-form';
import { toast } from 'sonner';

const initialFilters = {
  detailFilters: '',
  sort: '',
  hasPhotos: '',
  hasVideos: '',
  amenities: '',
  verificationStatus: '',
  floor: '',
  sector: '',
  purpose: '',
  propertyType: '',
  category: '',
  bhk: '',
  roomKinds: '',
  minRate: '',
  maxRate: '',
  furnishing: '',
  availability: '',
  sourceType: '',
  minBudget: '',
  maxBudget: '',
  minArea: '',
  maxArea: '',
  areaUnit: '',
  onlyMine: '',
  assignedToId: '',
};
export default function LedgerPage() {
  return (
    <Suspense>
      <LedgerInner />
    </Suspense>
  );
}
function LedgerInner() {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const term = useDebounced(search);
  const params = useSearchParams();
  const [filters, setFilters] = useState({
    ...initialFilters,
    ...Object.fromEntries(Object.keys(initialFilters).flatMap((key) => (params.get(key) ? [[key, params.get(key)!]] : []))),
  });
  const [publishing, setPublishing] = useState<LedgerItem | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortOrder: 'desc' });
  const [viewing, setViewing] = useState<LedgerItem | null>(null);
  const [layout, setLayout] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [editing, setEditing] = useState<LedgerItem | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [term, filters]);
  const query = useQuery({
    queryKey: ['ledger', term, filters, page, sort],
    queryFn: () => api<PagedLedger>(`/inventory${qs({ search: term, ...filters, page, pageSize: 50, ...sort })}`),
  });
  const stats = useQuery({ queryKey: ['ledger-stats'], queryFn: () => api<any>('/inventory/stats') });
  const sectors = useQuery({ queryKey: ['ledger-sectors'], queryFn: () => api<{ sector: string; count: number }[]>('/inventory/sectors') });
  const team = useQuery({ queryKey: ['broker-team'], queryFn: () => api<any>('/broker/team') });
  const teamMembers: any[] = (Array.isArray(team.data) ? team.data : (team.data as any)?.members) || [];
  async function refresh() {
    await Promise.all(
      ['ledger', 'ledger-stats', 'ledger-sectors', 'broker-dashboard', 'enterprise-dashboard'].map((key) => qc.invalidateQueries({ queryKey: [key] })),
    );
  }
  async function bulk(data: Record<string, string>) {
    try {
      await api('/inventory/bulk/update', { method: 'PATCH', body: { ids: selected, data } });
      setSelected([]);
      await refresh();
      toast.success('Properties updated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  const count = Object.values(filters).filter(Boolean).length;
  const fields: Record<string, string[]> = {
    sector: (sectors.data ?? []).map((s) => s.sector),
    purpose: ['RENT', 'SALE'],
    propertyType: PROPERTY_TYPES,
    category: ['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND'],
    bhk: ['1', '2', '3', '4', '5', '6'],
    roomKinds: ['BHK', 'RK', 'STUDIO'],
    furnishing: ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'],
    availability: ['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE'],
    sourceType: ['MANUAL', 'PDF_REGISTER', 'WHATSAPP', 'CHAT_EXPORT', 'IMAGE', 'TEXT', 'PORTAL'],
    areaUnit: ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'],
  };
  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="हर property, contact और source एक जगह"
        actions={
          <>
            <Link href="/broker/inventory/directory" className="text-sm font-semibold text-brand-600">
              Area Directory
            </Link>
            <Link href="/broker/scanner?target=INVENTORY" className="rounded-xl border border-line px-4 py-2 text-sm font-semibold">
              Scan / import
            </Link>
            <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
              <Plus size={16} />
              Add property
            </button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/80 px-4 py-2 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="font-semibold text-fg">
            <b>{stats.data?.total == null ? '—' : Number(stats.data.total).toLocaleString('en-IN')}</b> <span className="text-muted font-normal">Total Properties</span>
          </span>
          <span className="h-3 w-px bg-line" />
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <b>{stats.data?.available == null ? '—' : Number(stats.data.available).toLocaleString('en-IN')}</b> Available
          </span>
          <span className="h-3 w-px bg-line" />
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <b>{stats.data?.unknown == null ? '—' : Number(stats.data.unknown).toLocaleString('en-IN')}</b> Unverified
          </span>
        </div>
        <div className="text-xs text-muted">
          Showing <b>{query.data?.total ?? 0}</b> properties
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
          <Search size={17} className="text-muted" />
          <input
            aria-label="Search inventory"
            placeholder="House, locality, contact or notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button
          onClick={() => setFilters({ ...filters, onlyMine: filters.onlyMine === 'true' ? '' : 'true' })}
          className={`flex h-11 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
            filters.onlyMine === 'true'
              ? 'border-brand-600 bg-brand-50 text-brand-700'
              : 'border-line bg-surface text-muted hover:text-fg'
          }`}
        >
          👤 My Properties
        </button>
        {user?.role !== 'BROKER_AGENT' && teamMembers.length > 0 && (
          <select
            aria-label="Filter by assignee"
            value={filters.assignedToId || ''}
            onChange={(e) => setFilters({ ...filters, assignedToId: e.target.value })}
            className="h-11 rounded-xl border border-line bg-surface px-3 text-xs font-medium text-fg outline-none"
          >
            <option value="">All Assignees</option>
            {teamMembers.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email || m.phone} ({m.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'})
              </option>
            ))}
          </select>
        )}
        <button onClick={() => setFilterOpen(true)} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold">
          <SlidersHorizontal size={16} />
          Filters {count > 0 && `(${count})`}
        </button>
      </div>
      {!!count && (
        <div className="mb-3 flex flex-wrap gap-2">
          {Object.entries(filters)
            .filter(([, value]) => value)
            .map(([key, value]) => (
              <button
                key={key}
                onClick={() => setFilters({ ...filters, [key]: '' })}
                className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700"
              >
                {INVENTORY_FILTER_LABELS[key] ?? key}: {value}
                <X size={12} />
              </button>
            ))}
          <button onClick={() => setFilters(initialFilters)} className="text-xs text-muted">
            Reset filters
          </button>
        </div>
      )}
      {!!selected.length && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
          <b>{selected.length} selected</b>
          <button onClick={() => bulk({ status: 'ACTIVE' })}>Make active</button>
          <button onClick={() => bulk({ status: 'DRAFT' })}>Make draft</button>
          <button onClick={() => bulk({ status: 'INACTIVE' })}>Make inactive</button>
          <button onClick={() => bulk({ availability: 'AVAILABLE' })}>Confirm available</button>
          <button onClick={() => setSelected([])}>Clear</button>
        </div>
      )}
      <div className="mb-4 flex justify-end gap-2" role="group" aria-label="Inventory layout">
        {(['TABLE', 'CARDS'] as const).map((value) => (
          <button
            key={value}
            aria-pressed={layout === value}
            onClick={() => setLayout(value)}
            className={`min-h-11 rounded-xl border px-4 text-xs font-semibold ${layout === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface'}`}
          >
            {value === 'TABLE' ? 'Table view' : 'Card view'}
          </button>
        ))}
      </div>
      {query.error ? (
        <p role="alert" className="p-6 text-rose-600">
          {errorMessage(query.error)} <button onClick={() => query.refetch()}>Retry</button>
        </p>
      ) : layout === 'CARDS' ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {query.data?.items.map((item) => {
            const phone = item.contacts?.find((c) => c.phone)?.phone ?? item.ownerPhone;
            return (
              <article
                key={item.id}
                onClick={() => setViewing(item)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-sm transition-all hover:border-brand-500/40 hover:shadow-md cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                      {item.purpose || 'RENT'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          item.availability === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.availability === 'RENTED' || item.availability === 'SOLD'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {item.availability || 'UNKNOWN'}
                      </span>
                      {item.matchingLeadsCount != null && item.matchingLeadsCount > 0 && (
                        <span
                          className="inline-flex items-center rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700"
                          title={`${item.matchingLeadsCount} leads match`}
                        >
                          🔥 {item.matchingLeadsCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <h3 className="font-display text-base font-bold text-fg group-hover:text-brand-600 transition-colors">
                      {inventoryTitle(item)}
                    </h3>
                    <p className="text-xs text-muted font-medium">{item.sector || 'Locality not recorded'}</p>
                  </div>

                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="font-display text-lg font-bold tracking-tight text-fg">
                      {inventoryPrice(item)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {[
                      item.bhk ? `${item.bhk} ${item.roomKind || 'BHK'}` : null,
                      item.floor ? floorLabel(item.floor) : null,
                      item.area != null ? `${item.area} ${item.areaUnit ?? 'sq ft'}` : null,
                      item.furnishing ? readableValue(item.furnishing) : null,
                    ]
                      .filter(Boolean)
                      .map((val, i) => (
                        <span key={i} className="rounded-lg bg-surface-2 px-2 py-0.5 text-[11px] text-muted font-medium">
                          {val}
                        </span>
                      ))}
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                      {(item.assignedTo?.name || item.createdBy?.name || 'U').charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate font-medium">
                      {item.assignedTo?.name || (item.createdById === user?.id ? 'You' : item.createdBy?.name || 'Unassigned')}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-line pt-2.5" onClick={(e) => e.stopPropagation()}>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      aria-label={`Select property ${item.houseNo ?? item.id}`}
                      checked={selected.includes(item.id)}
                      onChange={() => setSelected(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])}
                    />
                    <span>{item.sourceType === 'PDF_REGISTER' ? 'Register' : readableValue(item.sourceType)}</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {phone && (
                      <a
                        href={`https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-line bg-surface p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="WhatsApp Owner"
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => setViewing(item)}
                      className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
                    >
                      Details →
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="border-b border-line bg-surface-2 text-muted">
              <tr>
                <th className="py-2.5 px-3 w-8">
                  <input
                    aria-label="Select this page"
                    type="checkbox"
                    checked={!!query.data?.items.length && query.data.items.every((i) => selected.includes(i.id))}
                    onChange={(e) => setSelected(e.target.checked ? query.data!.items.map((i) => i.id) : [])}
                  />
                </th>
                {[
                  ['Property', 'houseNo'],
                  ['Locality', 'sector'],
                  ['Config', ''],
                  ['Price', 'monthlyRent'],
                  ['Assignee', ''],
                  ['Availability', 'availability'],
                  ['Contact', ''],
                  ['Actions', ''],
                ].map(([label, key]) => (
                  <th key={label} className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">
                    <button
                      disabled={!key}
                      onClick={() => setSort({ sortBy: key, sortOrder: sort.sortBy === key && sort.sortOrder === 'asc' ? 'desc' : 'asc' })}
                    >
                      {label}
                      {key === sort.sortBy ? (sort.sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {query.data?.items.map((item) => {
                const phone = item.contacts?.find((c) => c.phone)?.phone ?? item.ownerPhone;
                return (
                  <tr
                    key={item.id}
                    onClick={() => setViewing(item)}
                    className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        aria-label={`Select property ${item.houseNo ?? item.id}`}
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={(e) => setSelected(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
                      />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-brand-600 group-hover:underline">
                          {item.houseNo || '—'}
                          {item.unitLabel && ` · ${item.unitLabel}`}
                        </span>
                        {item.floor && <span className="text-[11px] text-muted">({floorLabel(item.floor)})</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{item.sector || '—'}</span>
                        {item.purpose && (
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
                            {item.purpose}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span>{item.bhk ? `${item.bhk} BHK` : '—'}</span>
                      {item.furnishing && (
                        <span className="ml-1 text-[11px] text-muted">· {item.furnishing.replace(/_/g, ' ').toLowerCase()}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-semibold">
                      {item.purpose === 'RENT' && item.monthlyRent != null
                        ? `${formatINR(item.monthlyRent)}/mo`
                        : item.totalSalePrice != null
                          ? formatINR(item.totalSalePrice)
                          : item.ratePerArea != null
                            ? `${formatINR(item.ratePerArea)}/${item.rateAreaUnit}`
                            : '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                          {(item.assignedTo?.name || item.createdBy?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[110px] text-xs font-medium" title={item.assignedTo?.name || item.createdBy?.name || 'Unassigned'}>
                          {item.assignedTo?.name || (item.createdById === user?.id ? 'You' : item.createdBy?.name || 'Unassigned')}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            item.availability === 'AVAILABLE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.availability === 'RENTED' || item.availability === 'SOLD'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {item.availability || 'UNKNOWN'}
                        </span>
                        {item.matchingLeadsCount != null && item.matchingLeadsCount > 0 && (
                          <span
                            className="inline-flex items-center rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700"
                            title={`${item.matchingLeadsCount} leads match`}
                          >
                            🔥 {item.matchingLeadsCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {phone ? (
                        <div className="flex items-center gap-2">
                          <a href={`tel:${phone}`} aria-label={`Call ${phone}`} className="text-muted hover:text-brand-600">
                            <Phone size={13} />
                          </a>
                          <span className="text-xs">{phone}</span>
                          <a
                            href={`https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`WhatsApp ${phone}`}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            <MessageCircle size={13} />
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button className="font-semibold text-brand-600 hover:underline" onClick={() => setPublishing(item)}>
                        Publish ↗
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {query.isLoading && <p className="p-8 text-center text-muted">Loading inventory…</p>}
          {query.data?.total === 0 && (
            <div className="p-10 text-center">
              <h2 className="font-semibold">No properties match</h2>
              <p className="mt-2 text-sm text-muted">Change filters, import a source or add a property.</p>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span>
          {query.data?.total ?? 0} records · Page {page}
        </span>
        <div className="flex gap-4">
          <button
            disabled={page === 1}
            onClick={() => {
              setSelected([]);
              setPage(page - 1);
            }}
          >
            Previous
          </button>
          <button
            disabled={!query.data || page >= query.data.totalPages}
            onClick={() => {
              setSelected([]);
              setPage(page + 1);
            }}
          >
            Next
          </button>
        </div>
      </div>
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)} title={viewing ? inventoryTitle(viewing) : 'Property details'} size="xl">
        {viewing && (
          <InventoryDetails
            item={viewing}
            onEdit={() => {
              setEditing(viewing);
              setViewing(null);
            }}
            onPublish={() => {
              setPublishing(viewing);
              setViewing(null);
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!publishing} onOpenChange={(v) => !v && setPublishing(null)} title="Publish rental listing" size="lg">
        {publishing && (
          <PublicPublish
            key={publishing.id}
            item={publishing}
            onDone={() => {
              setPublishing(null);
              refresh();
              toast.success('Submitted for Admin review');
            }}
          />
        )}
      </Dialog>
      <Dialog open={filterOpen} onOpenChange={setFilterOpen} title="Filter inventory">
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(fields).map(([name, choices]) => (
            <label key={name} className="text-xs font-semibold">
              {INVENTORY_FILTER_LABELS[name] ?? name}
              <select
                value={(filters as any)[name]}
                onChange={(e) => setFilters({ ...filters, [name]: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5"
              >
                <option value="">All</option>
                {choices.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {['minBudget', 'maxBudget', 'minArea', 'maxArea'].map((name) => (
            <label key={name} className="text-xs font-semibold">
              {INVENTORY_FILTER_LABELS[name] ?? name}
              <input
                type="number"
                min={0}
                value={(filters as any)[name]}
                onChange={(e) => setFilters({ ...filters, [name]: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-line bg-surface p-2.5"
              />
            </label>
          ))}
        </div>
        <AdvancedFilters filters={filters} onChange={setFilters} />
        <button onClick={() => setFilterOpen(false)} className="mt-5 rounded-xl bg-brand-600 px-5 py-2 text-white">
          Show results
        </button>
      </Dialog>
      <Dialog
        open={adding || !!editing}
        onOpenChange={(value) => {
          if (!value) {
            if (dirty && !window.confirm('Discard unsaved property changes?')) return;
            setDirty(false);
            setAdding(false);
            setEditing(null);
          }
        }}
        title={editing ? `Property ${editing.houseNo || ''}` : 'Add property'}
        size="lg"
      >
        {editing?.sourceEntry && (
          <div className="mb-5 rounded-xl bg-surface-2 p-4">
            <Link href={`/broker/imports/${editing.sourceEntry.batch?.id}`} className="font-semibold text-brand-600">
              View source · Page {editing.pageNo ?? '—'}
            </Link>
            <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{editing.sourceEntry.rawText}</p>
          </div>
        )}
        {(adding || editing) && (
          <PropertyForm
            key={editing?.id ?? 'new'}
            initial={editing ?? {}}
            onDirty={() => setDirty(true)}
            onSave={async (input) => {
              await api(editing ? `/inventory/${editing.id}` : '/inventory', { method: editing ? 'PATCH' : 'POST', body: input });
              setDirty(false);
              setAdding(false);
              setEditing(null);
              await refresh();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
