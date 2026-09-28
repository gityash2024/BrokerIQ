import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BellPlus, List, Map as MapIcon, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { FURNISHING_LABELS, PROPERTY_TYPE_LABELS, formatPriceShort, type PropertyType, plural } from '@brokeriq/shared';
import { api, post, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError, useDebounced } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { ListingCard, type ListingCardData } from '@/components/listing';
import { MapView, toPoints } from '@/components/map';
import { Button, Chip, ErrorView, Empty, IconBtn, Input, PressableScale, Row, Sheet, Skeleton, Txt } from '@/ui';

type F = { q?: string; purpose?: string; category?: string; types?: string; bedrooms?: string; minPrice?: string; maxPrice?: string; furnishing?: string; postedBy?: string; verified?: string; sort?: string; localities?: string };
const SORTS = [
  ['relevance', 'Relevant'],
  ['newest', 'Newest'],
  ['price_asc', 'Price ↑'],
  ['price_desc', 'Price ↓'],
  ['psf_asc', '₹/sqft ↑'],
] as const;

export default function SearchScreen() {
  const { c } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<F>();
  const [f, setF] = useState<F>({ purpose: params.purpose ?? 'SALE', category: params.category, localities: params.localities, sort: 'relevance' });
  const [text, setText] = useState('');
  const q = useDebounced(text);
  const [filters, setFilters] = useState(false);
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const tax = useQuery({ queryKey: ['taxonomies'], queryFn: () => api<any>('/public/taxonomies', { auth: false }), staleTime: 600_000 });
  const suggest = useQuery({ queryKey: ['suggest', q], queryFn: () => api<any>(`/public/suggest${qs({ q })}`, { auth: false }), enabled: q.length > 1 });
  const query = useMemo(() => ({ ...f, q: f.localities ? undefined : q || undefined }), [f, q]);
  const list = useInfiniteQuery({
    queryKey: ['search', query],
    queryFn: ({ pageParam }) => api<any>(`/listings${qs({ ...query, page: pageParam, pageSize: 12 })}`, { auth: false }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const map = useQuery({ queryKey: ['search-map', query], queryFn: () => api<any[]>(`/listings/map${qs(query)}`, { auth: false }), enabled: mode === 'map' });
  const items: ListingCardData[] = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total;
  const set = (p: Partial<F>) => setF((x) => ({ ...x, ...p }));
  const toggleCsv = (k: keyof F, v: string) => {
    const cur = (f[k] ?? '').split(',').filter(Boolean);
    set({ [k]: cur.includes(v) ? cur.filter((x) => x !== v).join(',') : [...cur, v].join(',') } as any);
  };
  const budgets: number[] = tax.data?.budgets?.[f.purpose === 'RENT' ? 'RENT' : 'SALE'] ?? [];
  const activeCount = ['types', 'bedrooms', 'minPrice', 'maxPrice', 'furnishing', 'postedBy', 'verified'].filter((k) => (f as any)[k]).length;
  const saveSearch = async () => {
    if (!user) return router.push('/login');
    try {
      await post('/me/saved-searches', { name: [f.bedrooms && `${f.bedrooms} BHK`, f.purpose === 'RENT' ? 'Rent' : 'Buy', f.localities ?? q].filter(Boolean).join(' · ') || 'My search', filters: query, alertsEnabled: true });
      toast.success('Search saved — नई matching listings पर alert मिलेगा 🔔');
    } catch (e) {
      showError(e);
    }
  };

  const header = (
    <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
      <Row>
        <View style={{ flex: 1 }}>
          <Input
            value={text}
            onChangeText={(v) => (setText(v), f.localities && set({ localities: undefined }))}
            placeholder="Sector, society, project…"
            icon={<Search size={18} color={c.subtle} />}
            returnKeyType="search"
          />
        </View>
        <IconBtn onPress={() => setFilters(true)} badge={activeCount} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, height: 50, width: 50 }}>
          <SlidersHorizontal size={20} color={c.fg} />
        </IconBtn>
      </Row>
      {!!f.localities && (
        <Row>
          <Chip label={`📍 ${f.localities.replace(/-gurgaon$/, '').replace(/-/g, ' ')}`} active onPress={() => set({ localities: undefined })} icon={<X size={14} color={c.brand} />} />
        </Row>
      )}
      {q.length > 1 && !f.localities && (suggest.data?.localities?.length || suggest.data?.projects?.length) ? (
        <Animated.View entering={FadeIn} style={{ backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 6 }}>
          {suggest.data.localities.slice(0, 5).map((l: any) => (
            <PressableScale key={l.id} onPress={() => (set({ localities: l.slug }), setText(''))} style={{ padding: 10 }}>
              <Txt v="bodyStrong">📍 {l.name}</Txt>
              {!!l.zone && <Txt v="caption" color="muted">{l.zone}</Txt>}
            </PressableScale>
          ))}
          {suggest.data.projects.slice(0, 3).map((p: any) => (
            <PressableScale key={p.id} onPress={() => router.push(`/project/${p.slug}`)} style={{ padding: 10 }}>
              <Txt v="bodyStrong">🏢 {p.name}</Txt>
              <Txt v="caption" color="muted">{p.builder?.name} · {p.locality?.name}</Txt>
            </PressableScale>
          ))}
        </Animated.View>
      ) : null}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[
          { k: 'SALE', l: 'Buy' },
          { k: 'RENT', l: 'Rent' },
        ]}
        keyExtractor={(x) => x.k}
        contentContainerStyle={{ gap: 8 }}
        ListFooterComponent={
          <Row gap={8} style={{ marginLeft: 8 }}>
            {(['RESIDENTIAL', 'COMMERCIAL', 'PLOT'] as const).map((cat) => (
              <Chip key={cat} label={cat[0] + cat.slice(1).toLowerCase()} active={f.category === cat} onPress={() => set({ category: f.category === cat ? undefined : cat, types: undefined })} />
            ))}
          </Row>
        }
        renderItem={({ item }) => <Chip label={item.l} active={f.purpose === item.k} onPress={() => set({ purpose: item.k, minPrice: undefined, maxPrice: undefined })} />}
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="small" color="muted">{total != null ? plural(total, 'property', 'properties') : ' '}</Txt>
        <Row gap={6}>
          <Chip label="Alert" onPress={saveSearch} icon={<BellPlus size={14} color={c.muted} />} />
          <Chip label={mode === 'list' ? 'Map' : 'List'} onPress={() => setMode(mode === 'list' ? 'map' : 'list')} icon={mode === 'list' ? <MapIcon size={14} color={c.muted} /> : <List size={14} color={c.muted} />} />
        </Row>
      </Row>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Txt v="h1" style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>Explore</Txt>
      {mode === 'map' ? (
        <View style={{ flex: 1 }}>
          {header}
          <MapView height="100%" points={toPoints(map.data ?? [])} onPick={(id) => {
            const l = map.data?.find((x) => x.id === id);
            if (l) router.push(`/property/${l.slug}`);
          }} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 120, gap: 14 }}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay((index % 12) * 40)} style={{ paddingHorizontal: 16 }}>
              <ListingCard l={item} />
            </Animated.View>
          )}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={0.5}
          refreshing={list.isRefetching}
          onRefresh={() => list.refetch()}
          ListEmptyComponent={
            list.isLoading ? (
              <View style={{ paddingHorizontal: 16, gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} h={300} r={22} />)}</View>
            ) : list.isError ? (
              <ErrorView error={list.error} onRetry={() => list.refetch()} />
            ) : (
              <Empty title="कोई property नहीं मिली" text="Filters कम करें या दूसरी locality try करें। Alert लगा दें — नई listing आते ही बताएँगे।" />
            )
          }
          ListFooterComponent={list.isFetchingNextPage ? <View style={{ paddingHorizontal: 16 }}><Skeleton h={300} r={22} /></View> : null}
        />
      )}

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filters" full>
        <Txt v="label" color="subtle">Sort</Txt>
        <Row wrap>{SORTS.map(([k, l]) => <Chip key={k} label={l} active={f.sort === k} onPress={() => set({ sort: k })} />)}</Row>
        <Txt v="label" color="subtle">BHK</Txt>
        <Row wrap>{['1', '2', '3', '4', '5+'].map((b) => <Chip key={b} label={`${b} BHK`} active={(f.bedrooms ?? '').split(',').includes(b)} onPress={() => toggleCsv('bedrooms', b)} />)}</Row>
        <Txt v="label" color="subtle">Property type</Txt>
        <Row wrap>
          {(tax.data?.propertyTypes ?? []).filter((t: any) => !f.category || t.category === f.category).map((t: any) => (
            <Chip key={t.value} label={PROPERTY_TYPE_LABELS[t.value as PropertyType] ?? t.label} active={(f.types ?? '').split(',').includes(t.value)} onPress={() => toggleCsv('types', t.value)} />
          ))}
        </Row>
        <Txt v="label" color="subtle">Budget (min)</Txt>
        <Row wrap>{budgets.map((b) => <Chip key={b} label={formatPriceShort(b)} active={f.minPrice === String(b)} onPress={() => set({ minPrice: f.minPrice === String(b) ? undefined : String(b) })} />)}</Row>
        <Txt v="label" color="subtle">Budget (max)</Txt>
        <Row wrap>{budgets.map((b) => <Chip key={b} label={formatPriceShort(b)} active={f.maxPrice === String(b)} onPress={() => set({ maxPrice: f.maxPrice === String(b) ? undefined : String(b) })} />)}</Row>
        <Txt v="label" color="subtle">Furnishing</Txt>
        <Row wrap>{Object.entries(FURNISHING_LABELS).map(([k, v]) => <Chip key={k} label={v} active={(f.furnishing ?? '').split(',').includes(k)} onPress={() => toggleCsv('furnishing', k)} />)}</Row>
        <Txt v="label" color="subtle">Posted by</Txt>
        <Row wrap>
          {(['OWNER', 'BROKER', 'BUILDER'] as const).map((p) => <Chip key={p} label={p[0] + p.slice(1).toLowerCase()} active={f.postedBy === p} onPress={() => set({ postedBy: f.postedBy === p ? undefined : p })} />)}
          <Chip label="✔ Verified only" active={f.verified === 'true'} onPress={() => set({ verified: f.verified ? undefined : 'true' })} />
        </Row>
        <Row style={{ marginTop: 8 }}>
          <Button title="Reset" variant="secondary" style={{ flex: 1 }} onPress={() => setF({ purpose: f.purpose, sort: 'relevance' })} />
          <Button title={total != null ? `${total} results दिखाएँ` : 'Apply'} style={{ flex: 2 }} onPress={() => setFilters(false)} />
        </Row>
      </Sheet>
    </SafeAreaView>
  );
}
