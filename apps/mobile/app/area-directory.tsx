import { useState } from 'react';
import { FlatList, View, Linking, ScrollView } from 'react-native';
import WebView from 'react-native-webview';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { directoryMapHtml } from '@brokeriq/shared';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { ChoiceField } from '@/launch/form';
import { api, qs, API_URL } from '@/lib/api';
import { Input, Button, Txt, ErrorView, Sheet } from '@/ui';
export default function AreaDirectory() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sector, setSector] = useState('');
  const [view, setView] = useState('LIST');
  const [selected, setSelected] = useState<string | null>(null);
  const filters = { search, sector, category };
  const list = useInfiniteQuery({
    queryKey: ['area-directory', filters],
    queryFn: ({ pageParam }) => api<any>(`/area-directory${qs({ ...filters, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: (p) => (p.page < p.totalPages ? p.page + 1 : undefined),
  });
  const map = useQuery({ queryKey: ['area-directory-map', filters], queryFn: () => api<any>(`/area-directory/map${qs(filters)}`), enabled: view === 'MAP' });
  const detail = useQuery({ queryKey: ['directory-detail', selected], queryFn: () => api<any>(`/area-directory/${selected}`), enabled: !!selected });
  const web = API_URL.replace('brokeriqapi.', 'brokeriq.').replace(/\/api$/, '');
  return (
    <BrokerScreen title="Area Directory" subtitle="Gurugram city · Public source records" back>
      <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 12 }}>
        <Input placeholder="Society, project or builder" value={search} onChangeText={setSearch} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input placeholder="Sector" value={sector} onChangeText={setSector} containerStyle={{ flex: 1 }} />
          <Button title={view === 'LIST' ? 'Show map' : 'Show list'} variant="secondary" onPress={() => setView(view === 'LIST' ? 'MAP' : 'LIST')} />
        </View>
        <ChoiceField
          label="Property category"
          value={category || null}
          choices={['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'UNCLASSIFIED']}
          onChange={(v) => setCategory(v ?? '')}
        />
        <Txt v="caption" color="muted">
          {list.data?.pages[0].coverage.sourceRecords ?? 0} source records · {list.data?.pages[0].coverage.mappedRecords ?? 0} mapped. Registration does not
          confirm availability.
        </Txt>
      </View>
      {view === 'MAP' ? (
        map.error ? (
          <ErrorView error={map.error} />
        ) : map.data ? (
          <WebView
            originWhitelist={['*']}
            source={{ html: directoryMapHtml(map.data.items, web), baseUrl: web }}
            userAgent="BrokerIQ/2.0 (Android; https://brokeriq.mymultimeds.com)"
            javaScriptEnabled
            onMessage={(event) => {
              try {
                const value = JSON.parse(event.nativeEvent.data);
                if (value.type === 'directory-select' && typeof value.id === 'string') setSelected(value.id);
              } catch {}
            }}
            onShouldStartLoadWithRequest={(request) =>
              request.url === 'about:blank' || request.url.startsWith(web) || request.url.startsWith('https://tile.openstreetmap.org/')
            }
          />
        ) : (
          <Txt>Loading map…</Txt>
        )
      ) : (
        <FlatList
          data={list.data?.pages.flatMap((p) => p.items) ?? []}
          keyExtractor={(r) => r.id}
          refreshing={list.isRefetching}
          onRefresh={() => list.refetch()}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={list.error ? <ErrorView error={list.error} /> : <Txt color="muted">No source records match these filters</Txt>}
          renderItem={({ item }) => (
            <NativeCard onPress={() => setSelected(item.id)}>
              <Txt v="h3">{item.name}</Txt>
              <Txt v="small" color="muted">
                {item.builderName}
              </Txt>
              <Txt v="caption">{item.sector || item.address || 'Address not in source'}</Txt>
              <Txt v="caption" color="muted">
                {item.provider} · {item.registrationStatus}
              </Txt>
              <Txt v="caption" color="muted">
                {item.latitude == null ? 'Coordinates unavailable' : 'Source location available'}
              </Txt>
            </NativeCard>
          )}
        />
      )}
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Directory source">
        {detail.error ? (
          <ErrorView error={detail.error} />
        ) : (
          detail.data && (
            <View style={{ gap: 14 }}>
              <Txt v="h3">{detail.data.name}</Txt>
              <Txt>{detail.data.builderName}</Txt>
              <Txt>{detail.data.address || detail.data.sector}</Txt>
              <Txt>{detail.data.registrationNumber}</Txt>
              <Txt v="small">
                {detail.data.registrationStatus} · {detail.data.registrationUntil || 'Not recorded'}
              </Txt>
              <Txt v="caption" color="muted">
                {detail.data.metadata?.classificationNote || detail.data.metadata?.mapPointMeaning}
              </Txt>
              <Button title="Open official source" variant="secondary" onPress={() => Linking.openURL(detail.data.sourceUrl)} />
              <Txt v="caption" color="muted">
                Retrieved {new Date(detail.data.sourceFetchedAt).toLocaleString()} · {detail.data.provider}
              </Txt>
              <Txt v="caption" color="muted">
                Different registrations and phases stay separate. Records without coordinates remain available in List.
              </Txt>
            </View>
          )
        )}
      </Sheet>
    </BrokerScreen>
  );
}
