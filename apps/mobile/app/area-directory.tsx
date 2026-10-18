import { useState } from 'react';
import { ActivityIndicator, FlatList, View, Linking } from 'react-native';
import WebView from 'react-native-webview';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Building2, ChevronRight, MapPin, Search, SlidersHorizontal } from 'lucide-react-native';
import { directoryMapHtml } from '@brokeriq/shared';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { DirectoryDetails } from '@/launch/directory-details';
import { WorkspaceTag } from '@/launch/workspace';
import { ChoiceField } from '@/launch/form';
import { api, qs, API_URL } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Input, Button, Txt, ErrorView, Sheet, Segmented, IconBtn, Row } from '@/ui';
export default function AreaDirectory() {
  const { c } = useTheme();
  const [search, setSearch] = useState('');
  const term = useDebounced(search);
  const [category, setCategory] = useState('');
  const [sector, setSector] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState('LIST');
  const [selected, setSelected] = useState<string | null>(null);
  const filters = { search: term, sector, category };
  const list = useInfiniteQuery({
    queryKey: ['area-directory', filters],
    queryFn: ({ pageParam }) => api<any>(`/area-directory${qs({ ...filters, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: (p) => (p.page < p.totalPages ? p.page + 1 : undefined),
  });
  const map = useQuery({ queryKey: ['area-directory-map', filters], queryFn: () => api<any>(`/area-directory/map${qs(filters)}`), enabled: view === 'MAP' });
  const detail = useQuery({ queryKey: ['directory-detail', selected], queryFn: () => api<any>(`/area-directory/${selected}`), enabled: !!selected });
  const coverage = list.data?.pages[0]?.coverage;
  const web = API_URL.replace('brokeriqapi.', 'brokeriq.').replace(/\/api$/, '');
  return (
    <BrokerScreen title="Area Directory" subtitle="Gurugram city · Explore local projects" back>
      <View style={{ paddingHorizontal: 20, gap: 12, paddingBottom: 14 }}>
        <Row gap={10}>
          <Input
            placeholder="Society, project or builder"
            accessibilityLabel="Search Area Directory"
            value={search}
            onChangeText={setSearch}
            icon={<Search size={18} color={c.muted} />}
            containerStyle={{ flex: 1 }}
          />
          <IconBtn
            accessibilityLabel="Directory filters"
            onPress={() => setFilterOpen(true)}
            style={{ backgroundColor: category || sector ? c.brandSoft : c.surface, borderWidth: 1, borderColor: c.line, width: 50, height: 50 }}
          >
            <SlidersHorizontal size={19} color={c.brand} />
          </IconBtn>
        </Row>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'LIST', label: 'Project list' },
            { value: 'MAP', label: 'Explore map' },
          ]}
        />
        <Row gap={8} wrap>
          <WorkspaceTag label={coverage ? `${Number(coverage.sourceRecords).toLocaleString('en-IN')} source records` : 'Loading source records…'} />
          {coverage && <WorkspaceTag tone="muted" label={`${Number(coverage.mappedRecords).toLocaleString('en-IN')} mapped`} />}
          {!!sector && <WorkspaceTag tone="muted" label={sector} />}
          {!!category && <WorkspaceTag tone="muted" label={category.replace(/_/g, ' ')} />}
        </Row>
        <Txt v="caption" color="muted">
          Public source records. Confirm availability with your broker.
        </Txt>
      </View>
      {view === 'MAP' ? (
        <View
          style={{ flex: 1, minHeight: 240, marginHorizontal: 20, marginBottom: 16, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: c.line }}
        >
          {map.error ? (
            <ErrorView error={map.error} onRetry={() => map.refetch()} />
          ) : map.data ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: directoryMapHtml(map.data.items, web), baseUrl: web }}
              userAgent="BrokerIQ/2.1 (Android; https://brokeriq.mymultimeds.com)"
              javaScriptEnabled
              startInLoadingState
              renderLoading={() => <ActivityIndicator color={c.brand} style={{ position: 'absolute', inset: 0 }} />}
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
            <ActivityIndicator color={c.brand} style={{ padding: 40 }} />
          )}
        </View>
      ) : (
        <FlatList
          data={list.data?.pages.flatMap((p) => p.items) ?? []}
          keyExtractor={(r) => r.id}
          refreshing={list.isRefetching}
          onRefresh={() => list.refetch()}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 32 }}
          ListEmptyComponent={
            list.error ? (
              <ErrorView error={list.error} onRetry={() => list.refetch()} />
            ) : list.isPending ? (
              <ActivityIndicator color={c.brand} style={{ padding: 40 }} />
            ) : (
              <NativeCard>
                <Txt color="muted">No source records match these filters</Txt>
                <Button
                  title="Reset filters"
                  variant="secondary"
                  onPress={() => {
                    setSearch('');
                    setSector('');
                    setCategory('');
                  }}
                />
              </NativeCard>
            )
          }
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={c.brand} style={{ padding: 16 }} /> : null}
          renderItem={({ item }) => (
            <NativeCard onPress={() => setSelected(item.id)}>
              <Row style={{ alignItems: 'flex-start' }} gap={12}>
                <View style={{ padding: 11, borderRadius: 14, backgroundColor: c.brandSoft }}>
                  <Building2 size={20} color={c.brand} />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Txt v="title" numberOfLines={2}>
                    {String(item.name).trim()}
                  </Txt>
                  {!!item.builderName && (
                    <Txt v="caption" color="muted" numberOfLines={1}>
                      {String(item.builderName).trim()}
                    </Txt>
                  )}
                </View>
                <ChevronRight size={17} color={c.subtle} style={{ marginTop: 10 }} />
              </Row>
              <Row gap={6} style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line }}>
                <MapPin size={14} color={c.brand} />
                <Txt v="caption" style={{ flex: 1 }}>
                  {item.sector
                    ? /^\d/.test(String(item.sector).trim())
                      ? `Sector ${String(item.sector).trim()}`
                      : String(item.sector).trim()
                    : item.address || 'Address not in source'}
                </Txt>
                <WorkspaceTag tone={item.latitude == null ? 'muted' : 'success'} label={item.latitude == null ? 'List only' : 'On map'} />
              </Row>
            </NativeCard>
          )}
        />
      )}
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Directory filters">
        <View style={{ gap: 16 }}>
          <Input label="Sector / locality" value={sector} onChangeText={setSector} />
          <ChoiceField
            emptyLabel="Any"
            label="Property category"
            value={category || null}
            choices={['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'UNCLASSIFIED']}
            onChange={(v) => setCategory(v ?? '')}
          />
          <Button title="Show results" onPress={() => setFilterOpen(false)} />
          <Button
            title="Reset filters"
            variant="ghost"
            onPress={() => {
              setSector('');
              setCategory('');
            }}
          />
        </View>
      </Sheet>
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Directory source">
        {detail.error ? (
          <ErrorView error={detail.error} onRetry={() => detail.refetch()} />
        ) : detail.data ? (
          <DirectoryDetails key={detail.data.id} record={detail.data} />
        ) : (
          <ActivityIndicator color={c.brand} style={{ padding: 30 }} />
        )}
      </Sheet>
    </BrokerScreen>
  );
}
