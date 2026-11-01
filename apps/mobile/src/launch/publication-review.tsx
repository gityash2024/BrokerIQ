import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import type { LedgerItem } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Txt, Input, ErrorView, Card } from '@/ui';

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
  const listing = item?.publishedListing ?? supplied;
  const [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const allowed = listing?.status === 'PENDING_REVIEW' && user?.role === 'BROKER_ADMIN' && listing.reviewRequiredRole === 'BROKER_ADMIN';
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
    <Card style={{ padding: 16, gap: 12 }}>
      <Txt v="h3">Publication · {listing.status}</Txt>
      {!!listing.reviewRequiredRole && <Txt v="small">Awaiting {listing.reviewRequiredRole === 'BROKER_ADMIN' ? 'Broker Admin' : 'Super Admin'}</Txt>}
      {!!listing.rejectionReason && <Txt color="danger">{listing.rejectionReason}</Txt>}
      {item && ['ACTIVE', 'PENDING_REVIEW'].includes(listing.status) && (
        <Button title="Withdraw publication" variant="secondary" loading={busy} onPress={withdraw} />
      )}
      {allowed && (
        <>
          <Txt v="title">{preview.data?.title || listing.title}</Txt>
          {preview.data && (
            <>
              <Txt>{'₹' + Number(preview.data.price).toLocaleString('en-IN') + (preview.data.purpose === 'RENT' ? '/month' : '')}</Txt>
              <Txt>{preview.data.description}</Txt>
              <Txt v="small">
                Public contact: {preview.data.contactName} {preview.data.contactPhone}
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {preview.data.media?.map((m: any) => (
                  <Image key={m.id || m.url} source={{ uri: m.url }} style={{ width: 100, height: 100, borderRadius: 10 }} contentFit="cover" />
                ))}
              </View>
            </>
          )}
          {preview.error && <ErrorView error={preview.error} onRetry={() => preview.refetch()} />}
          <Input label="Rejection reason" value={reason} onChangeText={setReason} maxLength={500} multiline />
          <Button title="Approve and publish" loading={busy} disabled={!preview.data} onPress={() => review('approve')} />
          <Button title="Reject with reason" variant="secondary" disabled={busy || !reason.trim()} onPress={() => review('reject')} />
        </>
      )}
      {!!error && <Txt color="danger">{error}</Txt>}
    </Card>
  );
}
