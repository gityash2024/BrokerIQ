'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LedgerItem } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';

export function PublicationReview({
  item,
  listing: supplied,
  onDone,
}: {
  item?: LedgerItem;
  listing?: NonNullable<LedgerItem['publishedListing']>;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const listing = item?.publishedListing ?? supplied;
  const allowed =
    listing?.status === 'PENDING_REVIEW' && (user?.role === 'SUPER_ADMIN' || (user?.role === 'BROKER_ADMIN' && listing.reviewRequiredRole === 'BROKER_ADMIN'));
  const preview = useQuery({
    queryKey: ['publication-preview', listing?.id, listing?.updatedAt],
    queryFn: () => api<any>('/listings/' + listing?.id),
    enabled: !!allowed,
  });
  if (!listing) return null;
  async function review(action: 'approve' | 'reject') {
    setBusy(true);
    setError('');
    try {
      await api(`/inventory/publications/${listing!.id}/review`, { body: { action, reason, expectedUpdatedAt: listing!.updatedAt } });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    setBusy(true);
    setError('');
    try {
      await api(`/inventory/${item!.id}/publication/withdraw`, { body: {} });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border border-line p-4">
      <h3 className="font-semibold">Publication · {listing.status}</h3>
      {listing.reviewRequiredRole && (
        <p className="text-sm text-muted">Awaiting {listing.reviewRequiredRole === 'BROKER_ADMIN' ? 'Broker Admin' : 'Super Admin'} review</p>
      )}
      {listing.rejectionReason && <p role="alert">{listing.rejectionReason}</p>}
      {listing.status === 'ACTIVE' && (
        <a href={'/property/' + listing.slug} target="_blank" rel="noreferrer" className="text-brand-600 underline">
          View public property
        </a>
      )}
      {item && ['ACTIVE', 'PENDING_REVIEW'].includes(listing.status) && (
        <Button variant="secondary" loading={busy} onClick={withdraw}>
          Withdraw publication
        </Button>
      )}
      {allowed && (
        <>
          <p className="font-semibold">{preview.data?.title || listing.title}</p>
          {preview.data && (
            <>
              <p>
                ₹{Number(preview.data.price).toLocaleString('en-IN')}
                {preview.data.purpose === 'RENT' ? '/month' : ''}
              </p>
              <p className="whitespace-pre-wrap text-sm">{preview.data.description}</p>
              <p className="text-sm">
                Public contact: {preview.data.contactName} {preview.data.contactPhone}
              </p>
              <div className="flex flex-wrap gap-2">
                {preview.data.media?.map((m: any) => (
                  <img key={m.id || m.url} src={m.url} alt="Submitted public property photo" className="size-28 rounded-lg object-cover" />
                ))}
              </div>
            </>
          )}
          {preview.isError && <p role="alert">{errorMessage(preview.error)}</p>}
          <Field label="Rejection reason (required to reject)">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          <div className="flex gap-3">
            <Button loading={busy} disabled={!preview.data} onClick={() => review('approve')}>
              Approve and publish
            </Button>
            <Button variant="secondary" disabled={busy || !reason.trim()} onClick={() => review('reject')}>
              Reject with reason
            </Button>
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
