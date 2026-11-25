import { JumpFlatList } from '@/components/list-jump';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { GURUGRAM_SECTOR_MAPS_URL, googleDirections, gurugramSectorMaps, type MappedVisit } from '@brokeriq/shared';
import { VisitItinerary } from '@/components/visit-properties';
import { LoadingArtwork } from '@/components/request-loader';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button, ErrorView, Input, Txt } from '@/ui';

function openMap(url: string) {
  return Linking.openURL(url).catch(() => toast.error('Unable to open the maps link'));
}

export default function PropertyMaps() {
  const [from] = useState(() => new Date().toISOString());
  const [showMaps, setShowMaps] = useState(false);
  const [sectorSearch, setSectorSearch] = useState('');
  const maps = showMaps ? gurugramSectorMaps(sectorSearch).slice(0, 12) : [];
  const query = useInfiniteQuery({
    queryKey: ['visits', 'property-maps', from],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<{ items: MappedVisit[]; pages: number }>(
        `/visits?from=${encodeURIComponent(from)}&directions=true&upcoming=true&paginated=true&pageSize=30&page=${pageParam}`,
      ),
    getNextPageParam: (last, pages) => (pages.length < last.pages ? pages.length + 1 : undefined),
  });
  const visits = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <BrokerScreen title="Property Maps" subtitle="Directions for upcoming site visits" back>
      <JumpFlatList
        data={visits}
        keyExtractor={(visit) => visit.id}
        refreshing={query.isRefetching}
        onRefresh={() => query.refetch()}
        contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 8 }}>
            <Button title={showMaps ? 'Hide sector maps' : 'Find a sector map'} variant="secondary" onPress={() => setShowMaps(!showMaps)} />
            {showMaps && (
              <>
                <Input label="Sector or locality" value={sectorSearch} onChangeText={setSectorSearch} />
                {maps.map((map) => (
                  <Button key={map.url} title={map.name} size="sm" variant="ghost" onPress={() => openMap(map.url)} />
                ))}
                {!maps.length && <Txt color="muted">No sector maps match.</Txt>}
                <Button title="ABC Buildcon · All sector maps" size="sm" variant="secondary" onPress={() => openMap(GURUGRAM_SECTOR_MAPS_URL)} />
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <LoadingArtwork h={120} />
          ) : query.isError ? (
            <ErrorView error={query.error} onRetry={() => query.refetch()} />
          ) : (
            <Txt color="muted">No upcoming visits.</Txt>
          )
        }
        ListFooterComponent={
          query.hasNextPage ? <Button title="Load more visits" loading={query.isFetchingNextPage} onPress={() => query.fetchNextPage()} /> : null
        }
        renderItem={({ item }) => (
          <NativeCard style={{ gap: 8 }}>
            <Txt v="title">{item.lead.name}</Txt>
            <Txt color="muted">
              {new Date(item.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {item.status.replace(/_/g, ' ')}
            </Txt>
            {item.address && <Button title="Search meeting point" variant="secondary" size="sm" onPress={() => openMap(googleDirections(item.address!))} />}
            <VisitItinerary snapshot={item.propertySnapshot} />
          </NativeCard>
        )}
      />
    </BrokerScreen>
  );
}
