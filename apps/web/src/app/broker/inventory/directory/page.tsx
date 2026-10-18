'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DirectoryDetails } from '@/components/broker/launch/directory-details';
import { directoryMapHtml, readableValue } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Dialog } from '@/components/ui/dialog';
import Link from 'next/link';
import { Building2, MapPin, ArrowUpRight, Search } from 'lucide-react';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
export default function Directory() {
  const pathname = usePathname();
  const admin = pathname.startsWith('/admin');
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [view, setView] = useState('LIST');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const filters = { search, sector, category, provider };
  const query = useQuery({ queryKey: ['area-directory', filters, page], queryFn: () => api<any>(`/area-directory${qs({ ...filters, page })}`) });
  const map = useQuery({ queryKey: ['area-directory-map', filters], queryFn: () => api<any>(`/area-directory/map${qs(filters)}`), enabled: view === 'MAP' });
  const detail = useQuery({ queryKey: ['directory-detail', selected], queryFn: () => api<any>(`/area-directory/${selected}`), enabled: !!selected });
  useEffect(() => setPage(1), [search, sector, category, provider]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      try {
        const value = JSON.parse(event.data);
        if (value.type === 'directory-select' && typeof value.id === 'string') setSelected(value.id);
      } catch {}
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  return (
    <>
      <PageHeader
        title="Area Directory"
        subtitle="Gurugram city · Societies, apartments, commercial projects and licensed colonies."
        actions={
          <Link href={admin ? '/admin/inventory' : '/broker/inventory'} className="text-sm text-brand-600">
            Back to Inventory
          </Link>
        }
      />
      <div className="mb-5 rounded-xl border border-line bg-surface p-4 text-xs text-muted">
        <p>
          {query.data?.coverage.sourceRecords ?? '—'} public source records · {query.data?.coverage.mappedRecords ?? '—'} with location geometry
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold text-brand-600">About sources & coverage</summary>
          <p className="mt-2">
            Registrations and phases remain separate source records. © OpenStreetMap contributors (ODbL). GIS scope uses published MCG 2020 boundary; later city
            extensions may be missing. Registration is not a guarantee of current approval, possession or available inventory. Map shows only source-backed
            coordinates; other entries remain in List.
          </p>
          <p className="mt-2">Last fetched: {query.data?.coverage.lastFetchedAt ? new Date(query.data.coverage.lastFetchedAt).toLocaleString() : '—'}</p>
        </details>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          aria-label="Search directory"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Society, project, builder or registration"
          className="min-w-60 flex-1 rounded-xl border border-line bg-surface p-3 text-sm"
        />
        <input
          aria-label="Directory sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder="Sector / locality"
          className="rounded-xl border border-line bg-surface p-3 text-sm"
        />
        <select
          aria-label="Directory category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-line bg-surface p-3 text-sm"
        >
          <option value="">All property categories</option>
          {['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'UNCLASSIFIED'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Directory source"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-xl border border-line bg-surface p-3 text-sm"
        >
          <option value="">All sources</option>
          {['HARERA', 'GMDA_TCP', 'OSM'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <button className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white" onClick={() => setView(view === 'LIST' ? 'MAP' : 'LIST')}>
          {view === 'LIST' ? 'Show map' : 'Show list'}
        </button>
      </div>
      {query.error && <ApiErrorState error={query.error} onRetry={() => query.refetch()} />}
      {view === 'MAP' ? (
        <>
          {map.error ? (
            <ApiErrorState error={map.error} onRetry={() => map.refetch()} />
          ) : (
            map.data && (
              <iframe
                ref={frame}
                title="Gurugram project map"
                srcDoc={directoryMapHtml(map.data.items, window.location.origin)}
                sandbox="allow-scripts allow-same-origin allow-popups"
                className="h-[65vh] min-h-96 w-full rounded-2xl border border-line"
              />
            )
          )}
          <p className="mt-2 text-xs text-muted">
            {map.data?.total ?? '—'} source locations. Colony points indicate the recorded colony boundary, not a building entrance.
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {query.isPending && Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton h-52 rounded-2xl" aria-label="Loading project" />)}
            {query.data?.items.map((item: any) => (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                className="group flex flex-col rounded-2xl border border-line bg-surface p-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                    <Building2 className="size-5" />
                  </span>
                  <span className="rounded-md bg-surface-2 px-2 py-1 text-[10px] font-bold tracking-wide text-muted">{item.provider}</span>
                </div>
                <p className="font-display text-base font-bold leading-6">{item.name.trim()}</p>
                <p className="mt-2 text-xs leading-5 text-muted">{item.builderName || 'Developer not in source'}</p>
                <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
                  <MapPin className="size-3.5 shrink-0" />
                  {item.sector ? (/^\d/.test(item.sector.trim()) ? `Sector ${item.sector.trim()}` : item.sector) : item.address || 'Address not in source'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
                  <span className="rounded-md bg-surface-2 px-2 py-1">{readableValue(item.category)}</span>
                  {item.registrationNumber && <span className="rounded-md bg-surface-2 px-2 py-1">{item.registrationNumber}</span>}
                </div>
                <div className="mt-auto pt-4">
                  <div className="flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
                    <span className="text-muted">{item.latitude == null ? 'List only · Location not recorded' : 'Source location available'}</span>
                    <span className="flex items-center gap-1 font-semibold text-brand-600">
                      Project details <ArrowUpRight className="size-3.5" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {query.data?.total === 0 && <p className="p-8 text-center text-muted">No source records match these filters</p>}
          <div className="mt-5 flex justify-between text-sm">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              {query.data?.total ?? '—'} records · Page {page}
            </span>
            <button disabled={!query.data || page >= query.data.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={detail.data?.name ?? 'Source details'}
        size="xl"
      >
        {detail.error ? (
          <ApiErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : detail.data ? (
          <DirectoryDetails record={detail.data} />
        ) : (
          <div className="skeleton h-72" aria-label="Loading source details" />
        )}
      </Dialog>
    </>
  );
}
