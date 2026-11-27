'use client';
import { useRouteState } from '@/lib/navigation';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { Dialog } from '@/components/ui/dialog';
import { useConfig, useConfigStatus } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { moduleAllowed } from '@brokeriq/shared';
import { formatINR, hasDelegatedAccess, readableValue } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { del, useApiMutation } from '@/lib/hooks';
import { emptyClientRequirementFilters } from '@brokeriq/shared';
import { ClientRequirementFilters } from '@/components/broker/launch/client-requirement-filters';
import { qs } from '@/lib/utils';
export default function RequirementsPage() {
  return (
    <Suspense>
      <RequirementsInner />
    </Suspense>
  );
}
function RequirementsInner() {
  const { user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const config = useConfig();
  const configStatus = useConfigStatus();
  const inventoryAllowed = configStatus.loaded && !!user && moduleAllowed(config.modules, 'inventory', user.role);
  const [search, setSearch] = useRouteState('requirements.search', '');
  const canEdit = hasDelegatedAccess(user, 'leads', 'view', 'edit');
  const canDelete = hasDelegatedAccess(user, 'leads', 'view', 'delete');
  const removal = useApiMutation((id: string) => del('/broker-requirements/' + id), { invalidate: [['broker-requirements']] });
  const [intent, setIntent] = useRouteState('requirements.intent', '');
  const [filters, setFilters] = useRouteState('requirements.clientFilters', emptyClientRequirementFilters);
  const [match, setMatch] = useState<string | null>(null);
  const [page, setPage] = useRouteState('requirements.page', 1);
  const requestedId = params.get('record');
  useEffect(() => {
    if (requestedId) router.replace(`/broker/leads/requirements/${encodeURIComponent(requestedId)}/edit`);
  }, [requestedId, router]);
  const query = useQuery({
    queryKey: ['broker-requirements', page, search, intent, filters],
    queryFn: () => api<any>(`/broker-requirements${qs({ page, search, intent, ...filters })}`),
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
              {config.flags.connect_whatsapp_cutover ? 'Scan / paste' : 'Scan / paste / chat export'}
            </Link>
            <Link href="/broker/leads/requirements/new" className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white">
              + Requirement
            </Link>
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
      <div className="mb-5">
        <ClientRequirementFilters
          value={filters}
          onApply={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
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
                {canEdit && (
                  <Link href={`/broker/leads/requirements/${item.id}/edit`} className="text-sm font-semibold text-brand-600">
                    Review / edit
                  </Link>
                )}
                {canDelete && (
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={removal.isPending}
                    onClick={() => {
                      if (window.confirm('Archive this requirement?')) removal.mutate(item.id);
                    }}
                  >
                    Archive requirement
                  </Button>
                )}
                {inventoryAllowed && item.intent === 'OFFER' && !item.convertedAt && item.status === 'OPEN' && (
                  <Link href={`/broker/leads/requirements/${item.id}/convert`} className="text-sm font-semibold text-brand-600">
                    Review and add to inventory →
                  </Link>
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
