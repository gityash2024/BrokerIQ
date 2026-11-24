'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bytesToBase64, hasDelegatedAccess, normalizeIndianPhone, PDF_INVENTORY_MAX_BYTES, pdfInventoryEditableFields, pdfInventoryFilterFields, uploadImport,
  type PdfInventoryBatch, type PdfInventoryRow } from '@brokeriq/shared';
import { toast } from 'sonner';
import { api, assertAccountContext, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { qs } from '@/lib/utils';
import { useRouteState } from '@/lib/navigation';
import { useDebounced } from '@/lib/hooks';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

const input = 'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm';
const endpoint = '/inventory-pdf';

export default function PdfInventoryPage() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [filters, setFilters] = useRouteState<Record<string, string>>('pdf-inventory.filters', {});
  const search = useDebounced(JSON.stringify(filters));
  const [page, setPage] = useRouteState('pdf-inventory.page', 1);
  const [file, setFile] = useState<File | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [selected, setSelected] = useState<PdfInventoryRow | null>(null);
  const [batchBusy, setBatchBusy] = useState('');
  const allowed = !!user && ['BROKER_ADMIN', 'SUB_BROKER_ADMIN'].includes(user.role) && hasDelegatedAccess(user, 'inventory', 'view');
  const canCreate = allowed && hasDelegatedAccess(user, 'inventory', 'create');
  const canEdit = allowed && hasDelegatedAccess(user, 'inventory', 'edit');
  const canDelete = allowed && hasDelegatedAccess(user, 'inventory', 'delete');
  const data = useQuery({
    queryKey: ['pdf-inventory', user?.organization?.id, user?.id, search, page],
    queryFn: () => api<{ items: PdfInventoryRow[]; batches: PdfInventoryBatch[]; total: number }>(endpoint + qs({ ...JSON.parse(search), page })),
    enabled: allowed,
    refetchInterval: (state) => state.state.data?.batches.some(({ status }) => status === 'PENDING' || status === 'PROCESSING') ? 3000 : false,
  });
  useEffect(() => {
    setFile(null);
    setSelected(null);
    if (picker.current) picker.current.value = '';
  }, [user?.id, user?.organization?.id]);

  function filter(name: string, value: string) {
    setFilters({ ...filters, [name]: value });
    setPage(1);
  }

  async function upload() {
    if (!file || progress !== null) return;
    if (!file.size || file.size > PDF_INVENTORY_MAX_BYTES) return toast.error('Select a PDF of up to 32 MB');
    const owner = captureAccountContext();
    setProgress(0);
    try {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
      const clientKey = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('') + '-' + file.name.slice(0, 50);
      await uploadImport((path, body) => {
        assertAccountContext(owner);
        return api(path, { method: 'POST', body });
      }, { clientKey, fileName: file.name, contentType: 'application/pdf', sourceType: 'PDF', totalBytes: file.size },
      async (offset, length) => bytesToBase64(new Uint8Array(await file.slice(offset, offset + length).arrayBuffer())),
      (sent, total) => setProgress(Math.round(sent / total * 100)), '/inventory-pdf/uploads');
      assertAccountContext(owner);
      setFile(null);
      if (picker.current) picker.current.value = '';
      toast.success('PDF received');
      await cache.invalidateQueries({ queryKey: ['pdf-inventory'] });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setProgress(null); }
  }

  async function retry(id: string) {
    setBatchBusy(id);
    try {
      await api(`${endpoint}/batches/${id}/retry`, { method: 'POST' });
      await data.refetch();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBatchBusy(''); }
  }

  if (!allowed) return <p className="card p-5">PDF Inventory is available to authorized firm administrators.</p>;
  return (
    <div className="space-y-4">
      <PageHeader title="PDF Inventory" />
      {canCreate && <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="space-y-1 text-sm">Property PDF
          <input ref={picker} className={input} type="file" accept="application/pdf,.pdf" disabled={progress !== null}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <Button disabled={!file || progress !== null} onClick={() => void upload()}>{progress === null ? 'Import property from PDF' : `Uploading ${progress}%`}</Button>
      </div>}
      <div className="card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {pdfInventoryFilterFields.map(([name, label]) => <label className="text-sm" key={name}>{label}
          <input className={input} value={filters[name] ?? ''} onChange={(event) => filter(name, event.target.value)}
            type={/^(min|max)/.test(name) ? 'number' : 'search'} />
        </label>)}
        <label className="text-sm">PDF batch
          <select className={input} value={filters.batchId ?? ''} onChange={(event) => filter('batchId', event.target.value)}>
            <option value="">All PDFs</option>
            {data.data?.batches.map((batch) => <option value={batch.id} key={batch.id}>{batch.fileName}</option>)}
          </select>
        </label>
        {[
          ['availability', 'Availability', ['AVAILABLE', 'RENTED', 'UNKNOWN']],
          ['review', 'Review status', ['SAVED', 'NEEDS_REVIEW', 'DUPLICATE']],
        ].map(([name, label, options]) => <label className="text-sm" key={String(name)}>{label}
          <select className={input} value={filters[String(name)] ?? ''} onChange={(event) => filter(String(name), event.target.value)}>
            <option value="">Any</option>
            {(options as string[]).map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>)}
      </div>
      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">PDF imports</summary>
        <ul className="mt-2 space-y-2">
          {data.data?.batches.map((batch) => <li className="flex flex-wrap items-center gap-2 text-sm" key={batch.id}>
            <button className="text-brand-700 underline" onClick={() => filter('batchId', batch.id)}>{batch.fileName}</button>
            <span>{batch.status}</span>
            {!!batch.metadata?.reviewPages?.length && <span>Pages to review {batch.metadata.reviewPages.join(', ')}</span>}
            {batch.lastError && <span role="status">{batch.lastError}</span>}
            {canCreate && ['FAILED', 'PARTIAL'].includes(batch.status) && <Button size="sm" variant="secondary" disabled={batchBusy === batch.id} onClick={() => void retry(batch.id)}>Retry</Button>}
          </li>)}
        </ul>
      </details>
      {data.isError ? <ApiErrorState error={data.error} onRetry={() => data.refetch()} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr>{['Property', 'Configuration', 'Rent', 'Availability', 'Review', ''].map((label, i) => <th className="p-3" key={i}>{label}</th>)}</tr></thead>
            <tbody>{data.data?.items.map((row) => <tr className="border-t border-line" key={row.id}>
              <td className="p-3">{row.address || 'Address to review'}<div className="text-muted">{row.sector || row.locality} · Page {row.pageNo}, row {row.rowNo}</div></td>
              <td className="p-3">{[row.configuration, row.floor, row.areaSqft && row.areaSqft + ' sq ft'].filter(Boolean).join(' · ')}</td>
              <td className="p-3">{row.monthlyRent == null ? '—' : '₹' + row.monthlyRent.toLocaleString('en-IN')}</td>
              <td className="p-3">{row.availability}</td><td className="p-3">{row.review.replaceAll('_', ' ')}</td>
              <td className="p-3"><Button size="sm" variant="secondary" onClick={() => setSelected(row)}>Open property</Button></td>
            </tr>)}</tbody>
          </table>
          {data.isPending && <p className="p-4">Loading PDF inventory…</p>}
          {data.data?.total === 0 && <p className="p-4 text-muted">No matching PDF properties.</p>}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span>Page {page}</span>
        <Button size="sm" variant="secondary" disabled={page * 30 >= (data.data?.total ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
      {selected && <RowEditor key={selected.id} row={selected} canEdit={canEdit} canDelete={canDelete} close={() => setSelected(null)}
        refresh={() => cache.invalidateQueries({ queryKey: ['pdf-inventory'] })} />}
    </div>
  );
}

function RowEditor({ row, canEdit, canDelete, close, refresh }: { row: PdfInventoryRow; canEdit: boolean; canDelete: boolean; close: () => void; refresh: () => Promise<void> }) {
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(
    [...pdfInventoryEditableFields.map(([key]) => [key, String(row[key] ?? '')]), ['availability', row.availability ?? 'UNKNOWN'], ['contacts', row.contacts?.join(', ') ?? '']],
  ));
  const [busy, setBusy] = useState(false);

  async function save(archive = false) {
    if (archive && !window.confirm('Archive this PDF property?')) return;
    const contacts = fields.contacts.split(/[ ,;\n]+/).filter(Boolean).map(normalizeIndianPhone);
    if (!archive && contacts.some((value) => !value)) return toast.error('Enter valid Indian mobile numbers separated by commas');
    const changes = Object.fromEntries(pdfInventoryEditableFields.map(([key]) => [
      key, !fields[key].trim() ? null : key === 'areaSqft' || key === 'monthlyRent' ? Number(fields[key]) : fields[key],
    ]));
    setBusy(true);
    try {
      await api(`${endpoint}/${row.id}`, archive ? { method: 'DELETE' } : {
        method: 'PATCH', body: { ...changes, availability: fields.availability, contacts: [...new Set(contacts)], expectedUpdatedAt: row.updatedAt, reviewed: true },
      });
      await refresh();
      close();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) close(); }} title={row.address || 'PDF property'} size="lg"
      footer={<>{canDelete && <Button variant="secondary" disabled={busy} onClick={() => void save(true)}>Archive</Button>}
        {canEdit && <Button disabled={busy} onClick={() => void save()}>Save review</Button>}</>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {pdfInventoryEditableFields.map(([key, label]) => <label key={key} className="text-sm">{label}
          <input className={input} readOnly={!canEdit} value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />
        </label>)}
        <label className="text-sm">Contacts<input className={input} readOnly={!canEdit} value={fields.contacts} onChange={(event) => setFields({ ...fields, contacts: event.target.value })} /></label>
        <label className="text-sm">Availability<select className={input} disabled={!canEdit} value={fields.availability} onChange={(event) => setFields({ ...fields, availability: event.target.value })}>
          <option>UNKNOWN</option><option>AVAILABLE</option><option>RENTED</option>
        </select></label>
      </div>
      <p className="mt-4 text-sm font-semibold">Source · page {row.pageNo}, row {row.rowNo}</p>
      <pre className="whitespace-pre-wrap break-words text-xs">{row.rawText}</pre>
    </Dialog>
  );
}
