import { useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ownerReportInputSchema, readableValue, type OwnerProperty } from '@brokeriq/shared';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Button, Card, ErrorView, Header, Input, Loader, Row, Screen, Sheet, Txt } from '@/ui';
import { ChoiceField } from '@/launch/form';
import { PropertyDateField } from '@/launch/property-date-field';

export default function OwnerProperties() {
  const { user, ready, logout } = useAuth();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OwnerProperty | null>(null);
  const { c } = useTheme();
  const list = useQuery({
    queryKey: ['owner-properties', user?.id, user?.organization?.id, page],
    queryFn: () => api<{ items: OwnerProperty[]; hasMore: boolean }>('/owner/properties?page=' + page),
    enabled: user?.role === 'PROPERTY_OWNER',
  });
  if (!ready) return <Loader />;
  if (user?.role !== 'PROPERTY_OWNER') return <Redirect href="/" />;
  return (
    <Screen style={{ backgroundColor: c.bg }}>
      <Header
        back={false}
        title="My properties"
        subtitle={user.organization?.name}
        right={<Button title="Sign out" variant="ghost" size="sm" onPress={() => void logout()} />}
      />
      <Row gap={8} wrap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Button title="Add property" size="sm" onPress={() => router.push('/owner-property-edit' as never)} />
        <Button title="Saved drafts" size="sm" variant="secondary" onPress={() => router.push('/drafts')} />
      </Row>
      {list.error ? (
        <ErrorView error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <Loader />
      ) : (
        <FlatList
          data={list.data.items}
          keyExtractor={(property) => property.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          onRefresh={() => void list.refetch()}
          refreshing={list.isRefetching}
          ListEmptyComponent={<Txt color="muted">Add a property or ask your broker to link an existing one.</Txt>}
          renderItem={({ item }) => (
            <Card style={{ gap: 8 }}>
              <Txt v="bodyStrong">{[item.houseNo && 'House ' + item.houseNo, item.unitLabel, item.sector].filter(Boolean).join(' · ') || 'Property'}</Txt>
              <Txt v="caption" color="muted">
                {[item.bhk && item.roomKind && item.bhk + ' ' + item.roomKind, item.floor].filter(Boolean).join(' · ')}
              </Txt>
              {item.ownerReport && (
                <Txt v="caption" color="muted">
                  Last update sent · {readableValue(item.ownerReport.status)}
                  {item.ownerReport.availableFrom && ' · ' + item.ownerReport.availableFrom}
                </Txt>
              )}
              {(item.needsReview || item.hasPendingChanges) && (
                <Txt color="muted" v="caption">
                  Property awaiting broker review
                </Txt>
              )}
              <Txt color="muted" v="caption">
                {[
                  item.address,
                  item.propertyType && readableValue(item.propertyType),
                  item.monthlyRent != null && '₹' + item.monthlyRent.toLocaleString('en-IN') + '/month',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Txt>
              <Row gap={8} wrap>
                <Button title="Update availability" size="sm" onPress={() => setSelected(item)} />
                <Button
                  title="Edit details"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/owner-property-edit', params: { id: item.id } } as never)}
                />
              </Row>
            </Card>
          )}
          ListFooterComponent={
            page > 1 || list.data.hasMore ? (
              <Row gap={8}>
                <Button title="Previous" size="sm" variant="secondary" disabled={page <= 1} onPress={() => setPage(page - 1)} />
                <Button title="Next" size="sm" variant="secondary" disabled={!list.data.hasMore} onPress={() => setPage(page + 1)} />
              </Row>
            ) : null
          }
        />
      )}
      {selected && (
        <OwnerUpdateSheet
          item={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            void list.refetch();
          }}
        />
      )}
    </Screen>
  );
}

function OwnerUpdateSheet({ item, onClose, onSaved }: { item: OwnerProperty; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<string | null>(item.ownerReport?.status ?? 'AVAILABLE');
  const [availableFrom, setDate] = useState<string | null>(item.ownerReport?.availableFrom ?? null);
  const [note, setNote] = useState(item.ownerReport?.note ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mutationId = useRef<string | null>(null);
  async function save() {
    if (busy) return;
    mutationId.current ??= Crypto.randomUUID();
    const parsed = ownerReportInputSchema.safeParse({ clientMutationId: mutationId.current, status, availableFrom: availableFrom || undefined, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/owner/properties/' + encodeURIComponent(item.id) + '/update', { method: 'POST', body: parsed.data, ownerContext: captureAccountContext() });
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      title="Update availability"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={{ gap: 10 }}>
        <ChoiceField
          label="Availability"
          choices={['AVAILABLE', 'UPCOMING', 'RENTED', 'UNAVAILABLE']}
          labels={{ UPCOMING: 'Available from a future date' }}
          value={status}
          access={!busy}
          onChange={(value) => {
            mutationId.current = null;
            setStatus(value);
          }}
        />
        {
          <PropertyDateField
            label="Available from"
            value={availableFrom}
            onChange={(value) => {
              mutationId.current = null;
              setDate(value);
            }}
          />
        }
        <Input
          label="Note for your broker"
          maxLength={500}
          multiline
          value={note}
          editable={!busy}
          onChangeText={(value) => {
            mutationId.current = null;
            setNote(value);
          }}
        />
        {!!error && (
          <Txt color="danger" accessibilityRole="alert">
            {error}
          </Txt>
        )}
        <Button title="Send update to broker" loading={busy} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}
