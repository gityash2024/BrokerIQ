'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ownerReportInputSchema,
  ownerCreatePropertySchema,
  ownerEditPropertySchema,
  ownerPropertyValues,
  inventoryEditorPatch,
  readableValue,
  type OwnerProperty,
  type InventoryInput,
} from '@brokeriq/shared';
import { PropertyForm } from '@/components/broker/launch/property-form';
import { RequireAuth } from '@/components/site/require-auth';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function OwnerPage() {
  return (
    <RequireAuth roles={['PROPERTY_OWNER']}>
      <OwnerProperties />
    </RequireAuth>
  );
}

const choices = ['AVAILABLE', 'UPCOMING', 'RENTED', 'UNAVAILABLE'] as const;
function OwnerProperties() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['owner-properties', user?.id, user?.organization?.id, page],
    queryFn: () => api<{ items: OwnerProperty[]; hasMore: boolean }>('/owner/properties?page=' + page),
  });
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My properties</h1>
          <p className="text-sm text-muted">{user?.organization?.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editor === null && (
            <Button size="sm" onClick={() => setEditor('new')}>
              Add property
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </header>
      {editor !== null ? (
        <OwnerEditor
          key={editor}
          id={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void list.refetch();
          }}
        />
      ) : list.error ? (
        <ApiErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <p role="status">Loading properties…</p>
      ) : (
        <>
          {!list.data.items.length && <p className="card p-4">Add a property or ask your broker to link an existing one.</p>}
          {list.data.items.map((property) => (
            <OwnerPropertyCard key={property.id} property={property} onEdit={() => setEditor(property.id)} refresh={() => void list.refetch()} />
          ))}
          {(page > 1 || list.data.hasMore) && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={!list.data.hasMore} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function OwnerEditor({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const context = useRef(captureAccountContext());
  const mutationId = useRef<string | null>(null);
  const path = '/owner/properties' + (id ? '/' + encodeURIComponent(id) : '');
  const read = useQuery({
    queryKey: ['owner-property', user?.id, id],
    queryFn: () => api<OwnerProperty>(path, { ownerContext: context.current }),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
  if (id && read.error)
    return (
      <section className="card space-y-3 p-4">
        <Button size="sm" variant="secondary" onClick={onClose}>
          Back to my properties
        </Button>
        <ApiErrorState error={read.error} onRetry={() => read.refetch()} />
      </section>
    );
  if (id && !read.data) return <p role="status">Loading property…</p>;
  const record = read.data;
  const baseline = record ? ownerPropertyValues(record as InventoryInput) : {};
  const pending = record?.pendingChanges?.changes;
  const initial = record ? { ...baseline, ...pending, details: { ...baseline.details, ...pending?.details } } : { purpose: 'RENT' as const };

  async function save(input: InventoryInput) {
    mutationId.current ??= crypto.randomUUID();
    const body = record
      ? ownerEditPropertySchema.parse({
          clientMutationId: mutationId.current,
          expectedRevision: record.revision,
          changes: ownerPropertyValues(inventoryEditorPatch(ownerPropertyValues(input), baseline)),
        })
      : ownerCreatePropertySchema.parse({ ...ownerPropertyValues(input), clientMutationId: mutationId.current });
    await api(path, { method: record ? 'PATCH' : 'POST', body, ownerContext: context.current });
    onSaved();
  }
  return (
    <section className="card space-y-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{id ? 'Edit property details' : 'Add property'}</h2>
        <Button size="sm" variant="secondary" onClick={onClose}>
          Back to my properties
        </Button>
      </div>
      {record?.pendingChanges && <p className="text-sm text-muted">You’re editing the details you previously sent for review.</p>}
      <PropertyForm
        ownerMode
        initial={initial}
        label={id ? 'Send changes to broker' : 'Submit property'}
        onDirty={() => {
          mutationId.current = null;
        }}
        onSave={save}
      />
    </section>
  );
}

function OwnerPropertyCard({ property, refresh, onEdit }: { property: OwnerProperty; refresh: () => void; onEdit: () => void }) {
  const [status, setStatus] = useState<(typeof choices)[number]>(property.ownerReport?.status ?? 'AVAILABLE');
  const [availableFrom, setDate] = useState(property.ownerReport?.availableFrom ?? '');
  const [note, setNote] = useState(property.ownerReport?.note ?? '');
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const mutationId = useRef<string>(null);
  async function submit() {
    if (pending) return;
    mutationId.current ??= crypto.randomUUID();
    const parsed = ownerReportInputSchema.safeParse({ clientMutationId: mutationId.current, status, availableFrom: availableFrom || undefined, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setPending(true);
    setError('');
    try {
      await api('/owner/properties/' + encodeURIComponent(property.id) + '/update', {
        method: 'POST',
        body: parsed.data,
        ownerContext: captureAccountContext(),
      });
      mutationId.current = null;
      setEditing(false);
      refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <article className="card space-y-3 p-4">
      <h2 className="font-semibold">
        {[property.houseNo && 'House ' + property.houseNo, property.unitLabel, property.sector].filter(Boolean).join(' · ') || 'Property'}
      </h2>
      <p className="text-sm text-muted">
        {[property.bhk && property.roomKind && property.bhk + ' ' + property.roomKind, property.floor].filter(Boolean).join(' · ')}
      </p>
      {property.ownerReport && (
        <p className="rounded-lg bg-surface-2 p-2 text-sm">
          Last update sent · {readableValue(property.ownerReport.status)}
          {property.ownerReport.availableFrom && ' · ' + property.ownerReport.availableFrom}
        </p>
      )}
      {(property.needsReview || property.hasPendingChanges) && <p className="text-sm text-muted">Property awaiting broker review</p>}
      <p className="text-sm text-muted">
        {[
          property.address,
          property.propertyType && readableValue(property.propertyType),
          property.monthlyRent != null && '₹' + property.monthlyRent.toLocaleString('en-IN') + '/month',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setEditing(true)}>
            Update availability
          </Button>
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Edit details
          </Button>
        </div>
      ) : (
        <form
          className="space-y-3"
          onChange={() => {
            mutationId.current = null;
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="block text-sm">
            Availability
            <select
              className="block min-h-10 w-full rounded-lg border border-line bg-surface px-2"
              value={status}
              disabled={pending}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              {choices.map((value) => (
                <option key={value} value={value}>
                  {value === 'UPCOMING' ? 'Available from a future date' : readableValue(value)}
                </option>
              ))}
            </select>
          </label>
          {
            <label className="block text-sm">
              Available from
              <input
                type="date"
                className="block min-h-10 rounded-lg border border-line bg-surface px-2"
                required={status === 'UPCOMING'}
                value={availableFrom}
                disabled={pending}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          }
          <label className="block text-sm">
            Note for your broker
            <textarea
              className="block min-h-20 w-full rounded-lg border border-line bg-surface p-2"
              maxLength={500}
              value={note}
              disabled={pending}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {!!error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              Send update to broker
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
