'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type CapturedEntity } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { PropertyForm } from '@/components/broker/launch/property-form';
import { RequirementForm } from '@/components/broker/launch/requirement-form';
import { PrivateSource } from '@/components/broker/launch/private-source';
import { toast } from 'sonner';
export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const [sourcePage, setSourcePage] = useState('');
  const [pendingOnly, setPendingOnly] = useState(true);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['import', id, page, sourcePage, pendingOnly],
    queryFn: () => api<any>(`/imports/${id}?page=${page}${sourcePage ? `&sourcePage=${sourcePage}` : ''}${pendingOnly ? '&reviewState=NEEDS_REVIEW' : ''}`),
    refetchInterval: 5000,
  });
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.totalPages)) setPage(Math.max(1, query.data.totalPages));
  }, [query.data, page]);
  async function approve(entry: any, entities: CapturedEntity[], ignore = false, version?: string) {
    await api(`/imports/entries/${entry.id}/approve`, { body: { entities, ignore, expectedUpdatedAt: version ?? entry.updatedAt } });
    await Promise.all(['import', 'ledger', 'broker-requirements'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
    toast.success(ignore ? 'Source marked unrelated' : 'Approved. Availability remains as recorded.');
  }
  return (
    <>
      <PageHeader
        title={query.data?.fileName || 'Source review'}
        subtitle={query.data ? `${query.data.total} entries · ${query.data.pending} need review` : 'Loading source…'}
        actions={
          <Link href="/broker/imports" className="text-sm text-brand-600">
            All captures
          </Link>
        }
      />
      {query.data?.metadata?.requestedTarget && (
        <p className="mb-4 rounded-xl bg-brand-500/10 p-3 text-sm">
          Requested review destination:{' '}
          <strong>{query.data.metadata.requestedTarget === 'AUTO' ? 'Auto detect · Inventory & Requirements' : query.data.metadata.requestedTarget}</strong>.
          Confirm each extracted entry before approval.
        </p>
      )}
      <div className="mb-5 flex gap-2" role="group" aria-label="Review status">
        {[true, false].map((pending) => (
          <button
            key={String(pending)}
            aria-pressed={pendingOnly === pending}
            className={`rounded-full border px-4 py-2 text-sm ${pendingOnly === pending ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line'}`}
            onClick={() => {
              setPendingOnly(pending);
              setPage(1);
            }}
          >
            {pending ? 'Pending only' : 'All entries'}
          </button>
        ))}
      </div>
      {query.data?.metadata?.pages?.length > 0 && (
        <label className="mb-5 block text-sm">
          Register page
          <select
            value={sourcePage}
            onChange={(e) => {
              setSourcePage(e.target.value);
              setPage(1);
            }}
            className="ml-3 rounded-lg border border-line bg-surface p-2"
          >
            <option value="">All pages</option>
            {query.data.metadata.pages.map((p: any) => (
              <option key={p.pageNo} value={p.pageNo}>
                {p.pageNo}
              </option>
            ))}
          </select>
          <span className="ml-3 text-xs text-muted">Candidate blocks require visual review; each can contain multiple units.</span>
        </label>
      )}
      {query.error && <p role="alert">{errorMessage(query.error)}</p>}
      {query.data?.status === 'FAILED' && (
        <div className="mb-5 rounded-xl border border-line p-5">
          <p>{query.data.lastError}</p>
          <button
            onClick={async () => {
              await api(`/imports/${id}/retry`, { body: {} });
              await query.refetch();
            }}
            className="mt-3 font-semibold text-brand-600"
          >
            Retry extraction
          </button>
        </div>
      )}
      {['PENDING', 'PROCESSING'].includes(query.data?.status) && <p className="rounded-xl bg-surface-2 p-5">Source saved. Extraction is processing…</p>}
      {query.data && !['PENDING', 'PROCESSING'].includes(query.data.status) && query.data.total === 0 && (
        <p className="mb-5 text-sm text-muted">No entries match this view.</p>
      )}
      <div className="space-y-5">
        {query.data?.entries.map((entry: any) => (
          <Entry
            key={entry.id}
            entry={entry}
            batchId={id}
            image={query.data?.sourceType === 'IMAGE'}
            onApprove={(entities, ignore, version) => approve(entry, entities, ignore, version)}
          />
        ))}
      </div>
      <div className="mt-5 flex justify-between text-sm">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button disabled={!query.data || page >= query.data.totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </>
  );
}
function Entry({
  entry,
  batchId,
  image,
  onApprove,
}: {
  entry: any;
  batchId: string;
  image: boolean;
  onApprove: (entities: CapturedEntity[], ignore?: boolean, version?: string) => Promise<void>;
}) {
  const [entities, setEntities] = useState<CapturedEntity[]>(entry.extracted ?? []);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const done = entry.reviewState !== 'NEEDS_REVIEW';
  const [version, setVersion] = useState(entry.updatedAt);
  const [prepared, setPrepared] = useState<number[]>([]);
  const ready = entities.some((e) => e.kind !== 'UNRELATED') && entities.every((e, i) => e.kind === 'UNRELATED' || prepared.includes(i));
  async function approve() {
    setError('');
    try {
      await onApprove(entities, false, version);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {entry.pageNo ? `Page ${entry.pageNo} · ` : ''}Entry {entry.rowNo ?? entry.entryKey}
          </p>
          <p className="mt-1 text-xs text-muted">{entry.reviewState}</p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="font-semibold text-brand-600">
          {expanded ? 'Collapse' : 'Review source & fields'}
        </button>
      </div>
      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs text-muted">{entry.rawText}</p>
      {expanded && (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            {(image || entry.pageNo) && (
              <PrivateSource path={`/imports/${batchId}/source${entry.pageNo ? `?pageNo=${entry.pageNo}&entryId=${entry.id}` : ''}`} />
            )}
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs">{entry.rawText}</pre>
          </div>
          <div className="space-y-5">
            {entities.map((entity, index) => (
              <div key={index} className="rounded-xl border border-line p-4">
                <p className="mb-2 text-sm font-semibold">
                  {entity.kind} · Record {index + 1}
                </p>
                {entity.warnings.map((warning, i) => (
                  <p key={i} className="mb-2 text-xs text-amber-700">
                    {warning}
                  </p>
                ))}
                {!done &&
                  (entity.kind === 'INVENTORY' ? (
                    <PropertyForm
                      initial={entity.inventory}
                      onDirty={() => setPrepared(prepared.filter((i) => i !== index))}
                      label="Save reviewed fields"
                      onSave={async (inventory) => {
                        const next = entities.map((e, i) => (i === index ? { ...e, inventory } : e));
                        const saved = await api<any>(`/imports/entries/${entry.id}`, { method: 'PATCH', body: { entities: next, expectedUpdatedAt: version } });
                        setEntities(next);
                        setVersion(saved.updatedAt);
                        setPrepared([...new Set([...prepared, index])]);
                        toast.success('Review fields saved');
                      }}
                    />
                  ) : entity.kind === 'REQUIREMENT' ? (
                    <RequirementForm
                      initial={entity.requirement}
                      onDirty={() => setPrepared(prepared.filter((i) => i !== index))}
                      label="Save reviewed fields"
                      onSave={async (requirement) => {
                        const next = entities.map((e, i) => (i === index ? { ...e, requirement } : e));
                        const saved = await api<any>(`/imports/entries/${entry.id}`, { method: 'PATCH', body: { entities: next, expectedUpdatedAt: version } });
                        setEntities(next);
                        setVersion(saved.updatedAt);
                        setPrepared([...new Set([...prepared, index])]);
                        toast.success('Review fields saved');
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted">No property identified. Add a record if this source contains one.</p>
                  ))}
              </div>
            ))}
            {!done && (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <button onClick={() => setEntities([...entities, { kind: 'INVENTORY', inventory: { availability: 'UNKNOWN' }, warnings: [] }])}>
                    + Property / unit
                  </button>
                  <button
                    onClick={() =>
                      setEntities([
                        ...entities,
                        { kind: 'REQUIREMENT', requirement: { propertyTypes: [], localityNames: [], bedrooms: [], status: 'OPEN' }, warnings: [] },
                      ])
                    }
                  >
                    + Requirement
                  </button>
                </div>
                <div className="flex gap-4">
                  <button disabled={!ready} onClick={approve} className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white">
                    Approve saved records
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await onApprove(entities, true, version);
                      } catch (e) {
                        setError(errorMessage(e));
                      }
                    }}
                    className="text-sm text-muted"
                  >
                    Ignore unrelated source
                  </button>
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
