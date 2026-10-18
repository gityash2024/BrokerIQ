'use client';
import { InventoryDetails } from '@/components/broker/launch/inventory-details';
import { PublicPublish } from '@/components/broker/launch/public-publish';
import { inventoryTitle, inventoryPrice, readableValue, floorLabel } from '@brokeriq/shared';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, SlidersHorizontal, Search, X, Phone, MessageCircle } from 'lucide-react';
import { type LedgerItem, type PagedLedger, INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES, INVENTORY_FILTER_LABELS, formatINR } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
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
};
export default function LedgerPage() {
  return (
    <Suspense>
      <LedgerInner />
    </Suspense>
  );
}
function LedgerInner() {
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
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          ['Records', stats.data?.total],
          ['Available', stats.data?.available],
          ['Availability unknown', stats.data?.unknown],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-xl font-bold">{value == null ? '—' : Number(value).toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>
      <div className="mb-3 flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
          <Search size={17} className="text-muted" />
          <input
            aria-label="Search inventory"
            placeholder="House, locality, contact or notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button onClick={() => setFilterOpen(true)} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold">
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data?.items.map((item) => (
            <article key={item.id} className="card overflow-hidden">
              <button onClick={() => setViewing(item)} className="block w-full p-5 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{item.purpose || 'Private inventory'}</p>
                    <h2 className="mt-2 font-display text-xl font-bold">{inventoryTitle(item)}</h2>
                    <p className="mt-1 text-sm text-muted">{item.sector || 'Locality not recorded'}</p>
                  </div>
                  <span className="rounded-lg bg-surface-2 px-2 py-1 text-[10px]">{readableValue(item.availability ?? 'UNKNOWN')}</span>
                </div>
                {!!item.photoUrls?.[0] && (
                  <img src={item.photoUrls[0]} alt="Property photograph" className="mt-4 aspect-[16/9] w-full rounded-xl object-cover" loading="lazy" />
                )}
                <div className="my-4 flex flex-wrap gap-2">
                  {[
                    item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : 'Rooms not recorded',
                    floorLabel(item.floor),
                    item.area != null ? `${item.area} ${item.areaUnit}` : null,
                    item.furnishing && readableValue(item.furnishing),
                  ]
                    .filter(Boolean)
                    .map((value, i) => (
                      <span key={i} className="rounded-lg bg-surface-2 px-2 py-1.5 text-xs text-muted">
                        {value}
                      </span>
                    ))}
                </div>
                <p className="font-display text-xl font-bold">{inventoryPrice(item)}</p>
              </button>
              <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-5 py-3">
                <label className="flex min-h-11 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    aria-label={`Select property ${item.houseNo ?? item.id}`}
                    checked={selected.includes(item.id)}
                    onChange={() => setSelected(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])}
                  />
                  {item.sourceType === 'PDF_REGISTER' ? 'Register' : readableValue(item.sourceType)}
                  {item.pageNo ? ` · P.${item.pageNo}` : ''}
                </label>
                <button onClick={() => setViewing(item)} className="min-h-11 text-xs font-bold text-brand-600">
                  View details →
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="border-b border-line bg-surface-2">
              <tr>
                <th className="p-3">
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
                  ['Configuration', ''],
                  ['Price', 'monthlyRent'],
                  ['Availability', 'availability'],
                  ['Contact', ''],
                  ['Source', ''],
                ].map(([label, key]) => (
                  <th key={label} className="p-3">
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
                  <tr key={item.id} className="hover:bg-surface-2/50">
                    <td className="p-3">
                      <input
                        aria-label={`Select property ${item.houseNo ?? item.id}`}
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={(e) => setSelected(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
                      />
                    </td>
                    <td className="p-3">
                      <button onClick={() => setViewing(item)} className="text-left font-semibold text-brand-600">
                        {item.houseNo || 'House not recorded'}
                        {item.unitLabel && ` · ${item.unitLabel}`}
                      </button>
                      <p className="mt-1 text-muted">{floorLabel(item.floor)}</p>
                    </td>
                    <td className="p-3">
                      {item.sector || 'Locality unknown'}
                      <p className="mt-1 text-muted">{item.purpose ?? 'Purpose unknown'}</p>
                    </td>
                    <td className="p-3">
                      {item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : 'Rooms unknown'}
                      <p className="mt-1 text-muted">{item.furnishing?.replace(/_/g, ' ') || 'Furnishing unknown'}</p>
                    </td>
                    <td className="p-3 font-semibold">
                      {item.purpose === 'RENT' && item.monthlyRent != null
                        ? `${formatINR(item.monthlyRent)}/mo`
                        : item.totalSalePrice != null
                          ? formatINR(item.totalSalePrice)
                          : item.ratePerArea != null
                            ? `${formatINR(item.ratePerArea)}/${item.rateAreaUnit}`
                            : 'Price not recorded'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 ${item.availability === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
                      >
                        {item.availability || 'UNKNOWN'}
                      </span>
                      <p className="mt-2 text-muted">{item.status}</p>
                      <button className="mt-2 min-h-9 font-semibold text-brand-600" onClick={() => setPublishing(item)}>
                        Publish / review ↗
                      </button>
                    </td>
                    <td className="p-3">
                      {phone ? (
                        <div className="flex items-center gap-2">
                          <a href={`tel:${phone}`} aria-label={`Call ${phone}`}>
                            <Phone size={14} />
                          </a>
                          <span>{phone}</span>
                          <a href={`https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${phone}`}>
                            <MessageCircle size={14} />
                          </a>
                        </div>
                      ) : (
                        'Not recorded'
                      )}
                      {item.contacts?.length > 1 && <p className="mt-1 text-muted">{item.contacts.length} contacts</p>}
                    </td>
                    <td className="p-3">
                      {item.sourceType}
                      {item.pageNo && <p className="mt-1 text-muted">Page {item.pageNo}</p>}
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
