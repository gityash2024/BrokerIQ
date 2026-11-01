'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { Dialog } from '@/components/ui/dialog';
import { RequirementRecordForm } from '@/components/broker/launch/requirement-record-form';
import { useConfig, useConfigStatus } from '@/lib/config';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { PropertyForm } from '@/components/broker/launch/property-form';
import { offeredRequirement, moduleAllowed } from '@brokeriq/shared';
import { formatINR, readableValue } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
export default function RequirementsPage() {
  const { user } = useAuth();
  const config = useConfig();
  const configStatus = useConfigStatus();
  const inventoryAllowed = configStatus.loaded && !!user && moduleAllowed(config.modules, 'inventory', user.role);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [converting, setConverting] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [intent, setIntent] = useState('');
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['broker-requirements', page, search, intent],
    queryFn: () => api<any>(`/broker-requirements?page=${page}&search=${encodeURIComponent(search)}${intent ? '&intent=' + intent : ''}`),
  });
  const matches = useQuery({ queryKey: ['requirement-matches', match], queryFn: () => api<any>(`/broker-requirements/${match}/matches`), enabled: !!match });
  return (
    <>
      <PageHeader
        title="Requirements"
        subtitle="Customer requirements, property offers और review records — Inventory से स्वतंत्र"
        actions={
          <>
            <Link href="/broker/imports?target=REQUIREMENT" className="rounded-xl border border-line px-4 py-2 font-semibold">
              Scan / paste / chat export
            </Link>
            <button onClick={() => setAdding(true)} className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white">
              + Requirement
            </button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap gap-5 text-sm">
        <Link href="/broker/leads">Contacts & leads</Link>
        <Link href="/broker/pipeline">Pipeline</Link>
        <Link href="/broker/follow-ups">Follow-ups</Link>
        <Link href="/broker/visits">Visits</Link>
      </div>
      <div className="mb-5 flex gap-3">
        <Input
          aria-label="Search requirements"
          placeholder="Contact, phone or notes"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label="Record type filter"
          value={intent}
          onChange={(e) => {
            setIntent(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All records</option>
          <option value="DEMAND">Customer requirements</option>
          <option value="OFFER">Property offers</option>
          <option value="UNKNOWN">Needs review</option>
        </Select>
      </div>
      {query.error ? (
        <p role="alert">{errorMessage(query.error)}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {query.data?.items.map((item: any) => (
            <article key={item.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex justify-between">
                <h2 className="font-bold">{item.title || item.contactName || 'Contact not recorded'}</h2>
                <span className="text-xs text-muted">
                  {item.convertedAt ? 'Converted' : item.intent || 'DEMAND'} · {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm">
                {item.purpose || 'Purpose unknown'} · {item.bedrooms.join(', ') || 'Rooms not specified'} {item.roomKind || ''}
              </p>
              <p className="mt-1 text-sm text-muted">{item.localityNames.join(' · ') || 'Locality unknown'}</p>
              <p className="mt-3 font-semibold">
                {item.minBudget != null ? formatINR(item.minBudget) : 'No minimum'} — {item.maxBudget != null ? formatINR(item.maxBudget) : 'No maximum'}
              </p>
              <p className="mt-2 line-clamp-3 text-xs text-muted">{item.notes}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                {[
                  ['Phone', item.contactPhone],
                  ['Property types', item.propertyTypes?.map(readableValue).join(' · ')],
                  ['Furnishing', item.furnishing && readableValue(item.furnishing)],
                  [
                    'Area preference',
                    item.minArea != null || item.maxArea != null
                      ? `${item.minArea ?? 'Any'} – ${item.maxArea ?? 'Any'} ${item.areaUnit ? readableValue(item.areaUnit) : ''}`
                      : null,
                  ],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted">{label}</dt>
                      <dd className="mt-1 font-medium">{value}</dd>
                    </div>
                  ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => setEditing(item)} className="text-sm font-semibold text-brand-600">
                  Review / edit
                </button>
                {inventoryAllowed && item.intent === 'OFFER' && !item.convertedAt && item.status === 'OPEN' && (
                  <button onClick={() => setConverting(item)} className="text-sm font-semibold text-brand-600">
                    Review and add to inventory →
                  </button>
                )}
                {item.convertedAt && <span className="text-xs text-muted">Independent inventory record created; original source retained</span>}
                {(item.intent === 'DEMAND' || !item.intent) && (
                  <button onClick={() => setMatch(item.id)} className="text-sm font-semibold text-brand-600">
                    Find matching properties →
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {query.isPending && (
        <p role="status" className="card p-10 text-center text-sm text-muted">
          Loading requirements…
        </p>
      )}
      {query.data?.total === 0 && (
        <p className="rounded-xl border border-line p-8 text-center text-muted">Add a requirement or approve one from Inbox imports.</p>
      )}
      <div className="mt-5 flex justify-end gap-5 text-sm">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button disabled={!query.data || page >= query.data.totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
      <Dialog
        open={adding || !!editing}
        onOpenChange={(open) => {
          if (!open && dirty && !window.confirm('Discard unsaved requirement changes?')) return;
          setAdding(open);
          if (!open) setEditing(null);
          if (!open) setDirty(false);
        }}
        title={editing ? 'Review requirement' : 'New requirement'}
        size="lg"
      >
        <RequirementRecordForm
          key={editing?.id || 'new'}
          initial={editing || {}}
          onDirty={() => setDirty(true)}
          onSave={async (body) => {
            await api(editing ? `/broker-requirements/${editing.id}` : '/broker-requirements', { method: editing ? 'PATCH' : 'POST', body });
            setAdding(false);
            setEditing(null);
            setDirty(false);
            await qc.invalidateQueries({ queryKey: ['broker-requirements'] });
          }}
        />
      </Dialog>
      <Dialog
        open={!!converting}
        onOpenChange={(open) => {
          if (!busy && !open) setConverting(null);
        }}
        title="Review property before inventory conversion"
        size="lg"
      >
        {converting && (
          <>
            <p className="mb-4 text-sm text-muted">
              Save any corrections first. Conversion creates one independent inventory record and retains this original requirement and source.
            </p>
            <PropertyForm
              key={converting.id}
              initial={converting.offerDetails || {}}
              label="Save reviewed property details"
              onSave={async (data) => {
                const saved = await api<any>(`/broker-requirements/${converting.id}`, {
                  method: 'PATCH',
                  body: { ...offeredRequirement(data), leadId: converting.leadId, expectedRevision: converting.revision },
                });
                setConverting(saved);
                await qc.invalidateQueries({ queryKey: ['broker-requirements'] });
                toast.success('Reviewed offer saved');
              }}
            />
            <Button
              className="mt-4"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/broker-requirements/${converting.id}/convert`, { body: { expectedRevision: converting.revision } });
                  setConverting(null);
                  await Promise.all([qc.invalidateQueries({ queryKey: ['broker-requirements'] }), qc.invalidateQueries({ queryKey: ['inventory'] })]);
                  toast.success('Independent inventory record created');
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm · add to inventory
            </Button>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!match}
        onOpenChange={(open) => {
          if (!open) setMatch(null);
        }}
        title="Matching inventory"
        size="lg"
      >
        {matches.error && <p role="alert">{errorMessage(matches.error)}</p>}
        {['available', 'unknown'].map((group) => (
          <div key={group} className="mb-5">
            <h2 className="mb-3 font-bold">{group === 'available' ? 'Confirmed available' : 'Availability needs confirmation'}</h2>
            {matches.data?.[group].map((m: any) => {
              const inner = (
                <>
                  <p className="font-semibold">
                    {m.item.houseNo || 'House not recorded'} · {m.item.sector}
                  </p>
                  <p className="mt-1 text-xs text-muted">{m.reasons.join(' · ')}</p>
                </>
              );
              return user?.role === 'BROKER_AGENT' ? (
                <div key={m.item.id} className="mb-2 block rounded-xl border border-line p-3">
                  {inner}
                </div>
              ) : (
                <Link
                  key={m.item.id}
                  href={`/broker/inventory?search=${encodeURIComponent(m.item.houseNo || m.item.sector || '')}`}
                  className="mb-2 block rounded-xl border border-line p-3"
                >
                  {inner}
                </Link>
              );
            })}
            {matches.data?.[group].length === 0 && <p className="text-sm text-muted">No matches in this group</p>}
          </div>
        ))}
      </Dialog>
    </>
  );
}
