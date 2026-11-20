import { toast } from '@/lib/toast';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, ownerChangeSummary, readableValue, type InventoryOwnerInfo, type LedgerItem } from '@brokeriq/shared';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, ErrorView, Input, Row, Sheet, Txt } from '@/ui';
import { NativeCard } from './screen';

export function PropertyOwnerPanel({ item }: { item: LedgerItem }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const canLink = user?.role === 'BROKER_ADMIN' || (user?.role === 'SUB_BROKER_ADMIN' && hasDelegatedAccess(user, 'inventory', 'view', 'assign'));
  const canReview = user?.role === 'BROKER_ADMIN' || (user?.role === 'SUB_BROKER_ADMIN' && hasDelegatedAccess(user, 'inventory', 'view', 'edit'));
  const allowed = canLink || user?.role === 'SUB_BROKER_ADMIN' || (user?.role === 'BROKER_AGENT' && item.canEdit !== false);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [candidate, setCandidate] = useState<string | null>(null);
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
  if (!allowed || item.deletedAt || (!canLink && !info.data?.owner && !info.data?.report)) return null;

  async function link() {
    if (!canLink || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/inventory/' + encodeURIComponent(item.id) + '/owner', {
        method: 'PATCH',
        body: { ownerUserId: candidate, expectedRevision: item.revision },
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
  function confirmApply() {
    if (item.publishedListing?.status !== 'ACTIVE') {
      void review(true);
      return;
    }
    Alert.alert('Apply owner changes?', 'The live listing may be withdrawn until it is republished.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Apply changes', onPress: () => void review(true) },
    ]);
  }
  return (
    <NativeCard style={{ gap: 8 }}>
      <Row wrap gap={8}>
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong">Property owner</Txt>
          <Txt v="caption" color="muted">
            {info.data?.owner?.name ?? 'No owner account linked'}
          </Txt>
        </View>
        {canLink && info.data && (
          <Button
            title="Manage owner"
            size="sm"
            variant="secondary"
            onPress={() => {
              setError('');
              setSearch('');
              setCandidate(info.data?.owner?.id ?? null);
              setEditing(true);
            }}
          />
        )}
      </Row>
      {info.error && <ErrorView error={info.error} onRetry={() => info.refetch()} />}
      {info.data?.submissionPending && (
        <View style={{ gap: 6 }}>
          <Txt color="muted">New owner submission awaiting acceptance</Txt>
          {canReview && <Button title="Accept property" size="sm" loading={busy} onPress={() => void acceptSubmission()} />}
        </View>
      )}
      {proposal && (
        <View style={{ gap: 6 }}>
          <Txt v="bodyStrong">Owner changes to review</Txt>
          {ownerChangeSummary(proposal.changes).map(({ key, label, display }) => (
            <Txt key={key} v="caption">
              {label} · {display}
            </Txt>
          ))}
          <Row wrap gap={6}>
            {[...(proposal.changes.photoUrls ?? []), ...(proposal.changes.videoUrls ?? [])].map((url, index) => (
              <Button
                key={index}
                title={'Open media ' + (index + 1)}
                size="sm"
                variant="ghost"
                onPress={() => void Linking.openURL(url).catch(() => setError('Unable to open this file'))}
              />
            ))}
          </Row>
          {canReview && (
            <Row wrap gap={8}>
              <Button title="Apply owner changes" size="sm" disabled={busy} onPress={confirmApply} />
              <Button title="Decline changes" size="sm" variant="secondary" disabled={busy} onPress={() => void review(false)} />
            </Row>
          )}
        </View>
      )}
      {!editing && !!error && (
        <Txt color="danger" accessibilityRole="alert">
          {error}
        </Txt>
      )}
      {info.data?.report && (
        <View style={{ gap: 4 }}>
          <Txt v="bodyStrong">Latest owner update</Txt>
          <Txt>
            {readableValue(info.data.report.status)}
            {info.data.report.availableFrom && ' · Available from ' + info.data.report.availableFrom}
          </Txt>
          {info.data.report.note && <Txt>{info.data.report.note}</Txt>}
          <Txt v="caption" color="muted">
            {info.data.report.owner?.name} · {new Date(info.data.report.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </Txt>
        </View>
      )}
      <Sheet
        open={editing}
        onClose={() => {
          if (!busy) setEditing(false);
        }}
        title="Manage owner"
        footer={<Button title="Save owner" loading={busy} disabled={candidate === (info.data?.owner?.id ?? null)} onPress={() => void link()} />}
      >
        <Input label="Search owner accounts" value={search} editable={!busy} onChangeText={setSearch} />
        <Button title="No owner linked" size="sm" variant={candidate === null ? 'primary' : 'secondary'} disabled={busy} onPress={() => setCandidate(null)} />
        {owners.data?.map((owner) => (
          <Button
            key={owner.id}
            title={owner.name + ' · ' + owner.email}
            size="sm"
            variant={candidate === owner.id ? 'primary' : 'secondary'}
            disabled={busy}
            onPress={() => setCandidate(owner.id)}
          />
        ))}
        {owners.error && <ErrorView error={owners.error} onRetry={() => owners.refetch()} />}
        {!!error && (
          <Txt color="danger" accessibilityRole="alert">
            {error}
          </Txt>
        )}
      </Sheet>
    </NativeCard>
  );
}
