'use client';
import { inventoryAccessRefreshInterval } from '@brokeriq/shared';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, ChevronRight, Folder, Search, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  hasDelegatedAccess,
  inventoryPossessionLabel,
  lastSurveyNoAnswer,
  inventoryDate,
  inventoryPrice,
  inventoryCardTitle,
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
import { Dialog } from '@/components/ui/dialog';
import { InventoryEntryActions } from './inventory-entry-actions';
import { InventoryTabs } from './inventory-tabs';
import { AvailabilitySwitch } from './inventory-status-actions';

const initial = { sector: '', minBudget: '', maxBudget: '', dateFrom: '', dateTo: '' };
const inputClass = 'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm';

export function InventoryFoldersPage({
  initialMode = 'AVAILABLE',
  initialSector,
}: { initialMode?: Exclude<InventoryFolderMode, 'REVIEW'>; initialSector?: string } = {}) {
  const router = useRouter();
  const [today, setToday] = useState(inventoryDate);
  const current = today.slice(0, 7);
  useEffect(() => {
    const timer = setInterval(() => setToday(inventoryDate()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState(initialMode);
  const survey = mode === 'SURVEY';
  const [selectedPath, setPath] = useState<InventoryFolder[]>(
    initialMode === 'SURVEY' && initialSector ? [{ key: initialSector, label: initialSector, count: 0 }] : [],
  );
  const path = mode === 'AVAILABLE' && selectedPath[0]?.key !== current ? [] : selectedPath;
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initial);
  const [datesOpen, setDatesOpen] = useState(false);
  const [dates, setDates] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const term = useDebounced(search);
  const shelf = {
    folderMode: mode,
    currentInventory: mode === 'AVAILABLE' ? 'true' : undefined,
    ...(survey
      ? { folderSector: path[0]?.key }
      : term
        ? {}
        : mode === 'AVAILABLE'
          ? { folderMonth: path[0]?.key, folderRoom: path[1]?.key, folderFurnishing: path[2]?.key }
          : { folderSector: path[0]?.key }),
  };
  const filter = {
    ...filters,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00+05:30').toISOString() : '',
    dateTo: filters.dateTo ? new Date(filters.dateTo + 'T23:59:59.999+05:30').toISOString() : '',
    search: survey && !path.length ? '' : term,
  };
  const leaf = (!survey && Boolean(term)) || path.length === (mode === 'AVAILABLE' ? 3 : 1);
  const folders = useQuery({
    queryKey: ['inventory-folders', user?.id, today, shelf, filter],
    queryFn: () => api<InventoryFolders>(`/inventory/folders${qs({ ...filter, ...shelf })}`),
    enabled: !!user && !leaf,
  });
  const records = useQuery({
    queryKey: ['inventory-folder-items', user?.id, today, shelf, filter, page],
    queryFn: () => api<PagedLedger>(`/inventory${qs({ ...filter, ...shelf, page, pageSize: 30 })}`),
    enabled: !!user && leaf,
    refetchInterval: (state) => inventoryAccessRefreshInterval(state.state.data?.items ?? []),
  });
  const canEdit = hasDelegatedAccess(user, 'inventory', 'edit');
  const folderMonth = mode === 'AVAILABLE' && path[0] ? path[0].key : current;
  const createUrl = `/broker/inventory/new${qs({ makeAvailable: '1', directoryMonth: folderMonth, folderRoom: mode === 'AVAILABLE' ? path[1]?.key : undefined, furnishing: mode === 'AVAILABLE' ? path[2]?.key : undefined })}`;
  const surveySector = survey && path[0]?.key !== '__unset__' ? path[0]?.key : undefined;
  const activeQuery = leaf ? records : folders;
  const advancedUrl = `/broker/inventory/data${qs({ view: 'ledger', ...filter, ...shelf })}`;

  function changePath(next: InventoryFolder[]) {
    setPath(next);
    setPage(1);
  }
  function setShelf(next: Exclude<InventoryFolderMode, 'REVIEW'>) {
    setMode(next);
    changePath([]);
  }
  async function markNoAnswer(item: LedgerItem) {
    if (!canEdit || item.canEdit === false || busy) return;
    setBusy(item.id);
    try {
      await api(`/inventory/${encodeURIComponent(item.id)}/survey-call`, { method: 'PATCH', body: { expectedRevision: item.revision } });
      await Promise.all(['inventory-folder-items', 'ledger-item', 'ledger'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success('No answer recorded. Property stays in Survey.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
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
        [
          'inventory-folders',
          'inventory-folder-items',
          'ledger',
          'ledger-item',
          'ledger-stats',
          'broker-today',
          'agent-assignments',
          'agent-assignment-records',
        ].map((key) => qc.invalidateQueries({ queryKey: [key] })),
      );
      toast.success('Marked as rented out');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="inventory-browser space-y-5">
      <PageHeader
        title={survey ? 'Survey' : 'Available Inventory'}
        actions={
          <InventoryEntryActions
            createHref={survey ? '/broker/inventory/new' + qs({ survey: '1', sector: surveySector }) : createUrl}
            survey={survey}
            sector={surveySector}
          />
        }
      />
      <InventoryTabs active="/broker/inventory" />
      <div className="inventory-filters rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-surface-2 p-1" role="group" aria-label="Availability">
            {(['AVAILABLE', 'RENTED', 'SURVEY'] as const).map((status) => (
              <button
                key={status}
                aria-pressed={mode === status}
                onClick={() => setShelf(status)}
                className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${mode === status ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:text-fg'}`}
              >
                {status === 'AVAILABLE' ? 'Available' : status === 'SURVEY' ? 'Survey' : 'Rented out'}
              </button>
            ))}
          </div>
          {survey ? (
            <p className="basis-full text-sm text-muted">Call the contact and confirm availability before moving a survey property.</p>
          ) : (
            <p className="basis-full text-sm text-muted sm:order-last">
              Browse properties with complete details. Review older or incomplete records in{' '}
              <Link href="/broker/inventory/data" className="font-semibold text-brand-600">
                All Inventory
              </Link>
              .
            </p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 items-start gap-2 xl:grid-cols-6">
          <label className="relative col-span-2 xl:col-span-2">
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
            className={inputClass + ' col-span-2 xl:col-span-1'}
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
          <button
            type="button"
            className={inputClass + ' col-span-2 flex items-center gap-2 text-left xl:col-span-1'}
            onClick={() => {
              setDates({ from: filters.dateFrom, to: filters.dateTo });
              setDatesOpen(true);
            }}
          >
            <CalendarDays className="size-4 shrink-0" /> {filters.dateFrom || filters.dateTo ? 'Record dates applied' : 'Record dates'}
          </button>
          {(!survey || leaf) && (
            <Link href={advancedUrl} className="inline-flex items-center gap-2 col-span-2 py-1 text-sm font-semibold text-brand-600 xl:col-span-6">
              <SlidersHorizontal className="size-4" /> Advanced filters
            </Link>
          )}
        </div>
      </div>
      <nav aria-label="Inventory folder path" className="flex flex-wrap items-center gap-2 text-sm">
        <button className="font-semibold text-brand-600" onClick={() => changePath([])}>
          {mode === 'AVAILABLE' ? 'Current month' : readableValue(mode)}
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
              <article key={item.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <Link className="block" href={`/broker/inventory/${encodeURIComponent(item.id)}`}>
                  {item.photoUrls?.[0] ? (
                    // Real property media supplied by the firm.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photoUrls[0]} alt="" loading="lazy" className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-20 items-center bg-brand-500/5 px-5 text-brand-600">
                      <Building2 className="size-7" />
                    </div>
                  )}
                  <div className="space-y-1 p-4 pb-2">
                    {mode !== 'RENTED' && <p className="text-sm font-semibold text-brand-600">{inventoryPossessionLabel(item)}</p>}
                    {!survey && <p className="text-lg font-bold">{inventoryPrice(item)}</p>}
                    <h3 className="break-words font-semibold">{inventoryCardTitle(item)}</h3>
                    <p className="text-sm text-muted">
                      {[item.bhk ? item.bhk + ' BHK' : item.roomKind, item.furnishing ? readableValue(item.furnishing) : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </Link>
                <div className="mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-line py-2">
                  <Link
                    href={`/broker/inventory/${encodeURIComponent(item.id)}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
                  >
                    View details <ArrowUpRight className="size-4" />
                  </Link>
                  {survey ? (
                    <>
                      {lastSurveyNoAnswer(item.notes) && <span className="basis-full text-xs text-muted">{lastSurveyNoAnswer(item.notes)}</span>}
                      <Button size="sm" variant="ghost" disabled={!canEdit || item.canEdit === false || !!busy} onClick={() => void markNoAnswer(item)}>
                        No answer
                      </Button>
                      {!!(item.contacts?.find((contact) => contact.phone)?.phone ?? item.ownerPhone) && (
                        <a
                          className="text-sm font-semibold text-brand-600"
                          href={`tel:${item.contacts?.find((contact) => contact.phone)?.phone ?? item.ownerPhone}`}
                        >
                          Call contact
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canEdit || item.canEdit === false}
                        href={`/broker/inventory/${encodeURIComponent(item.id)}/edit?makeAvailable=1`}
                      >
                        Confirm availability
                      </Button>
                      <Button size="sm" variant="ghost" disabled={!canEdit || item.canEdit === false || !!busy} onClick={() => void rentOut(item)}>
                        Mark rented out
                      </Button>
                    </>
                  ) : (
                    <AvailabilitySwitch
                      active={mode === 'AVAILABLE'}
                      label={mode === 'AVAILABLE' ? 'Mark property rented out' : 'Make property available'}
                      disabled={!canEdit || item.canEdit === false || !!busy}
                      onToggle={() =>
                        mode === 'AVAILABLE' ? void rentOut(item) : router.push(`/broker/inventory/${encodeURIComponent(item.id)}/edit?makeAvailable=1`)
                      }
                    />
                  )}
                </div>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          {folders.data?.folders
            .filter((folder) => !survey || !term || folder.label.toLowerCase().includes(term.toLowerCase()))
            .map((folder) => (
              <button
                key={folder.key}
                onClick={() => changePath([...path, folder])}
                className="inventory-folder group flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-sm hover:border-brand-500 sm:p-4"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${folder.count ? 'bg-brand-500/10 text-brand-600' : 'bg-surface-2 text-muted'}`}
                >
                  {mode === 'AVAILABLE' && !path.length ? <CalendarDays className="size-5" /> : <Folder className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="break-words text-sm font-semibold">{folder.label}</span>
                  <span className="block text-xs text-muted">
                    {folder.count} {folder.count === 1 ? 'property' : 'properties'}
                  </span>
                </span>
                <ChevronRight className="hidden size-4 shrink-0 text-muted sm:block" />
              </button>
            ))}
          {!folders.data?.folders.length && <p className="col-span-full py-6 text-muted">No folders match this view.</p>}
        </div>
      )}
      <Dialog open={datesOpen} onOpenChange={setDatesOpen} title="Record dates" size="sm">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters({ ...filters, dateFrom: dates.from, dateTo: dates.to });
            setPage(1);
            setDatesOpen(false);
          }}
        >
          <label className="block text-sm">
            From
            <input
              type="date"
              max={dates.to || undefined}
              className={inputClass}
              value={dates.from}
              onChange={(e) => setDates({ ...dates, from: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Through
            <input
              type="date"
              min={dates.from || undefined}
              className={inputClass}
              value={dates.to}
              onChange={(e) => setDates({ ...dates, to: e.target.value })}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFilters({ ...filters, dateFrom: '', dateTo: '' });
                setPage(1);
                setDatesOpen(false);
              }}
            >
              Clear
            </Button>
            <Button type="submit">Apply dates</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
