'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Folder, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  hasDelegatedAccess,
  inventoryMonth,
  inventoryPrice,
  inventoryTitle,
  readableValue,
  type InventoryFolder,
  type InventoryFolderMode,
  type InventoryFolders,
  type LedgerItem,
  type PagedLedger,
} from '@brokeriq/shared';
import { PageHeader } from '@/components/panel/shell';
import { LoadingArtwork } from '@/components/ui/request-loader';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { qs } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const initial = { sector: '', minBudget: '', maxBudget: '', dateFrom: '', dateTo: '' };
const inputClass = 'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm';

function AvailabilitySwitch({ active, label, disabled, onToggle }: { active: boolean; label: string; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="grid h-11 min-w-14 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-60"
    >
      <span className="relative h-8 w-14 rounded-lg border border-line bg-surface-2 shadow-inner">
        <span className={`absolute top-1 h-6 w-6 rounded-md shadow-sm transition-all ${active ? 'left-1 bg-brand-600' : 'left-7 bg-surface'}`} />
      </span>
    </button>
  );
}

export function InventoryFoldersPage() {
  const router = useRouter();
  const current = inventoryMonth();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [year, setYear] = useState(current.slice(0, 4));
  const [mode, setMode] = useState<InventoryFolderMode>('AVAILABLE');
  const [path, setPath] = useState<InventoryFolder[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const term = useDebounced(search);
  const shelf = {
    folderMode: mode,
    ...(term
      ? {}
      : mode === 'AVAILABLE'
        ? { folderYear: year, folderMonth: path[0]?.key, folderRoom: path[1]?.key, folderFurnishing: path[2]?.key }
        : { folderSector: path[0]?.key }),
  };
  const filter = {
    ...filters,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00+05:30').toISOString() : '',
    dateTo: filters.dateTo ? new Date(filters.dateTo + 'T23:59:59.999+05:30').toISOString() : '',
    search: term,
  };
  const leaf = Boolean(term) || mode === 'REVIEW' || path.length === (mode === 'AVAILABLE' ? 3 : 1);
  const folders = useQuery({
    queryKey: ['inventory-folders', user?.id, shelf, filter],
    queryFn: () => api<InventoryFolders>(`/inventory/folders${qs({ ...filter, ...shelf })}`),
    enabled: !!user,
  });
  const records = useQuery({
    queryKey: ['inventory-folder-items', user?.id, shelf, filter, page],
    queryFn: () => api<PagedLedger>(`/inventory${qs({ ...filter, ...shelf, page, pageSize: 30 })}`),
    enabled: !!user && leaf,
  });
  const canEdit = hasDelegatedAccess(user, 'inventory', 'edit');
  const canCapture = hasDelegatedAccess(user, 'inventory', 'create') && hasDelegatedAccess(user, 'inbox', 'view', 'create');
  const canCreate = hasDelegatedAccess(user, 'inventory', 'create');
  const folderMonth = mode === 'AVAILABLE' && path[0] ? path[0].key : current;
  const createUrl = `/broker/inventory/new${qs({ makeAvailable: '1', directoryMonth: folderMonth, folderRoom: mode === 'AVAILABLE' ? path[1]?.key : undefined, furnishing: mode === 'AVAILABLE' ? path[2]?.key : undefined })}`;
  const activeQuery = leaf ? records : folders;
  const advancedUrl = `/broker/inventory${qs({ view: 'ledger', ...filter, ...shelf })}`;

  function changePath(next: InventoryFolder[]) {
    setPath(next);
    setPage(1);
  }
  function setShelf(next: InventoryFolderMode) {
    setMode(next);
    changePath([]);
  }
  async function rentOut(item: LedgerItem) {
    if (
      busy ||
      !window.confirm(
        item.publishedListing?.status === 'ACTIVE' ? 'Mark this property rented out and withdraw its public listing?' : 'Mark this property rented out?',
      )
    )
      return;
    setBusy(item.id);
    try {
      await api(`/inventory/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: { status: 'RENTED', availability: 'RENTED', expectedRevision: item.revision },
      });
      await Promise.all(
        ['inventory-folders', 'inventory-folder-items', 'ledger', 'ledger-item', 'ledger-stats'].map((key) => qc.invalidateQueries({ queryKey: [key] })),
      );
      toast.success('Marked as rented out');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href="/broker/inventory?view=ledger" variant="secondary">
              All records
            </Button>
            {canCapture && (
              <Button href={`/broker/imports${qs({ target: 'INVENTORY', directoryMonth: folderMonth })}`} variant="secondary">
                Scan / WhatsApp import
              </Button>
            )}
            {canCreate && (
              <Button href={createUrl}>
                <Plus className="size-4" /> Add property
              </Button>
            )}
          </div>
        }
      />
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={mode === 'AVAILABLE' ? 'font-bold text-brand-600' : 'text-muted'}>Available</span>
          <AvailabilitySwitch
            active={mode === 'AVAILABLE'}
            label="Show available inventory"
            onToggle={() => setShelf(mode === 'AVAILABLE' ? 'RENTED' : 'AVAILABLE')}
          />
          <span className={mode !== 'AVAILABLE' ? 'font-bold text-brand-600' : 'text-muted'}>Rented out</span>
          {mode !== 'AVAILABLE' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={mode === 'RENTED' ? 'primary' : 'secondary'} onClick={() => setShelf('RENTED')}>
                Rented properties
              </Button>
              <Button size="sm" variant={mode === 'REVIEW' ? 'primary' : 'secondary'} onClick={() => setShelf('REVIEW')}>
                Needs verification
              </Button>
            </div>
          )}
          {mode === 'AVAILABLE' && (
            <label className="ml-auto flex items-center gap-2 text-sm">
              Year
              <select
                className="rounded-lg border border-line bg-surface p-2"
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                  changePath([]);
                }}
              >
                {(folders.data?.years ?? [year]).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <label className="relative xl:col-span-2">
            <span className="sr-only">Search inventory</span>
            <Search className="absolute left-3 top-3 size-4 text-muted" />
            <input
              className={inputClass + ' pl-9'}
              placeholder="Search house, sector or contact"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <input
            aria-label="Sector / locality"
            className={inputClass}
            placeholder="Sector / locality"
            value={filters.sector}
            onChange={(event) => {
              setFilters({ ...filters, sector: event.target.value });
              setPage(1);
            }}
          />
          <input
            aria-label="Minimum price"
            className={inputClass}
            type="number"
            min={0}
            placeholder="Min ₹"
            value={filters.minBudget}
            onChange={(event) => {
              setFilters({ ...filters, minBudget: event.target.value });
              setPage(1);
            }}
          />
          <input
            aria-label="Maximum price"
            className={inputClass}
            type="number"
            min={0}
            placeholder="Max ₹"
            value={filters.maxBudget}
            onChange={(event) => {
              setFilters({ ...filters, maxBudget: event.target.value });
              setPage(1);
            }}
          />
          <details className="rounded-xl border border-line px-3 py-2">
            <summary className="cursor-pointer text-sm">Record dates</summary>
            <label className="mt-2 block text-xs">
              From{' '}
              <input
                className={inputClass}
                type="date"
                value={filters.dateFrom}
                onChange={(event) => {
                  setFilters({ ...filters, dateFrom: event.target.value });
                  setPage(1);
                }}
              />
            </label>
            <label className="mt-2 block text-xs">
              Through{' '}
              <input
                className={inputClass}
                type="date"
                value={filters.dateTo}
                onChange={(event) => {
                  setFilters({ ...filters, dateTo: event.target.value });
                  setPage(1);
                }}
              />
            </label>
          </details>
          <Link href={advancedUrl} className="text-sm font-semibold text-brand-600 xl:col-span-6">
            Advanced filters
          </Link>
        </div>
      </div>
      <nav aria-label="Inventory folder path" className="flex flex-wrap items-center gap-2 text-sm">
        <button className="font-semibold text-brand-600" onClick={() => changePath([])}>
          {mode === 'AVAILABLE' ? year : readableValue(mode)}
        </button>
        {path.map((folder, index) => (
          <button className="text-muted hover:text-fg" key={folder.key} onClick={() => changePath(path.slice(0, index + 1))}>
            / {folder.label}
          </button>
        ))}
        {path.length > 0 && (
          <button aria-label="Parent folder" onClick={() => changePath(path.slice(0, -1))}>
            <ArrowLeft className="size-4" />
          </button>
        )}
      </nav>
      {activeQuery.isPending ? (
        <LoadingArtwork label="Loading inventory" />
      ) : activeQuery.isError ? (
        <ApiErrorState error={activeQuery.error} onRetry={() => activeQuery.refetch()} />
      ) : leaf ? (
        <>
          {!records.data?.items.length && <p className="rounded-2xl border border-line p-6 text-muted">No properties match this view.</p>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {records.data?.items.map((item) => (
              <article key={item.id} className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
                <div className="min-w-0">
                  <Link className="break-words font-semibold text-brand-600" href={`/broker/inventory/${encodeURIComponent(item.id)}`}>
                    {inventoryTitle(item)}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {inventoryPrice(item)} · {readableValue(item.availability ?? 'UNKNOWN')}
                  </p>
                </div>
                {canEdit && (
                  <AvailabilitySwitch
                    active={mode === 'AVAILABLE'}
                    label={mode === 'AVAILABLE' ? 'Mark property rented out' : 'Make property available'}
                    disabled={!!busy}
                    onToggle={() =>
                      mode === 'AVAILABLE' ? void rentOut(item) : router.push(`/broker/inventory/${encodeURIComponent(item.id)}/edit?makeAvailable=1`)
                    }
                  />
                )}
              </article>
            ))}
          </div>
          {(records.data?.totalPages ?? 0) > 1 && (
            <div className="flex items-center gap-3">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {records.data?.totalPages}
              </span>
              <Button variant="secondary" disabled={page >= (records.data?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {folders.data?.folders.map((folder) => (
            <button
              key={folder.key}
              onClick={() => changePath([...path, folder])}
              className="flex min-h-32 min-w-0 flex-col justify-center gap-2 rounded-2xl border border-line bg-surface p-4 text-left hover:border-brand-600"
            >
              <Folder className="size-9 fill-indigo-200 text-brand-600" aria-hidden />
              <span className="break-words text-sm font-semibold">{folder.label}</span>
              <span className="text-xs text-muted">
                {folder.count} {folder.count === 1 ? 'property' : 'properties'}
              </span>
            </button>
          ))}
          {!folders.data?.folders.length && <p className="col-span-full py-6 text-muted">No folders match this view.</p>}
        </div>
      )}
    </div>
  );
}
