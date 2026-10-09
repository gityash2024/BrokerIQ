'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  Filter,
  Layers,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Rocket,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { del, patch, post, useApiMutation, useDebounced } from '@/lib/hooks';
import { cn, formatDate, qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  sector: string;
  houseNo: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  propertyType?: string | null;
  purpose: string;
  bhk?: number | null;
  floor?: string | null;
  furnishing?: string | null;
  rent?: number | null;
  securityDeposit?: number | null;
  brokerage?: string | null;
  tenantPreference?: string | null;
  notes?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'RENTED';
  date: string;
  pageNo?: number | null;
  isPublished: boolean;
  publishedListingId?: string | null;
  organizationId: string;
  organization?: { id: string; name: string; slug: string };
}

const STATUS_TONES: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  RENTED: 'info',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft / Incomplete',
  ACTIVE: 'Active / Ready',
  RENTED: 'Rented',
};

export default function AdminInventoryPage() {
  const [filters, setFilters] = useState({
    search: '',
    organizationId: '',
    sector: '',
    houseNo: '',
    bhk: '',
    status: '',
    purpose: '',
    furnishing: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    pageSize: 15,
  });

  const debouncedSearch = useDebounced(filters.search, 300);
  const debouncedHouseNo = useDebounced(filters.houseNo, 300);

  // Fetch Organizations for dropdown
  const orgsQuery = useQuery({
    queryKey: ['admin-inventory-orgs'],
    queryFn: () => api<{ items: { id: string; name: string }[] }>('/admin/organizations?pageSize=100'),
    staleTime: 60_000,
  });

  // Fetch Sectors for dropdown
  const sectorsQuery = useQuery({
    queryKey: ['admin-inventory-sectors', filters.organizationId],
    queryFn: () =>
      api<{ sector: string; count: number }[]>(
        `/inventory/sectors${filters.organizationId ? `?organizationId=${filters.organizationId}` : ''}`
      ),
    staleTime: 60_000,
  });

  // Fetch Inventory items
  const queryParams = {
    ...filters,
    search: debouncedSearch,
    houseNo: debouncedHouseNo,
  };

  const inventoryQuery = useQuery({
    queryKey: ['admin-inventory', queryParams],
    queryFn: () =>
      api<{
        items: InventoryItem[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        statusCounts: { ALL: number; DRAFT: number; ACTIVE: number; RENTED: number };
      }>(`/inventory${qs(queryParams)}`),
  });

  // Modal State
  const [editItem, setEditItem] = useState<Partial<InventoryItem> | null>(null);

  // Mutations
  const saveMutation = useApiMutation(
    (item: Partial<InventoryItem>) => {
      if (item.id) {
        return patch(`/inventory/${item.id}`, item);
      }
      return post('/inventory', item);
    },
    {
      success: 'इन्वेंटरी रो सफलतापूर्वक अपडेट हो गई',
      invalidate: [['admin-inventory'], ['admin-inventory-sectors']],
      onSuccess: () => setEditItem(null),
    },
  );

  const deleteMutation = useApiMutation((id: string) => del(`/inventory/${id}`), {
    success: 'रो हटा दी गई',
    invalidate: [['admin-inventory'], ['admin-inventory-sectors']],
  });

  const publishMutation = useApiMutation((id: string) => post(`/inventory/${id}/publish`), {
    success: 'प्रॉपर्टी मार्केटप्लेस पर लाइव पब्लिश हो गई!',
    invalidate: [['admin-inventory']],
  });

  const data = inventoryQuery.data;
  const statusCounts = data?.statusCounts ?? { ALL: 0, DRAFT: 0, ACTIVE: 0, RENTED: 0 };

  const handleExportCSV = () => {
    if (!data?.items?.length) {
      toast.error('एक्सपोर्ट के लिए कोई डेटा नहीं है');
      return;
    }
    const headers = [
      'Firm',
      'Page',
      'Date',
      'Sector',
      'House No',
      'BHK',
      'Floor',
      'Rent (₹)',
      'Furnishing',
      'Tenant Pref',
      'Brokerage',
      'Owner Phone',
      'Status',
    ];
    const rows = data.items.map((i) => [
      `"${i.organization?.name || ''}"`,
      i.pageNo ? `P.${i.pageNo}` : '',
      i.date ? new Date(i.date).toLocaleDateString('en-IN') : '',
      `"${i.sector}"`,
      `"${i.houseNo}"`,
      i.bhk ?? '',
      `"${i.floor ?? ''}"`,
      i.rent ?? '',
      i.furnishing ?? '',
      `"${i.tenantPreference ?? ''}"`,
      `"${i.brokerage ?? ''}"`,
      `"${i.ownerPhone ?? ''}"`,
      i.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `admin_inventory_${filters.sector || 'all'}_p${filters.page}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV फाइल डाउनलोड हो गई');
  };

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.organizationId ||
      filters.sector ||
      filters.houseNo ||
      filters.bhk ||
      filters.status ||
      filters.purpose ||
      filters.furnishing ||
      filters.dateFrom ||
      filters.dateTo
  );

  const resetFilters = () => {
    setFilters({
      search: '',
      organizationId: '',
      sector: '',
      houseNo: '',
      bhk: '',
      status: '',
      purpose: '',
      furnishing: '',
      dateFrom: '',
      dateTo: '',
      page: 1,
      pageSize: 15,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broker Inventories & Property Ledgers"
        subtitle="सभी ब्रोकर्स की डायरी/रजिस्टर का पूर्ण डेटा — फर्म-वाइज फिल्टर, ऑडिट, एडिट और मार्केटप्लेस मॉडरेशन"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleExportCSV}>
              <Download className="size-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Top Stat KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => setFilters((f) => ({ ...f, status: '', page: 1 }))}
          className={cn(
            'card p-4 text-left transition hover:border-brand-400',
            filters.status === '' && 'border-brand-500 bg-brand-50/30 dark:bg-brand-500/10'
          )}
        >
          <p className="text-xs font-semibold text-muted uppercase">Total Inventory</p>
          <p className="mt-1 font-display text-2xl font-bold text-fg">{statusCounts.ALL.toLocaleString()}</p>
          <p className="mt-1 text-xs text-subtle">सभी ब्रोकर्स का कुल डेटा</p>
        </button>

        <button
          onClick={() => setFilters((f) => ({ ...f, status: 'DRAFT', page: 1 }))}
          className={cn(
            'card p-4 text-left transition hover:border-amber-400',
            filters.status === 'DRAFT' && 'border-amber-500 bg-amber-50/30 dark:bg-amber-500/10'
          )}
        >
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">Draft / Incomplete</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-700 dark:text-amber-300">
            {statusCounts.DRAFT.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-subtle">विवरण अधूरा है</p>
        </button>

        <button
          onClick={() => setFilters((f) => ({ ...f, status: 'ACTIVE', page: 1 }))}
          className={cn(
            'card p-4 text-left transition hover:border-emerald-400',
            filters.status === 'ACTIVE' && 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-500/10'
          )}
        >
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Active / Ready</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {statusCounts.ACTIVE.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-subtle">लाइव मार्केटप्लेस योग्य</p>
        </button>

        <button
          onClick={() => setFilters((f) => ({ ...f, status: 'RENTED', page: 1 }))}
          className={cn(
            'card p-4 text-left transition hover:border-sky-400',
            filters.status === 'RENTED' && 'border-sky-500 bg-sky-50/30 dark:bg-sky-500/10'
          )}
        >
          <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase">Rented</p>
          <p className="mt-1 font-display text-2xl font-bold text-sky-700 dark:text-sky-300">
            {statusCounts.RENTED.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-subtle">किराए पर लग चुकी प्रॉपर्टीज</p>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card space-y-3 p-4">
        {/* Row 1: Global Search & Broker Org Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
            <Input
              className="h-10 pl-10"
              placeholder="Search House No, Phone, Notes..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            />
            {filters.search && (
              <button
                onClick={() => setFilters((f) => ({ ...f, search: '', page: 1 }))}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Broker Org Dropdown */}
          <div className="w-full sm:w-64">
            <Select
              className="h-10 text-xs font-medium"
              value={filters.organizationId}
              onChange={(e) => setFilters((f) => ({ ...f, organizationId: e.target.value, sector: '', page: 1 }))}
            >
              <option value="">All Broker Firms</option>
              {orgsQuery.data?.items?.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Quick Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {['', 'DRAFT', 'ACTIVE', 'RENTED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilters((f) => ({ ...f, status: st, page: 1 }))}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  filters.status === st
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg'
                )}
              >
                {st === '' ? `All (${statusCounts.ALL})` : `${STATUS_LABELS[st]} (${statusCounts[st as keyof typeof statusCounts]})`}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Secondary Filters */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase">Sector</label>
            <Select
              className="mt-1 h-9 text-xs"
              value={filters.sector}
              onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value, page: 1 }))}
            >
              <option value="">All Sectors</option>
              {sectorsQuery.data?.map((s) => (
                <option key={s.sector} value={s.sector}>
                  {s.sector} ({s.count})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted uppercase">House No</label>
            <Input
              className="mt-1 h-9 text-xs"
              placeholder="e.g. 756 or 1157"
              value={filters.houseNo}
              onChange={(e) => setFilters((f) => ({ ...f, houseNo: e.target.value, page: 1 }))}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted uppercase">BHK</label>
            <Select
              className="mt-1 h-9 text-xs"
              value={filters.bhk}
              onChange={(e) => setFilters((f) => ({ ...f, bhk: e.target.value, page: 1 }))}
            >
              <option value="">All BHK</option>
              <option value="1">1 BHK</option>
              <option value="2">2 BHK</option>
              <option value="3">3 BHK</option>
              <option value="4">4 BHK</option>
              <option value="5">5+ BHK</option>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted uppercase">Furnishing</label>
            <Select
              className="mt-1 h-9 text-xs"
              value={filters.furnishing}
              onChange={(e) => setFilters((f) => ({ ...f, furnishing: e.target.value, page: 1 }))}
            >
              <option value="">All Furnishing</option>
              <option value="SEMI_FURNISHED">Semi Furnished</option>
              <option value="FULLY_FURNISHED">Fully Furnished</option>
              <option value="UNFURNISHED">Unfurnished</option>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted uppercase">Purpose</label>
            <Select
              className="mt-1 h-9 text-xs"
              value={filters.purpose}
              onChange={(e) => setFilters((f) => ({ ...f, purpose: e.target.value, page: 1 }))}
            >
              <option value="">Rent & Sale</option>
              <option value="RENT">Rent Only</option>
              <option value="SALE">Sale Only</option>
            </Select>
          </div>

          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-muted uppercase">Rows / Page</label>
              <Select
                className="mt-1 h-9 text-xs"
                value={String(filters.pageSize)}
                onChange={(e) => setFilters((f) => ({ ...f, pageSize: Number(e.target.value), page: 1 }))}
              >
                <option value="15">15 rows</option>
                <option value="25">25 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" className="h-9 px-2 text-xs" onClick={resetFilters} title="Clear all filters">
                <X className="size-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-line text-xs text-muted">
          <span className="font-semibold flex items-center gap-1">
            <Calendar className="size-3.5" /> Date Added / Ledger Date:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Date From"
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-fg"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))}
            />
            <span>to</span>
            <input
              type="date"
              aria-label="Date To"
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-fg"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))}
            />
          </div>
          {(filters.dateFrom || filters.dateTo) && (
            <button
              onClick={() => setFilters((f) => ({ ...f, dateFrom: '', dateTo: '', page: 1 }))}
              className="text-subtle hover:text-fg text-xs underline"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Data Table */}
      {inventoryQuery.isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : inventoryQuery.isError ? (
        <ApiErrorState error={inventoryQuery.error} onRetry={() => inventoryQuery.refetch()} />
      ) : !data?.items?.length ? (
        <Empty
          icon={<Layers className="size-8 text-subtle" />}
          title="कोई इन्वेंटरी रिकॉर्ड नहीं मिला"
          text="फिल्टर बदलें या ब्रोकर्स के डायरी डेटा के आने की प्रतीक्षा करें।"
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left text-xs">
              <thead className="border-b border-line bg-surface-2 text-subtle font-semibold uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-3 py-3 w-12"># / P.</th>
                  <th className="px-3 py-3 w-32">Broker Firm</th>
                  <th className="px-3 py-3 w-28">Date</th>
                  <th className="px-3 py-3 w-32">Sector</th>
                  <th className="px-3 py-3 w-28 font-bold">House No</th>
                  <th className="px-3 py-3 w-24">BHK · Floor</th>
                  <th className="px-3 py-3 w-28">Rent / Price</th>
                  <th className="px-3 py-3 w-28">Furnishing</th>
                  <th className="px-3 py-3 w-28">Tenant Pref</th>
                  <th className="px-3 py-3 w-24">Brokerage</th>
                  <th className="px-3 py-3 w-36">Owner Contact</th>
                  <th className="px-3 py-3 w-28 text-center">Status</th>
                  <th className="px-3 py-3 w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((row, idx) => {
                  const serial = (data.page - 1) * data.pageSize + idx + 1;
                  return (
                    <tr
                      key={row.id}
                      className="group transition-colors hover:bg-brand-50/40 dark:hover:bg-brand-500/10"
                    >
                      {/* Serial */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-muted">
                        <span>{serial}.</span>
                        {row.pageNo && (
                          <span className="ml-1 inline-block rounded bg-surface-3 px-1 py-0.2 text-[10px] text-subtle">
                            P.{row.pageNo}
                          </span>
                        )}
                      </td>

                      {/* Broker Firm */}
                      <td className="px-3 py-2.5 font-medium text-fg whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[11px]">
                          <Building2 className="size-3 text-muted" />
                          {row.organization?.name || '—'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                        {row.date ? formatDate(row.date, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>

                      {/* Sector */}
                      <td className="px-3 py-2.5 font-semibold text-fg whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-xs">
                          <MapPin className="size-3 text-brand-500" />
                          {row.sector}
                        </span>
                      </td>

                      {/* House No */}
                      <td className="px-3 py-2.5 font-bold text-fg">
                        <span className="font-mono text-sm tracking-tight text-brand-700 dark:text-brand-300">
                          {row.houseNo}
                        </span>
                      </td>

                      {/* BHK & Floor */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-fg">
                        {row.bhk ? (
                          <span className="font-semibold">{row.bhk} BHK</span>
                        ) : (
                          <span className="text-subtle italic">BHK N/A</span>
                        )}
                        {row.floor && <span className="text-muted ml-1 font-normal">({row.floor})</span>}
                      </td>

                      {/* Rent */}
                      <td className="px-3 py-2.5 font-semibold text-fg whitespace-nowrap">
                        {row.rent ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {formatINR(row.rent)}
                            <span className="text-[10px] font-normal text-muted">/mo</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 text-[11px] italic">Not set</span>
                        )}
                        {row.purpose === 'SALE' && (
                          <span className="ml-1 rounded bg-rose-50 px-1 text-[10px] text-rose-600">SALE</span>
                        )}
                      </td>

                      {/* Furnishing */}
                      <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                        {row.furnishing ? (
                          <span>{row.furnishing.replace(/_/g, ' ')}</span>
                        ) : (
                          <span className="text-subtle italic">—</span>
                        )}
                      </td>

                      {/* Tenant Preference */}
                      <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                        {row.tenantPreference || '—'}
                      </td>

                      {/* Brokerage */}
                      <td className="px-3 py-2.5 text-muted whitespace-nowrap font-mono text-[11px]">
                        {row.brokerage || '—'}
                      </td>

                      {/* Owner Contact */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {row.ownerPhone ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${row.ownerPhone}`}
                              className="font-mono font-medium text-brand-600 hover:underline flex items-center gap-1"
                              title="Call Owner"
                            >
                              <Phone className="size-3" />
                              {row.ownerPhone}
                            </a>
                            <a
                              href={`https://wa.me/91${row.ownerPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-emerald-600 hover:underline"
                              title="WhatsApp"
                            >
                              WA
                            </a>
                          </div>
                        ) : (
                          <span className="text-subtle italic">No phone</span>
                        )}
                        {row.ownerName && (
                          <p className="text-[10px] text-subtle truncate max-w-[120px]">{row.ownerName}</p>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <Badge tone={STATUS_TONES[row.status] || 'neutral'}>
                          {STATUS_LABELS[row.status] || row.status}
                        </Badge>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {row.isPublished ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                              title="Published to Marketplace"
                            >
                              <CheckCircle2 className="size-3" /> Published
                            </span>
                          ) : (
                            <Button
                              size="xs"
                              variant="secondary"
                              className="h-7 px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300"
                              onClick={() => publishMutation.mutate(row.id)}
                              loading={publishMutation.isPending}
                              title="Super Admin override: Publish directly to marketplace"
                            >
                              <Rocket className="size-3 mr-1" /> Publish
                            </Button>
                          )}

                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-7 w-7 text-muted hover:text-fg"
                            onClick={() => setEditItem(row)}
                            title="Edit row details"
                          >
                            <Pencil className="size-3.5" />
                          </Button>

                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-7 w-7 text-subtle hover:text-rose-600"
                            onClick={() => {
                              if (confirm(`क्या आप House ${row.houseNo}, ${row.sector} को हटाना चाहते हैं?`)) {
                                deleteMutation.mutate(row.id);
                              }
                            }}
                            title="Delete row"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer & Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-4 py-3 text-xs">
            <span className="text-muted">
              Showing {Math.min(data.total, (data.page - 1) * data.pageSize + 1)} to{' '}
              {Math.min(data.total, data.page * data.pageSize)} of <strong className="text-fg">{data.total}</strong> entries
            </span>

            <div className="flex items-center gap-2">
              <span className="text-muted">
                Page {data.page} of {data.totalPages || 1}
              </span>
              <Button
                size="xs"
                variant="secondary"
                disabled={data.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                size="xs"
                variant="secondary"
                disabled={data.page >= data.totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Inventory Dialog */}
      <Dialog
        open={Boolean(editItem)}
        onOpenChange={(open) => !open && setEditItem(null)}
        title={`Edit Row — House ${editItem?.houseNo || ''}, ${editItem?.sector || ''}`}
        description="इस इन्वेंटरी रिकॉर्ड के विवरण अपडेट करें।"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editItem && saveMutation.mutate(editItem)}
              loading={saveMutation.isPending}
            >
              Save Changes
            </Button>
          </>
        }
      >
        {editItem && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sector / Locality" required>
              <Input
                value={editItem.sector || ''}
                onChange={(e) => setEditItem({ ...editItem, sector: e.target.value })}
                placeholder="e.g. Sector 43, Sushant Lok 1"
              />
            </Field>

            <Field label="House / Plot No" required>
              <Input
                value={editItem.houseNo || ''}
                onChange={(e) => setEditItem({ ...editItem, houseNo: e.target.value })}
                placeholder="e.g. 756, 1157, B-12"
              />
            </Field>

            <Field label="BHK">
              <Select
                value={String(editItem.bhk ?? '')}
                onChange={(e) => setEditItem({ ...editItem, bhk: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Select BHK</option>
                <option value="1">1 BHK</option>
                <option value="2">2 BHK</option>
                <option value="3">3 BHK</option>
                <option value="4">4 BHK</option>
                <option value="5">5 BHK</option>
                <option value="6">6+ BHK</option>
              </Select>
            </Field>

            <Field label="Floor">
              <Input
                value={editItem.floor || ''}
                onChange={(e) => setEditItem({ ...editItem, floor: e.target.value })}
                placeholder="e.g. GF, 1st, 2nd, 3rd, 4th, Entire"
              />
            </Field>

            <Field label="Monthly Rent (₹)">
              <Input
                type="number"
                value={editItem.rent ?? ''}
                onChange={(e) => setEditItem({ ...editItem, rent: e.target.value ? Number(e.target.value) : null })}
                placeholder="e.g. 35000"
              />
            </Field>

            <Field label="Security Deposit (₹)">
              <Input
                type="number"
                value={editItem.securityDeposit ?? ''}
                onChange={(e) =>
                  setEditItem({ ...editItem, securityDeposit: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="e.g. 70000"
              />
            </Field>

            <Field label="Furnishing">
              <Select
                value={editItem.furnishing || 'SEMI_FURNISHED'}
                onChange={(e) => setEditItem({ ...editItem, furnishing: e.target.value })}
              >
                <option value="UNFURNISHED">Unfurnished</option>
                <option value="SEMI_FURNISHED">Semi Furnished (SFD)</option>
                <option value="FULLY_FURNISHED">Fully Furnished (FFD)</option>
              </Select>
            </Field>

            <Field label="Purpose">
              <Select
                value={editItem.purpose || 'RENT'}
                onChange={(e) => setEditItem({ ...editItem, purpose: e.target.value })}
              >
                <option value="RENT">Rent</option>
                <option value="SALE">Sale</option>
              </Select>
            </Field>

            <Field label="Tenant Preference">
              <Input
                value={editItem.tenantPreference || ''}
                onChange={(e) => setEditItem({ ...editItem, tenantPreference: e.target.value })}
                placeholder="e.g. Family only (FLY), Any, Corporate"
              />
            </Field>

            <Field label="Brokerage / Commission">
              <Input
                value={editItem.brokerage || ''}
                onChange={(e) => setEditItem({ ...editItem, brokerage: e.target.value })}
                placeholder="e.g. 15D (15 Days), 1M (1 Month)"
              />
            </Field>

            <Field label="Owner Name">
              <Input
                value={editItem.ownerName || ''}
                onChange={(e) => setEditItem({ ...editItem, ownerName: e.target.value })}
                placeholder="e.g. Sharma Ji"
              />
            </Field>

            <Field label="Owner Phone Number">
              <Input
                value={editItem.ownerPhone || ''}
                onChange={(e) => setEditItem({ ...editItem, ownerPhone: e.target.value })}
                placeholder="e.g. 9811XXXXXX"
              />
            </Field>

            <Field label="Status">
              <Select
                value={editItem.status || 'DRAFT'}
                onChange={(e) => setEditItem({ ...editItem, status: e.target.value as any })}
              >
                <option value="DRAFT">DRAFT (Missing info / Incomplete)</option>
                <option value="ACTIVE">ACTIVE (Ready to publish / Live)</option>
                <option value="RENTED">RENTED (Already rented)</option>
              </Select>
            </Field>

            <Field label="Ledger Date">
              <Input
                type="date"
                value={editItem.date ? new Date(editItem.date).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditItem({ ...editItem, date: e.target.value })}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Additional Notes / Ledger Annotations">
                <Textarea
                  value={editItem.notes || ''}
                  onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
                  placeholder="e.g. 2 car parking, newly renovated, near metro..."
                  rows={3}
                />
              </Field>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
