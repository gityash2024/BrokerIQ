import { useState } from 'react';
import { FlatList, View, ActivityIndicator, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { formatINR, readableValue } from '@brokeriq/shared';
import { api, qs, errorMessage } from '@/lib/api';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { WorkspaceHero, WorkspaceTag } from '@/launch/workspace';
import { useDebounced } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { PropertyCard } from '@/launch/property-card';
import { Button, Txt, ErrorView, Sheet, Input } from '@/ui';
export default function Requirements() {
  const { leadId } = useLocalSearchParams<{ leadId?: string }>();
  const [search, setSearch] = useState('');
  const term = useDebounced(search);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useInfiniteQuery({
    queryKey: ['broker-requirements', leadId, term],
    queryFn: ({ pageParam }) => api<any>(`/broker-requirements${qs({ page: pageParam, leadId, search: term })}`),
    initialPageParam: 1,
    getNextPageParam: (p) => (p.page < p.totalPages ? p.page + 1 : undefined),
  });
  const matches = useQuery({
    queryKey: ['requirement-matches', selected],
    queryFn: () => api<any>(`/broker-requirements/${selected}/matches`),
    enabled: !!selected,
  });
  return (
    <BrokerScreen title="Requirements" subtitle="Separate needs, clear matching reasons." back>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
        <Input accessibilityLabel="Search requirements" placeholder="Contact, phone or requirement notes" value={search} onChangeText={setSearch} />
        <Button title="Scan / paste / WhatsApp export" variant="secondary" onPress={() => router.push('/capture?target=REQUIREMENT' as any)} />
        <Button title="Add requirement" onPress={() => router.push({ pathname: '/requirement-edit', params: leadId ? { leadId } : {} } as any)} />
      </View>
      <FlatList
        data={list.data?.pages.flatMap((p) => p.items) ?? []}
        keyExtractor={(r) => r.id}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={
          list.error ? (
            <ErrorView error={list.error} onRetry={() => list.refetch()} />
          ) : list.isPending ? (
            <ActivityIndicator style={{ padding: 40 }} />
          ) : (
            <NativeCard>
              <Txt v="title">No requirements match</Txt>
              <Txt v="small" color="muted">
                Add a client need or import a message for review.
              </Txt>
            </NativeCard>
          )
        }
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ padding: 20 }} /> : null}
        renderItem={({ item }) => (
          <NativeCard>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Txt v="h3" style={{ flex: 1 }}>
                {item.contactName || item.contactPhone || 'Contact not recorded'}
              </Txt>
              <WorkspaceTag tone={item.status === 'OPEN' ? 'success' : 'muted'} label={readableValue(item.status)} />
            </View>
            <Txt>{item.localityNames.join(' · ')}</Txt>
            <Txt v="small" color="muted">
              {item.purpose || 'Purpose unknown'} · {item.bedrooms.length ? `${item.bedrooms.join('/')} ${item.roomKind || 'rooms'}` : 'Rooms unknown'}
            </Txt>
            <Txt>
              {item.minBudget != null ? formatINR(item.minBudget) : '—'} – {item.maxBudget != null ? formatINR(item.maxBudget) : '—'}
            </Txt>
            {!!item.propertyTypes?.length && (
              <Txt v="caption" color="muted">
                {item.propertyTypes.map(readableValue).join(' · ')}
              </Txt>
            )}
            {!!item.furnishing && (
              <Txt v="caption" color="muted">
                {readableValue(item.furnishing)}
              </Txt>
            )}
            {(item.minArea != null || item.maxArea != null) && (
              <Txt v="caption" color="muted">{`${item.minArea ?? 'Any'} – ${item.maxArea ?? 'Any'} ${item.areaUnit ? readableValue(item.areaUnit) : ''}`}</Txt>
            )}
            {!!item.notes && (
              <Txt v="small" color="muted">
                {item.notes}
              </Txt>
            )}
            {!!item.contactPhone && (
              <Button
                title={`Call ${item.contactPhone}`}
                variant="ghost"
                size="sm"
                onPress={() => Linking.openURL(`tel:${item.contactPhone}`).catch((error) => toast.error(errorMessage(error)))}
              />
            )}
            <Button title="Find matches" variant="secondary" size="sm" onPress={() => setSelected(item.id)} />
          </NativeCard>
        )}
      />
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Inventory matches">
        {matches.error ? (
          <ErrorView error={matches.error} onRetry={() => matches.refetch()} />
        ) : matches.isPending ? (
          <ActivityIndicator style={{ padding: 40 }} />
        ) : (
          <View style={{ gap: 12 }}>
            {['available', 'unknown'].map((group) => (
              <View key={group} style={{ gap: 12 }}>
                <Txt v="h3">{group === 'available' ? 'Confirmed available' : 'Availability needs confirmation'}</Txt>
                {(matches.data?.[group] ?? []).map((result: any) => (
                  <View key={result.item.id} style={{ gap: 6 }}>
                    <PropertyCard item={result.item} />
                    <Txt v="caption" color="muted">
                      {result.reasons.join(' · ')}
                    </Txt>
                  </View>
                ))}
                {matches.data && !matches.data[group]?.length && <Txt color="muted">No matching properties</Txt>}
              </View>
            ))}
          </View>
        )}
      </Sheet>
    </BrokerScreen>
  );
}
