'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { inventoryDate, readableValue, realeGurugramSource, type OrganicDeliveryInput, type OrganicRecordInput, type OrganicSourceInput, type OrganicTarget } from '@brokeriq/shared';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';
import { Dialog } from '@/components/ui/dialog';
import { api, errorMessage } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { useRouteState } from '@/lib/navigation';
import { qs } from '@/lib/utils';

const endpoint = '/admin/organic';
const input = 'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm';
type Kind = 'SUPPLY' | 'DEMAND';
type Firm = { id: string; name: string; status: string; localities: { name: string }[]; members: { id: string; name: string }[] };
type Run = { id: string; kind: string; status: string; createdAt: string; windowTo: string | null; report?: Record<string, number> };
type DiscoverySettings = { enabled: boolean; time: string; enrichTime: string; resultsTime: string; notifyTime: string };
type Rule = OrganicDeliveryInput & { id: string; nextRunAt: string | null; cursorFrom: string };
type Source = OrganicSourceInput & { id: string; lastSuccessAt: string | null; lastFailureAt: string | null; lastError: string | null; lastReport?: Record<string, number> };
type RecordRow = {
  id: string; kind: Kind; title: string; status: string; availability: string; price: number | null; priority: string; confidence: number;
  values: OrganicRecordInput; publishedAt: string | null; discoveredAt: string; sourceRefs: { url: string; source: { name: string } }[];
  _count?: { transfers: number }; transfers?: { id: string; organizationId: string; status: string; targetType: string; createdAt: string }[];
  matches?: { id: string; title: string; kind: Kind; reasons: string[] }[];
};
type Preview = { ids: string[]; firms: (OrganicTarget & { selected: number; eligible: number; duplicates: number; newRecords: number })[] };

const titles: Record<Kind, string> = { SUPPLY: 'Organic Property Supply', DEMAND: 'Organic Buyer & Tenant Leads' };
const timeLabel = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—';

export default function OrganicPage() {
  const { view } = useParams<{ view: string }>();
  if (view === 'delivery') return <DeliveryPage />;
  if (view === 'sources') return <SourcesPage />;
  if (view !== 'supply' && view !== 'demand') return <p className="card p-4">Organic page unavailable.</p>;
  return <RecordsPage key={view} kind={view === 'supply' ? 'SUPPLY' : 'DEMAND'} />;
}

