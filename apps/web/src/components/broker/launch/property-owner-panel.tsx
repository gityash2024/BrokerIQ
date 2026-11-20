'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, ownerChangeSummary, readableValue, type InventoryOwnerInfo, type LedgerItem } from '@brokeriq/shared';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PropertyMedia } from './property-media';

export function PropertyOwnerPanel({ item }: { item: LedgerItem }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const canLink = user?.role === 'BROKER_ADMIN' || (user?.role === 'SUB_BROKER_ADMIN' && hasDelegatedAccess(user, 'inventory', 'view', 'assign'));
  const canReview = user?.role === 'BROKER_ADMIN' || (user?.role === 'SUB_BROKER_ADMIN' && hasDelegatedAccess(user, 'inventory', 'view', 'edit'));
  const allowed = canLink || user?.role === 'SUB_BROKER_ADMIN' || (user?.role === 'BROKER_AGENT' && item.canEdit !== false);
  const [editing, setEditing] = useState(false);
  const [candidate, setCandidate] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const info = useQuery({
    queryKey: ['inventory-owner', user?.id, item.id],
    queryFn: () => api<InventoryOwnerInfo>('/inventory/' + encodeURIComponent(item.id) + '/owner'),
    enabled: !!allowed && !item.deletedAt,
    refetchInterval: 30_000,
  });
  const owners = useQuery({
    queryKey: ['firm-property-owners', user?.id, search.trim()],
    queryFn: () => api<{ id: string; name: string; email: string }[]>('/inventory/owners?search=' + encodeURIComponent(search.trim())),
    enabled: canLink && editing,
  });
  useEffect(() => {
    setEditing(false);
    setCandidate('');
    setError('');
    setSearch('');
  }, [item.id, user?.id]);
  if (!allowed || item.deletedAt || (!canLink && !info.data?.owner && !info.data?.report)) return null;

  async function link() {
    if (!canLink || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/inventory/' + encodeURIComponent(item.id) + '/owner', {
        method: 'PATCH',
        body: { ownerUserId: candidate || null, expectedRevision: item.revision },
        ownerContext: captureAccountContext(),
      });
      await Promise.all([info.refetch(), client.invalidateQueries({ queryKey: ['ledger-item'] })]);
      setEditing(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function acceptSubmission() {
    if (!canReview || busy || !info.data?.submissionPending) return;
    setBusy(true);
    setError('');
    try {
      await api('/inventory/' + encodeURIComponent(item.id) + '/owner/accept', {
        method: 'POST',
        body: { expectedRevision: item.revision },
        ownerContext: captureAccountContext(),
      });
      await Promise.all([
        info.refetch(),
        ...['owner-submissions', 'ledger-item', 'ledger', 'ledger-stats', 'inventory-folders', 'inventory-folder-items'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      ]);
      toast.success('Property accepted into Available Inventory');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const proposal = info.data?.pendingChanges;
  async function review(accept: boolean) {
    if (!proposal || !canReview || busy) return;
    if (
      accept &&
      item.publishedListing?.status === 'ACTIVE' &&
      !window.confirm('Applying changes may withdraw the live listing until it is republished. Continue?')
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api('/inventory/' + encodeURIComponent(item.id) + '/owner/review', {
        method: 'POST',
        body: { proposalId: proposal.id, expectedRevision: item.revision, accept },
        ownerContext: captureAccountContext(),
      });
      await Promise.all([info.refetch(), client.invalidateQueries({ queryKey: ['ledger-item'] })]);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card space-y-2 p-4" aria-label="Property owner">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">Property owner</h3>
          <p className="text-sm text-muted">{info.data?.owner?.name ?? 'No owner account linked'}</p>
        </div>
        {canLink && info.data && !editing && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setCandidate(info.data.owner?.id ?? '');
              setEditing(true);
            }}
          >
            Manage owner
          </Button>
        )}
      </div>
      {info.error && <ApiErrorState error={info.error} onRetry={() => info.refetch()} />}
      {editing && (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <label className="block text-sm">
            Search owner accounts
            <input
              value={search}
              disabled={busy}
              onChange={(event) => setSearch(event.target.value)}
              className="block min-h-10 rounded-lg border border-line bg-surface px-2"
            />
          </label>
          <label className="block text-sm">
            Owner account
            <select
              value={candidate}
              disabled={busy}
              onChange={(event) => setCandidate(event.target.value)}
              className="block min-h-10 max-w-full rounded-lg border border-line bg-surface px-2"
            >
              <option value="">No owner linked</option>
              {info.data?.owner && !owners.data?.some(({ id }) => id === info.data?.owner?.id) && (
                <option value={info.data.owner.id}>{info.data.owner.name}</option>
              )}
              {owners.data?.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} · {owner.email}
                </option>
              ))}
            </select>
          </label>
          {owners.error && <ApiErrorState error={owners.error} onRetry={() => owners.refetch()} />}
          {!!error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" loading={busy} disabled={candidate === (info.data?.owner?.id ?? '')} onClick={() => void link()}>
              Save owner
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {info.data?.submissionPending && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted">New owner submission awaiting acceptance</p>
          {canReview && (
            <Button size="sm" loading={busy} onClick={() => void acceptSubmission()}>
              Accept property
            </Button>
          )}
        </div>
      )}
      {proposal && (
        <div className="space-y-2 rounded-lg border border-line p-3 text-sm">
          <p className="font-semibold">Owner changes to review</p>
          <dl className="grid gap-1 sm:grid-cols-2">
            {ownerChangeSummary(proposal.changes).map(({ key, label, display }) => (
              <div key={key}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="break-words">{display}</dd>
              </div>
            ))}
          </dl>
          {!!proposal.changes.photoUrls?.length && <PropertyMedia urls={proposal.changes.photoUrls} onAdd={() => undefined} disabled />}
          {!!proposal.changes.videoUrls?.length && <PropertyMedia urls={proposal.changes.videoUrls} onAdd={() => undefined} disabled video />}
          {canReview && (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void review(true)}>
                Apply owner changes
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void review(false)}>
                Decline changes
              </Button>
            </div>
          )}
        </div>
      )}
      {!editing && !!error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      {info.data?.report && (
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <p className="font-semibold">Latest owner update</p>
          <p>
            {readableValue(info.data.report.status)}
            {info.data.report.availableFrom && ' · Available from ' + info.data.report.availableFrom}
          </p>
          {info.data.report.note && <p className="mt-1 break-words">{info.data.report.note}</p>}
          <p className="mt-1 text-xs text-muted">
            {info.data.report.owner?.name} · {new Date(info.data.report.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </p>
        </div>
      )}
    </section>
  );
}
