import { useState, useEffect } from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, SlidersHorizontal, Search, X } from 'lucide-react-native';
import { INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES, INVENTORY_FILTER_LABELS, type PagedLedger } from '@brokeriq/shared';
import { api, qs, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Txt, Input, Button, Sheet, Chip } from '@/ui';
import { BrokerScreen } from '@/launch/screen';
import { ChoiceField } from '@/launch/form';
import { NativeAdvancedFilters } from '@/launch/advanced-filters';
import { PropertyCard } from '@/launch/property-card';
const initial = {
  detailFilters: '',
  sort: '',
  amenities: '',
  verificationStatus: '',
  hasPhotos: '',
  hasVideos: '',
  floor: '',
  sector: '',
  purpose: '',
  propertyType: '',
  category: '',
  bhk: '',
  roomKinds: '',
  minRate: '',
  maxRate: '',
  furnishing: '',
  availability: '',
  sourceType: '',
  minBudget: '',
  maxBudget: '',
  minArea: '',
  maxArea: '',
  areaUnit: '',
};
export default function Inventory() {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.role === 'BROKER_AGENT') {
      router.replace('/(broker)/leads');
    }
  }, [user]);

  if (user?.role === 'BROKER_AGENT') return null;

  const { c } = useTheme();
  const [search, setSearch] = useState('');
  const term = useDebounced(search);
  const [filters, setFilters] = useState(initial);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const qc = useQueryClient();
  useEffect(() => {
    setSelected([]);
    setSelecting(false);
  }, [term, filters]);
  const query = useInfiniteQuery({
    queryKey: ['ledger', term, filters],
    queryFn: ({ pageParam }) => api<PagedLedger>(`/inventory${qs({ ...filters, search: term, page: pageParam, pageSize: 30 })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const stats = useQuery({ queryKey: ['ledger-stats'], queryFn: () => api<any>('/inventory/stats') });
  const sectors = useQuery({ queryKey: ['ledger-sectors'], queryFn: () => api<{ sector: string; count: number }[]>('/inventory/sectors') });
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];
  const count = Object.values(filters).filter(Boolean).length;
  async function bulk(data: Record<string, string>) {
    try {
      await api('/inventory/bulk/update', { method: 'PATCH', body: { ids: selected, data } });
      setSelected([]);
      setSelecting(false);
      await qc.invalidateQueries({ queryKey: ['ledger'] });
      await qc.invalidateQueries({ queryKey: ['ledger-stats'] });
      toast.success('Properties updated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  const choices: Record<string, string[]> = {
    sector: sectors.data?.map((s) => s.sector) ?? [],
    purpose: ['RENT', 'SALE'],
    category: ['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND'],
    propertyType: PROPERTY_TYPES,
    bhk: ['1', '2', '3', '4', '5', '6'],
    roomKinds: ['BHK', 'RK', 'STUDIO'],
    furnishing: ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'],
    availability: ['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE'],
    sourceType: ['MANUAL', 'PDF_REGISTER', 'WHATSAPP', 'CHAT_EXPORT', 'IMAGE', 'TEXT', 'PORTAL'],
    areaUnit: ['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE'],
  };
  return (
    <BrokerScreen
      title="Inventory"
      subtitle={stats.data ? `${stats.data.total} records · ${stats.data.available} available` : 'Property ledger'}
      action={
        <Pressable
          accessibilityLabel="Add property"
          onPress={() => router.push('/inventory-edit')}
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus color="white" size={23} />
        </Pressable>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Scan / import" size="sm" style={{ flex: 1 }} onPress={() => router.push('/scanner?target=INVENTORY' as any)} />
          <Button
            title="Paste / chat export"
            size="sm"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push('/capture?target=INVENTORY' as any)}
          />
        </View>
        <Button title="Area Directory · Map / List" size="sm" variant="secondary" onPress={() => router.push('/area-directory' as any)} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Input
            accessibilityLabel="Search inventory"
            placeholder="House, locality, contact…"
            value={search}
            onChangeText={setSearch}
            icon={<Search size={18} color={c.muted} />}
            containerStyle={{ flex: 1 }}
          />
          <Pressable
            accessibilityLabel="Filter inventory"
            onPress={() => setFilterOpen(true)}
            style={{
              width: 50,
              height: 50,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: count ? c.brandSoft : c.surface,
            }}
          >
            <SlidersHorizontal size={20} color={c.brand} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="caption" color="muted">
            {count ? `${count} filters applied` : 'All properties'}
          </Txt>
          <Pressable
            onPress={() => {
              setSelecting(!selecting);
              setSelected([]);
            }}
          >
            <Txt v="caption" color="brand">
              {selecting ? 'Cancel selection' : 'Select'}
            </Txt>
          </Pressable>
        </View>
        {count > 0 && <Button title="Reset filters" size="sm" variant="ghost" onPress={() => setFilters(initial)} />}
      </View>
      {query.error && (
        <View style={{ padding: 20, gap: 12 }}>
          <Txt color="danger">{errorMessage(query.error)}</Txt>
          <Button title="Retry" variant="secondary" onPress={() => query.refetch()} />
        </View>
      )}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <PropertyCard
            item={item}
            selected={selecting ? selected.includes(item.id) : undefined}
            onSelect={() => {
              if (!selecting) setSelecting(true);
              setSelected(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id]);
            }}
          />
        )}
        refreshing={query.isRefetching}
        onRefresh={() => {
          query.refetch();
          stats.refetch();
        }}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={c.brand} style={{ padding: 40 }} />
          ) : (
            <View style={{ paddingVertical: 40, gap: 10 }}>
              <Txt v="h3" style={{ textAlign: 'center' }}>
                No properties match
              </Txt>
              <Txt color="muted" style={{ textAlign: 'center' }}>
                Change filters, capture a source or add a property.
              </Txt>
              <Button title="Capture source" variant="secondary" onPress={() => router.push('/capture')} />
            </View>
          )
        }
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={c.brand} style={{ padding: 20 }} /> : null}
      />
      {selected.length > 0 && (
        <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface }}>
          <Txt v="caption">{`${selected.length} selected`}</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Available" size="sm" style={{ flex: 1 }} onPress={() => bulk({ availability: 'AVAILABLE' })} />
            <Button title="Draft" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => bulk({ status: 'DRAFT' })} />
            <Button title="Inactive" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => bulk({ status: 'INACTIVE' })} />
          </View>
        </View>
      )}
      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter inventory"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Reset filters" variant="secondary" style={{ flex: 1 }} onPress={() => setFilters(initial)} />
            <Button title="Show properties" style={{ flex: 1 }} onPress={() => setFilterOpen(false)} />
          </View>
        }
      >
        {Object.entries(choices).map(([name, options]) => (
          <View key={name} style={{ marginBottom: 14 }}>
            <ChoiceField
              emptyLabel="Any"
              label={INVENTORY_FILTER_LABELS[name] ?? name}
              value={(filters as any)[name] || null}
              choices={[...options]}
              onChange={(value) => setFilters({ ...filters, [name]: value ?? '' })}
            />
          </View>
        ))}
        {['minBudget', 'maxBudget', 'minArea', 'maxArea'].map((name) => (
          <Input
            key={name}
            label={INVENTORY_FILTER_LABELS[name] ?? name}
            keyboardType="decimal-pad"
            value={(filters as any)[name]}
            onChangeText={(value) => setFilters({ ...filters, [name]: value })}
            containerStyle={{ marginBottom: 12 }}
          />
        ))}
        <NativeAdvancedFilters filters={filters} onChange={setFilters} />
      </Sheet>
    </BrokerScreen>
  );
}
