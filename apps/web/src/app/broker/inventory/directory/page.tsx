'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { directoryMapHtml } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { qs } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Dialog } from '@/components/ui/dialog';
import Link from 'next/link';
export default function Directory() {
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
          <Link href="/broker/inventory" className="text-sm text-brand-600">
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
      {query.error && <p role="alert">{errorMessage(query.error)}</p>}
      {view === 'MAP' ? (
        <>
          {map.error ? (
            <p role="alert">{errorMessage(map.error)}</p>
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
            {map.data?.total ?? 0} source locations. Colony points indicate the recorded colony boundary, not a building entrance.
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {query.data?.items.map((item: any) => (
              <button key={item.id} onClick={() => setSelected(item.id)} className="rounded-xl border border-line bg-surface p-5 text-left">
                <p className="text-base font-semibold">{item.name}</p>
                <p className="mt-1 text-sm text-muted">{item.builderName}</p>
                <p className="mt-2 text-xs text-muted">{item.sector || item.address || 'Address not in source'}</p>
                <p className="mt-3 text-xs">
                  {item.provider} · {item.category} · {item.registrationStatus}
                </p>
                <p className="mt-1 text-xs text-muted">{item.latitude == null ? 'Coordinates unavailable' : 'Source location available'}</p>
              </button>
            ))}
          </div>
          {query.data?.total === 0 && <p className="p-8 text-center text-muted">No source records match these filters</p>}
          <div className="mt-5 flex justify-between text-sm">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              {query.data?.total ?? 0} records · Page {page}
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
        size="lg"
      >
        {detail.error ? (
          <p role="alert">{errorMessage(detail.error)}</p>
        ) : (
          detail.data && (
            <div className="space-y-3 text-sm">
              <p>{detail.data.builderName}</p>
              <p>{detail.data.address || detail.data.sector}</p>
              <p>{detail.data.registrationNumber}</p>
              <p>
                Source status: {detail.data.registrationStatus} · Registration up to: {detail.data.registrationUntil || 'Not recorded'}
              </p>
              <p className="text-xs text-muted">{detail.data.metadata?.classificationNote || detail.data.metadata?.mapPointMeaning}</p>
              <a href={detail.data.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-brand-600">
                Open official source ↗
              </a>
              <p className="text-xs text-muted">
                Retrieved {new Date(detail.data.sourceFetchedAt).toLocaleString()} · {detail.data.provider} · {detail.data.externalId}
              </p>
              <p className="text-xs text-muted">This record is a directory fact. It does not add a property to your firm's inventory.</p>
            </div>
          )
        )}
      </Dialog>
    </>
  );
}
