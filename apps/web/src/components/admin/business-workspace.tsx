'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ADMIN_BUSINESS_RESOURCES, type AdminBusinessResource, type AdminBusinessPage } from '@brokeriq/shared';
import { api, apiBlob, errorMessage } from '@/lib/api';
import { qs, formatDateTime } from '@/lib/utils';
import { useDebounced } from '@/lib/hooks';
import { PageHeader } from '@/components/panel/shell';
import { InventoryHierarchyPicker } from '@/components/broker/launch/inventory-hierarchy-picker';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';

export function AdminBusinessWorkspace({ initial }: { initial: Record<string, string> }) {
  const [resource, setResource] = useState<AdminBusinessResource>(
    Object.hasOwn(ADMIN_BUSINESS_RESOURCES, initial.resource) ? (initial.resource as AdminBusinessResource) : 'leads',
  );
  const [org, setOrg] = useState(initial.organizationId ?? '');
  const [member, setMember] = useState(initial.memberId ?? '');
  const [search, setSearch] = useState(initial.q ?? '');
  const term = useDebounced(search);
  const [status, setStatus] = useState(initial.status ?? '');
  const [archive, setArchive] = useState(['all', 'active', 'archived'].includes(initial.archive) ? initial.archive : 'all');
  const [sort, setSort] = useState(initial.sort === 'oldest' ? 'oldest' : 'newest');
  const validDate = (value: string | undefined) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00+05:30')) ? value : '';
  const [from, setFrom] = useState(validDate(initial.fromDate));
  const [to, setTo] = useState(validDate(initial.toDate));
  const [page, setPage] = useState(/^\d+$/.test(initial.page ?? '') ? Math.max(1, Math.min(100000, Number(initial.page))) : 1);
  const [selected, setSelected] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const supportsMember = !['automations', 'webhooks', 'jobs'].includes(resource);
  const filters = {
    organizationId: org || undefined,
    memberId: supportsMember ? member || undefined : undefined,
    q: term || undefined,
    status: status || undefined,
    archive,
    sort,
    from: from ? new Date(from + 'T00:00:00+05:30').toISOString() : undefined,
    to: to ? new Date(to + 'T23:59:59.999+05:30').toISOString() : undefined,
  };
  const list = useQuery({
    queryKey: ['admin-business', resource, filters, page],
    queryFn: () => api<AdminBusinessPage>(`/admin/business/${resource}${qs({ ...filters, page, pageSize: 30 })}`),
  });
  const counts = useQuery({
    queryKey: ['admin-business-counts', org, member, filters.from, filters.to],
    queryFn: () =>
      api<{ items: { resource: AdminBusinessResource; label: string; total: number | null }[] }>(
        `/admin/business/counts${qs({ organizationId: org || undefined, memberId: member || undefined, from: filters.from, to: filters.to })}`,
      ),
  });
  const context = qs({
    resource,
    organizationId: org || undefined,
    memberId: member || undefined,
    q: term || undefined,
    fromDate: from || undefined,
    toDate: to || undefined,
    status: status || undefined,
    archive,
    sort,
    page,
  });
  function changed() {
    setPage(1);
    setSelected([]);
    setExportError('');
  }
  function choose(value: AdminBusinessResource) {
    if (['automations', 'webhooks', 'jobs'].includes(value)) setMember('');
    setResource(value);
    setStatus('');
    setArchive('all');
    changed();
  }
  async function download(selection = false) {
    setExporting(true);
    setExportError('');
    try {
      const blob = await apiBlob(`/admin/business/${resource}/export${qs({ ...filters, ...(selection ? { ids: selected.join(',') } : {}) })}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `brokeriq-${resource}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setExportError(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Business records"
        subtitle="All firms and members · view, filter and export business records"
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              void list.refetch();
              void counts.refetch();
            }}
          >
            Refresh
          </Button>
        }
      />
      <section className="mb-5 flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-surface p-4" aria-label="Business hierarchy">
        <InventoryHierarchyPicker
          endpoint="/admin/business/hierarchy"
          kind="organizations"
          value={org}
          onChange={(id) => {
            setOrg(id);
            setMember('');
            changed();
          }}
        />
        {supportsMember && (
          <InventoryHierarchyPicker
            endpoint="/admin/business/hierarchy"
            kind="members"
            pickerLabel="Member"
            organizationId={org || undefined}
            value={member}
            onChange={(id) => {
              setMember(id);
              changed();
            }}
          />
        )}
        <label className="text-xs font-semibold">
          From (IST)
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              changed();
            }}
          />
        </label>
        <label className="text-xs font-semibold">
          To (IST)
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              changed();
            }}
          />
        </label>
      </section>
      {counts.error && <ApiErrorState error={counts.error} onRetry={() => counts.refetch()} />}
      <p className="mb-2 text-xs text-muted">Module totals follow firm, member and dates. Search, status and archive apply to the records below.</p>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Module totals">
        {(counts.data?.items ?? []).map((x) => (
          <button
            key={x.resource}
            onClick={() => choose(x.resource)}
            aria-pressed={resource === x.resource}
            className={`rounded-xl border p-3 text-left ${resource === x.resource ? 'border-brand-500 bg-brand-500/10' : 'border-line bg-surface'}`}
          >
            <span className="block text-xs text-muted">{x.label}</span>
            <strong className="text-xl">{x.total === null ? '—' : x.total.toLocaleString('en-IN')}</strong>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-48 text-xs font-semibold">
          Module
          <Select value={resource} onChange={(e) => choose(e.target.value as AdminBusinessResource)}>
            {Object.entries(ADMIN_BUSINESS_RESOURCES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="min-w-52 flex-1 text-xs font-semibold">
          Search
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              changed();
            }}
            placeholder="Name, reference or contact"
          />
        </label>
        <label className="text-xs font-semibold">
          Status
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              changed();
            }}
          >
            <option value="">All statuses</option>
            {list.data?.statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-semibold">
          Archive
          <Select
            disabled={!list.data?.supportsArchive}
            value={archive}
            onChange={(e) => {
              setArchive(e.target.value);
              changed();
            }}
          >
            <option value="all">All records</option>
            <option value="active">Current records</option>
            <option value="archived">Archived / superseded</option>
          </Select>
        </label>
        <label className="text-xs font-semibold">
          Sort
          <Select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              changed();
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </label>
        <Button variant="secondary" disabled={exporting || list.isFetching || !!list.error} onClick={() => download()}>
          Export filtered
        </Button>
        {selected.length > 0 && (
          <Button variant="secondary" disabled={exporting || list.isFetching} onClick={() => download(true)}>
            Export selected ({selected.length})
          </Button>
        )}
      </div>
      {exportError && (
        <p className="mb-3 text-sm text-rose-600" role="alert">
          {exportError}
        </p>
      )}
      {list.error ? (
        <ApiErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <div className="card p-8 text-muted">Loading business records…</div>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">
            {list.data.total.toLocaleString('en-IN')} matching records · {selected.length} selected
          </p>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="p-3">
                    <input
                      aria-label="Select this page"
                      type="checkbox"
                      checked={list.data.items.length > 0 && list.data.items.every((x) => selected.includes(x.id))}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...new Set([...selected, ...list.data.items.map((x) => x.id)])]
                            : selected.filter((id) => !list.data.items.some((x) => x.id === id)),
                        )
                      }
                    />
                  </th>
                  <th className="p-3">Record</th>
                  <th className="p-3">Firm</th>
                  <th className="p-3">Member</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="p-3">
                      <input
                        aria-label={`Select ${row.title}`}
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(e) => setSelected(e.target.checked ? [...selected, row.id] : selected.filter((x) => x !== row.id))}
                      />
                    </td>
                    <td className="max-w-md p-3">
                      <Link
                        className="font-semibold text-brand-600 hover:underline"
                        href={`/admin/business/${resource}/${encodeURIComponent(row.id)}${context}`}
                      >
                        {row.title}
                      </Link>
                      <p className="mt-1 break-all text-xs text-muted">{row.id}</p>
                    </td>
                    <td className="p-3">{row.firm ?? 'Platform / no firm'}</td>
                    <td className="p-3">{row.member ?? 'Unassigned'}</td>
                    <td className="p-3">{row.status ?? '—'}</td>
                    <td className="whitespace-nowrap p-3">{formatDateTime(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.items.length && <p className="p-8 text-center text-muted">No records match these filters.</p>}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted">
              Page {page} / {Math.max(1, list.data.totalPages)}
            </span>
            <Button variant="secondary" disabled={page >= list.data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}

export function AdminBusinessDetail({ resource, id, back }: { resource: AdminBusinessResource; id: string; back: string }) {
  const data = useQuery({
    queryKey: ['admin-business-detail', resource, id],
    queryFn: () => api<Record<string, unknown>>(`/admin/business/${resource}/${encodeURIComponent(id)}`),
  });
  const related: Record<string, AdminBusinessResource> = {
    leadId: 'leads',
    sourceEntryId: 'sources',
    batchId: 'imports',
    convertedInventoryId: 'inventory',
    inventoryId: 'inventory',
    listingId: 'listings',
    publishedListingId: 'listings',
    conversationId: 'conversations',
    ruleId: 'automations',
  };
  const label = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  return (
    <>
      <nav className="mb-3 text-sm text-muted">
        <Link href={`/admin/business${back}`} className="text-brand-600 hover:underline">
          Business records
        </Link>{' '}
        / {ADMIN_BUSINESS_RESOURCES[resource]}
      </nav>
      <PageHeader title={String(data.data?.title ?? ADMIN_BUSINESS_RESOURCES[resource])} subtitle={id} />
      {data.error ? (
        <ApiErrorState error={data.error} onRetry={() => data.refetch()} />
      ) : !data.data ? (
        <div className="card p-8">Loading record…</div>
      ) : (
        <dl className="grid gap-3 md:grid-cols-2">
          {Object.entries(data.data).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-line bg-surface p-4">
              <dt className="mb-1 text-xs font-semibold text-muted">{label(key)}</dt>
              <dd className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm">
                {value === null ? (
                  '—'
                ) : related[key] && typeof value === 'string' ? (
                  <Link className="text-brand-600 hover:underline" href={`/admin/business/${related[key]}/${encodeURIComponent(value)}${back}`}>
                    {value}
                  </Link>
                ) : typeof value === 'object' ? (
                  JSON.stringify(value, null, 2)
                ) : (
                  String(value)
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-4 flex gap-3">
        <Button href={`/admin/business${back}`} variant="secondary">
          Back to records
        </Button>
        {resource === 'kyc' && (
          <Button href="/admin/kyc" variant="secondary">
            Open KYC review
          </Button>
        )}
        {resource === 'inventory' && (
          <Button href="/admin/inventory" variant="secondary">
            Open Inventory
          </Button>
        )}
      </div>
    </>
  );
}