type FilterField = [key: string, label: string, options?: string[]];
const baseFields: FilterField[] = [
  ['search', 'Search'], ['since', 'From date'], ['until', 'To date'],
  ['dateField', 'Date basis', ['PUBLISHED', 'DISCOVERED', 'UNKNOWN']],
  ['status', 'Review status', ['APPROVED', 'NEEDS_REVIEW', 'REJECTED', 'ARCHIVED']],
  ['sectors', 'Sectors, comma separated'], ['locality', 'Locality'], ['society', 'Society or project'], ['propertyType', 'Property type'], ['bhk', 'BHK'],
  ['category', 'Category', ['RESIDENTIAL', 'COMMERCIAL', 'LAND']], ['furnishing', 'Furnishing', ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']],
  ['purpose', 'Transaction', ['RENT', 'SALE', 'LEASE']], ['minPrice', 'Minimum price / budget'], ['maxPrice', 'Maximum price / budget'],
  ['minArea', 'Minimum area'], ['maxArea', 'Maximum area'], ['minConfidence', 'Minimum confidence'],
  ['availability', 'Availability', ['AVAILABLE', 'UNKNOWN', 'CLOSED', 'STALE']], ['delivered', 'Assigned', ['yes', 'no']],
];
const optionsByKind: Record<Kind, FilterField[]> = {
  SUPPLY: [['ownership', 'Owner evidence', ['OWNER_CONFIRMED', 'OWNER_LIKELY', 'BROKER', 'DEVELOPER', 'UNKNOWN']]],
  DEMAND: [['intent', 'Intent', ['BUYER', 'TENANT', 'COMMERCIAL_BUYER', 'COMMERCIAL_TENANT', 'INVESTOR', 'RELOCATION', 'BROKER', 'UNKNOWN']],
    ['priority', 'Priority', ['HIGH', 'MEDIUM', 'LOW', 'REVIEW']], ['urgency', 'Urgency', ['IMMEDIATE', 'SOON', 'FLEXIBLE']]],
};

function RecordsPage({ kind }: { kind: Kind }) {
  const cache = useQueryClient();
  const kindView = kind === 'SUPPLY' ? 'DIRECT_OWNERS' : 'GENUINE_DEMAND';
  const [savedFilters, filtersSet] = useRouteState<Record<string, string>>('organic.filters', {});
  const filters: Record<string, string> = { ...savedFilters, view: savedFilters.view ?? kindView };
  const [page, setPage] = useRouteState('organic.page', 1);
  const [selected, select] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [transfer, showTransfer] = useState(false);
  const [busy, setBusy] = useState(false);
  const clean = JSON.parse(useDebounced(JSON.stringify(filters))) as Record<string, string>;
  const params = { kind, page, ...clean };
  const data = useQuery({
    queryKey: ['organic-records', params],
    queryFn: () => api<{ rows: RecordRow[]; total: number; metrics: { status: string; purpose: string; category: string; priority: string; _count: { _all: number } }[];
      runs: Run[]; settings: DiscoverySettings; nextDiscoveryAt: string | null }>(endpoint + '/records' + qs(params)),
    refetchInterval: 5000,
  });
  const sources = useQuery({ queryKey: ['organic-sources'], queryFn: () => api<Source[]>(endpoint + '/sources') });
  const firms = useQuery({ queryKey: ['organic-targets'], queryFn: () => api<Firm[]>(endpoint + '/targets') });
  const item = useQuery({ queryKey: ['organic-record', detail], queryFn: () => api<RecordRow>(endpoint + '/records/' + detail), enabled: !!detail });
  const query = { ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')), kind, page };
  function update(next: Record<string, string>) {
    filtersSet(next); setPage(1); select([]); setAll(false);
  }

  async function mutate(path: string, method: 'POST' | 'PATCH', body: unknown) {
    setBusy(true);
    try {
      await api(endpoint + path, { method, body });
      await cache.invalidateQueries({ predicate: ({ queryKey }) => String(queryKey[0]).startsWith('organic') });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  const metrics = data.data?.metrics ?? [];
  const total = (field: 'status' | 'purpose' | 'category' | 'priority', value: string) => metrics.reduce((sum, row) => sum + (row[field] === value ? row._count._all : 0), 0);
  return <div className="space-y-4">
    <PageHeader title={titles[kind]} actions={<Button disabled={busy} onClick={() => void mutate('/discover', 'POST', { kind })}>Run discovery now</Button>} />
    <div className="flex flex-wrap gap-3">
      {[
        ['Matching filters', data.data?.total ?? 0], ['Ready to distribute', total('status', 'APPROVED')], ['Needs review', total('status', 'NEEDS_REVIEW')],
        [kind === 'SUPPLY' ? 'For sale' : 'High priority', kind === 'SUPPLY' ? total('purpose', 'SALE') : total('priority', 'HIGH')], ['Rent', total('purpose', 'RENT')],
      ].map(([label, count]) => <div className="card min-w-36 p-3" key={label}><p className="text-sm text-muted">{label}</p><strong className="text-xl">{count}</strong></div>)}
    </div>
    {data.data?.settings && <DiscoverySchedule key={kind + JSON.stringify(data.data.settings)} config={data.data.settings}
      save={(body) => mutate('/discovery/' + kind, 'PATCH', body)} busy={busy} nextDiscoveryAt={data.data.nextDiscoveryAt} />}
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {[['Today', 0], ['Yesterday', 1], ['Last 7 days', 6], ['Last 30 days', 29]].map(([label, days]) => (
          <Button key={label} size="sm" variant="secondary" onClick={() => {
            const since = inventoryDate(new Date(Date.now() - Number(days) * 86_400_000));
            update({ ...filters, since, until: Number(days) === 1 ? since : inventoryDate() });
          }}>{label}</Button>
        ))}
        {[
          [kindView, kind === 'SUPPLY' ? 'Direct owners' : 'Genuine demand'],
          ...(kind === 'SUPPLY' ? [['OWNER_REVIEW', 'Uncertain owners']] : []),
          ['ALL', 'All records'],
        ].map(([view, label]) => <Button key={view} size="sm" variant="secondary"
          aria-pressed={filters.view === view} onClick={() => update({ ...filters, view, ownership: '', intent: '' })}>{label}</Button>)}
        <Button size="sm" variant="secondary" onClick={() => update({ view: kindView })}>Clear filters</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[...baseFields, ...optionsByKind[kind]].map(([key, label, choices]) => <label className="text-sm" key={key}>{label}
          {choices ? <select className={input} value={filters[key] ?? ''} onChange={(e) =>
            update({ ...filters, ...(key === 'ownership' || key === 'intent' ? { view: 'ALL' } : {}), [key]: e.target.value })}>
            <option value="">Any</option>{choices.map((choice) => <option key={choice} value={choice}>{readableValue(choice)}</option>)}
          </select> : <input className={input} type={key === 'since' || key === 'until' ? 'date' : /^(min|max|bhk)/.test(key) ? 'number' : 'text'}
            value={filters[key] ?? ''} onChange={(e) => update({ ...filters, [key]: e.target.value })} />}
        </label>)}
        <label className="text-sm">Source<select className={input} value={filters.sourceId ?? ''} onChange={(e) => update({ ...filters, sourceId: e.target.value })}>
          <option value="">Any</option>{sources.data?.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <label className="text-sm">Receiving firm<select className={input} value={filters.organizationId ?? ''} onChange={(e) => update({ ...filters, organizationId: e.target.value })}>
          <option value="">Any</option>{firms.data?.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select></label>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={(e) => { setAll(e.target.checked); select([]); }} />Select all filtered</label>
      <Button size="sm" disabled={!all && !selected.length} onClick={() => showTransfer(true)}>Transfer to firms {all ? '' : '(' + selected.length + ')'}</Button>
    </div>
    {data.isError ? <ApiErrorState error={data.error} onRetry={() => data.refetch()} /> : <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr>{['Select', 'Record', 'Location', 'Type / BHK', 'Price / budget', 'Source & published', 'Review', 'Distribution'].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
        <tbody>{data.data?.rows.map((row) => <tr className="border-t border-line" key={row.id}>
          <td className="p-3"><input aria-label={'Select ' + row.title} type="checkbox" disabled={all} checked={all || selected.includes(row.id)}
            onChange={(e) => select(e.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td>
          <td className="p-3"><button className="font-semibold text-brand-700 underline" onClick={() => setDetail(row.id)}>{row.title}</button></td>
          <td className="p-3">{[row.values.sectors.join(', '), row.values.society, row.values.locality].filter(Boolean).join(' · ')}</td>
          <td className="p-3">{[row.values.purpose, row.values.propertyType, row.values.bhk].filter(Boolean).join(' · ')}</td>
          <td className="p-3">{row.price == null ? '—' : '₹' + row.price.toLocaleString('en-IN')}</td>
          <td className="p-3">{row.sourceRefs[0]?.source.name} <div className="text-muted">{timeLabel(row.publishedAt)}</div></td>
          <td className="p-3">{readableValue(row.status)} · {row.confidence}% <div>{readableValue((kind === 'SUPPLY' ? row.values.ownership : row.values.intent) ?? 'UNKNOWN')}</div></td>
          <td className="p-3">{row._count?.transfers ?? 0}</td>
        </tr>)}</tbody>
      </table>
      {data.isPending && <p className="p-4">Loading organic records…</p>}
      {data.data?.total === 0 && <p className="p-4 text-muted">No records match these filters.</p>}
    </div>}
    <div className="flex items-center gap-3">
      <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span>
      <Button size="sm" variant="secondary" disabled={page * 30 >= (data.data?.total ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>
    </div>
    <RunHistory runs={data.data?.runs ?? []} />
    {detail && <Dialog open onOpenChange={(open) => { if (!open) setDetail(null); }} title={item.data?.title ?? 'Record details'} size="lg"
      footer={item.data && <>{['APPROVED', 'NEEDS_REVIEW', 'REJECTED', 'ARCHIVED'].map((status) => (
        <Button size="sm" key={status} disabled={busy || item.data?.status === status || (status === 'APPROVED' && item.data?.values.registryReference)} variant="secondary"
          onClick={() => void mutate('/records/' + detail, 'PATCH', { status })}>{({ APPROVED: 'Approve', NEEDS_REVIEW: 'Review', REJECTED: 'Reject', ARCHIVED: 'Archive' })[status]}</Button>
      ))}</>}>
      {item.error && <ApiErrorState error={item.error} onRetry={() => item.refetch()} />}
      {item.data && <>
        {item.data.values.registryReference && <p className="mb-3 text-sm text-muted">RERA project reference · availability and listing must be verified separately.</p>}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {Object.entries(item.data.values).filter(([, value]) => value != null && value !== '').map(([key, value]) => (
            <div key={key}><dt className="font-semibold text-muted">{key.replace(/([A-Z])/g, ' $1')}</dt>
              <dd className="whitespace-pre-wrap break-words">{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>
          ))}
        </dl>
        <div className="mt-4 space-y-2">
          {item.data.sourceRefs.map((ref) => <p key={ref.url}><a className="text-brand-700 underline" href={ref.url} target="_blank" rel="noreferrer">{ref.source.name}</a></p>)}
          {item.data.transfers?.map((row) => <p key={row.id} className="text-sm">{firms.data?.find(({ id }) => id === row.organizationId)?.name ?? row.organizationId} · {row.status} · {timeLabel(row.createdAt)}</p>)}
          {item.data.matches?.map((match) => <label className="flex gap-2 text-sm" key={match.id}>
            <input type="checkbox" checked={selected.includes(match.id)} onChange={(e) => { setAll(false); select(e.target.checked ? [...new Set([...selected, detail, match.id])] : selected.filter((id) => id !== match.id)); }} />
            {match.title} · {match.reasons.join(', ')}
          </label>)}
        </div>
      </>}
    </Dialog>}
    {transfer && <TransferDialog firms={firms.data ?? []} selection={all ? { query } : { ids: selected }}
      close={() => showTransfer(false)} done={() => { showTransfer(false); select([]); setAll(false); }} />}
  </div>;
}

function DiscoverySchedule({ config, save, busy, nextDiscoveryAt }: { config: DiscoverySettings; save: (config: DiscoverySettings) => Promise<void>; busy: boolean; nextDiscoveryAt: string | null }) {
  const [value, setValue] = useState(config);
  return <div className="card flex flex-wrap items-end gap-3 p-4">
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.enabled} onChange={(e) => setValue({ ...value, enabled: e.target.checked })} />Daily discovery</label>
    {([
      ['time', 'Collect sources at IST'], ['enrichTime', 'Classify at IST'],
      ['resultsTime', 'Publish results at IST'], ['notifyTime', 'Notify at IST'],
    ] as const).map(([key, label]) => (
      <label key={key} className="text-sm">{label}<input className={input} type="time" value={value[key]}
        onChange={(e) => setValue({ ...value, [key]: e.target.value })} /></label>
    ))}
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void save(value)}>Save discovery schedule</Button>
    {nextDiscoveryAt && <p className="w-full text-sm text-muted">Next collection · {timeLabel(nextDiscoveryAt)} IST</p>}
  </div>;
}

function TransferDialog({ firms, selection, close, done }: { firms: Firm[]; selection: { ids: string[] } | { query: object }; close: () => void; done: () => void }) {
  const [targets, setTargets] = useState<OrganicTarget[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(confirm: boolean) {
    setBusy(true);
    try {
      if (confirm && preview) {
        await api(endpoint + '/transfer', { method: 'POST', body: { ids: preview.ids, targets } });
        toast.success('Transfer queued');
        done();
      } else setPreview(await api(endpoint + '/transfer/preview', { method: 'POST', body: { ...selection, targets } }));
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <Dialog open title="Transfer to firms" size="lg" onOpenChange={(open) => { if (!open && !busy) close(); }}
    footer={<Button disabled={busy || !targets.length || Boolean(preview && !preview.ids.length)} onClick={() => void run(Boolean(preview))}>{preview ? 'Confirm transfer' : 'Review transfer'}</Button>}>
    {firms.map((firm) => <label className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm" key={firm.id}>
      <span>{firm.name} · {firm.status}{firm.localities.length ? ' · ' + firm.localities.map(({ name }) => name).join(', ') : ''}</span>
      <select className="rounded-xl border border-line bg-surface p-2" value={targets.find((target) => target.organizationId === firm.id)?.brokerAdminId ?? ''}
        onChange={(e) => {
          const other = targets.filter((target) => target.organizationId !== firm.id);
          setTargets(e.target.value ? [...other, { organizationId: firm.id, brokerAdminId: e.target.value }] : other);
          setPreview(null);
        }}><option value="">Choose Broker Admin</option>{firm.members.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}</select>
    </label>)}
    {preview?.firms.map((row) => <p className="py-2 text-sm" key={row.organizationId}>
      {firms.find(({ id }) => id === row.organizationId)?.name} · {row.selected} selected · {row.eligible} eligible · {row.duplicates} duplicates · {row.newRecords} new
    </p>)}
  </Dialog>;
}

const blankSource: OrganicSourceInput = { name: '', url: '', permissionUrl: '', format: 'JSON', supports: ['SUPPLY'], enabled: false,
  contactRedistribution: false, itemsPath: '', minIntervalMinutes: 60, priority: 50 };
function SourcesPage() {
  const [form, setForm] = useState<OrganicSourceInput>(blankSource);
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const data = useQuery({ queryKey: ['organic-sources'], queryFn: () => api<Source[]>(endpoint + '/sources'), refetchInterval: 5000 });
  async function act(path: string, method: 'POST' | 'PATCH', body: unknown, saved = false) {
    setBusy(true);
    try {
      await api(endpoint + path, { method, body });
      if (saved) { setForm(blankSource); setId(''); }
      await data.refetch();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <PageHeader title="Discovery sources" actions={!data.data?.some((source) => source.url === realeGurugramSource.url) && (
      <Button variant="secondary" onClick={() => { setId(''); setForm(realeGurugramSource); }}>Use Gurugram RERA project feed</Button>
    )} />
    <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void act('/sources' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', form, true); }}>
      {([['name', 'Source name'], ['url', 'HTTPS feed or page'], ['permissionUrl', 'Collection and redistribution permission URL'], ['itemsPath', 'JSON item path']] as const).map(([key, label]) => (
        <label className="text-sm" key={key}>{label}<input className={input} required={key !== 'itemsPath'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
      ))}
      <label className="text-sm">Source format<select className={input} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as OrganicSourceInput['format'] })}><option>JSON</option><option>RSS</option><option>HTML</option><option value="RERA_PROJECTS">Gurugram RERA projects</option></select></label>
      {([['minIntervalMinutes', 'Minimum interval (minutes)'], ['priority', 'Priority']] as const).map(([key, label]) => <label className="text-sm" key={key}>{label}
        <input className={input} type="number" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} /></label>)}
      <div className="flex flex-wrap gap-3">
        {(['SUPPLY', 'DEMAND'] as const).map((kind) => <label className="flex items-center gap-2 text-sm" key={kind}><input type="checkbox" checked={form.supports.includes(kind)}
          onChange={(e) => setForm({ ...form, supports: e.target.checked ? [...form.supports, kind] : form.supports.filter((item) => item !== kind) })} />{readableValue(kind)}</label>)}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />Enable source with verified collection and redistribution permission</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.contactRedistribution} onChange={(e) => setForm({ ...form, contactRedistribution: e.target.checked })} />Source explicitly permits sending contacts to firms</label>
      <Button type="submit" disabled={busy || !form.supports.length}>{id ? 'Update source' : 'Add source'}</Button>
      {id && <Button type="button" variant="secondary" onClick={() => { setForm(blankSource); setId(''); }}>Cancel edit</Button>}
    </form>
    {data.error && <ApiErrorState error={data.error} onRetry={() => data.refetch()} />}
    {data.data?.map((source) => <div className="card space-y-2 p-4 text-sm" key={source.id}>
      <h2 className="font-semibold">{source.name} · {source.enabled ? 'Enabled' : 'Disabled'}</h2>
      <p>{source.format} · {source.supports.join(', ')} · Last success {timeLabel(source.lastSuccessAt)}</p>
      <p>{source.lastError ?? (source.lastSuccessAt ? 'Verified fetch' : 'Awaiting successful fetch')}</p>
      {source.lastReport && <p>{Object.entries(source.lastReport).map(([key, value]) => key + ' ' + value).join(' · ')}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => { setForm(source); setId(source.id); }}>Edit source</Button>
        {source.enabled && source.supports.map((kind) => <Button size="sm" variant="secondary" key={kind} disabled={busy}
          onClick={() => void act('/discover', 'POST', { kind, sourceId: source.id })}>Run {kind.toLowerCase()}</Button>)}
      </div>
    </div>)}
  </div>;
}

const blankRule: OrganicDeliveryInput = { organizationId: '', brokerAdminId: '', time: '08:00', enabled: false, sectors: [], leadType: 'ALL' };
function DeliveryPage() {
  const [rule, setRule] = useState<OrganicDeliveryInput>(blankRule);
  const [sectorInput, setSectorInput] = useState('');
  const [preview, setPreview] = useState<{ qualifying: number; alreadyTransferred: number; nextRunAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const data = useQuery({ queryKey: ['organic-delivery'], queryFn: () => api<{ rules: Rule[]; runs: Run[]; firms: Firm[] }>(endpoint + '/delivery'), refetchInterval: 5000 });
  const firm = data.data?.firms.find(({ id }) => id === rule.organizationId);
  function change(next: OrganicDeliveryInput) { setRule(next); setPreview(null); }
  async function act(path: string, body?: unknown) {
    setBusy(true);
    try {
      const result = await api(endpoint + path, { method: 'POST', body });
      if (path.endsWith('/preview')) setPreview(result);
      else { toast.success(path.endsWith('/retry') ? 'Retry queued' : 'Daily schedule saved'); setPreview(null); await data.refetch(); }
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  const body = { ...rule, sectors: sectorInput.split(',').map((value) => value.trim()).filter(Boolean) };
  return <div className="space-y-4">
    <PageHeader title="Daily Lead Delivery" />
    {data.error && <ApiErrorState error={data.error} onRetry={() => data.refetch()} />}
    <div className="card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="text-sm">Broker firm<select className={input} value={rule.organizationId} onChange={(e) => {
        const existing = data.data?.rules.find(({ organizationId }) => organizationId === e.target.value);
        const chosen = data.data?.firms.find(({ id }) => id === e.target.value);
        change(existing ?? { ...blankRule, organizationId: e.target.value, brokerAdminId: chosen?.members[0]?.id ?? '' });
        setSectorInput(existing?.sectors.join(', ') ?? '');
      }}><option value="">Select active firm</option>{data.data?.firms.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-sm">Receiving Broker Admin<select className={input} value={rule.brokerAdminId} onChange={(e) => change({ ...rule, brokerAdminId: e.target.value })}>
        <option value="">Select Broker Admin</option>{firm?.members.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-sm">Daily time IST<input className={input} type="time" value={rule.time} onChange={(e) => change({ ...rule, time: e.target.value })} /></label>
      <label className="text-sm">New leads<select className={input} value={rule.leadType} onChange={(e) => change({ ...rule, leadType: e.target.value as OrganicDeliveryInput['leadType'] })}>
        <option value="ALL">All new eligible leads</option><option value="BUYER">Buyer leads</option><option value="TENANT">Tenant leads</option></select></label>
      <label className="text-sm">Sectors, optional<input className={input} value={sectorInput} placeholder="All sectors"
        onChange={(e) => { setSectorInput(e.target.value); setPreview(null); }} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.enabled} onChange={(e) => change({ ...rule, enabled: e.target.checked })} />Enable daily delivery</label>
      <Button size="sm" variant="secondary" disabled={busy || !rule.brokerAdminId} onClick={() => void act('/delivery/preview', body)}>Preview schedule</Button>
      <Button size="sm" disabled={busy || !rule.brokerAdminId || (rule.enabled && !preview)} onClick={() => void act('/delivery', body)}>Save schedule</Button>
      {preview && <p className="col-span-full text-sm">Next run {timeLabel(preview.nextRunAt)} · {preview.qualifying} qualifying · {preview.alreadyTransferred} already transferred</p>}
    </div>
    <div className="card p-4 space-y-2">
      <h2 className="font-semibold">Saved schedules</h2>
      {data.data?.rules.map((entry) => <p className="text-sm" key={entry.id}>
        {data.data.firms.find(({ id }) => id === entry.organizationId)?.name ?? entry.organizationId} · {entry.enabled ? 'Enabled' : 'Paused'} · {entry.time} IST · next {timeLabel(entry.nextRunAt)}
      </p>)}
    </div>
    <RunHistory runs={data.data?.runs ?? []} retry={(id) => act('/delivery/runs/' + id + '/retry')} />
  </div>;
}

function RunHistory({ runs, retry }: { runs: Run[]; retry?: (id: string) => Promise<void> }) {
  return <div className="card space-y-2 p-4">
    <h2 className="font-semibold">Run history</h2>
    {!runs.length && <p className="text-sm text-muted">No runs yet.</p>}
    {runs.map((run) => <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-sm" key={run.id}>
      {timeLabel(run.windowTo ?? run.createdAt)} · {run.kind} · {run.status}
      {run.report && <span>{Object.entries(run.report).map(([key, value]) => key + ' ' + value).join(' · ')}</span>}
      {retry && run.kind === 'DELIVERY' && run.status === 'PARTIAL' && <Button size="sm" variant="secondary" onClick={() => void retry(run.id)}>Retry delivery</Button>}
    </div>)}
  </div>;
}
