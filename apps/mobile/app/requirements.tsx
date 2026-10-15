import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { formatINR } from '@brokeriq/shared';
import { api, qs } from '@/lib/api';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { PropertyCard } from '@/launch/property-card';
import { Button, Txt, ErrorView, Sheet } from '@/ui';
export default function Requirements() {
  const { leadId } = useLocalSearchParams<{ leadId?: string }>();
  const [selected, setSelected] = useState<string | null>(null);
  const list = useInfiniteQuery({
    queryKey: ['broker-requirements', leadId],
    queryFn: ({ pageParam }) => api<any>(`/broker-requirements${qs({ page: pageParam, leadId })}`),
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
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Button title="Add requirement" onPress={() => router.push({ pathname: '/requirement-edit', params: leadId ? { leadId } : {} } as any)} />
      </View>
      <FlatList
        data={list.data?.pages.flatMap((p) => p.items) ?? []}
        keyExtractor={(r) => r.id}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={list.error ? <ErrorView error={list.error} /> : <Txt color="muted">No requirements yet</Txt>}
        renderItem={({ item }) => (
          <NativeCard>
            <Txt v="h3">{item.contactName || item.contactPhone || 'Contact not recorded'}</Txt>
            <Txt>{item.localityNames.join(' · ')}</Txt>
            <Txt v="small" color="muted">
              {item.purpose || 'Purpose unknown'} · {item.bedrooms.length ? `${item.bedrooms.join('/')} ${item.roomKind || 'rooms'}` : 'Rooms unknown'}
            </Txt>
            <Txt>
              {item.minBudget != null ? formatINR(item.minBudget) : '—'} – {item.maxBudget != null ? formatINR(item.maxBudget) : '—'}
            </Txt>
            <Button title="Find matches" variant="secondary" size="sm" onPress={() => setSelected(item.id)} />
          </NativeCard>
        )}
      />
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Inventory matches">
        {matches.error ? (
          <ErrorView error={matches.error} />
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
