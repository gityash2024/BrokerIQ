import { useState, useEffect } from 'react';
import { View, FlatList, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, SlidersHorizontal, Search, X, Check, Building2, Flame, User } from 'lucide-react-native';
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
  onlyMine: '',
  assignedToId: '',
};

export default function Inventory() {
  const { user } = useAuth();
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
    queryFn: ({ pageParam }) =>
      api<PagedLedger>(`/inventory${qs({ ...filters, search: term, page: pageParam, pageSize: 30 })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const stats = useQuery({ queryKey: ['ledger-stats'], queryFn: () => api<any>('/inventory/stats') });
  const sectors = useQuery({
    queryKey: ['ledger-sectors'],
    queryFn: () => api<{ sector: string; count: number }[]>('/inventory/sectors'),
  });

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
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: c.brand,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: c.brand,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          <Plus color="white" size={23} />
        </Pressable>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 12 }}>
        {/* Top Quick Actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Scan / import"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => router.push('/scanner?target=INVENTORY' as any)}
          />
          <Button
            title="Paste / chat export"
            size="sm"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push('/capture?target=INVENTORY' as any)}
          />
        </View>

        {/* CRED Luxury Metrics Cards */}
        {stats.data && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'TOTAL INVENTORY', value: stats.data.total ?? 0, tone: c.fg },
              { label: 'CONFIRMED AVAIL', value: stats.data.available ?? 0, tone: c.success },
              { label: 'NEEDS CHECK', value: stats.data.unknown ?? 0, tone: '#F59E0B' },
            ].map((stat, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: `${c.line}90`,
                  borderRadius: 14,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}
              >
                <Txt v="caption" color="muted" style={{ fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 }}>
                  {stat.label}
                </Txt>
                <Txt v="h3" style={{ fontSize: 18, fontWeight: '800', marginTop: 2, color: stat.tone }}>
                  {Number(stat.value).toLocaleString('en-IN')}
                </Txt>
              </View>
            ))}
          </View>
        )}

        {/* Search Bar & Filter Button */}
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
              borderColor: count ? c.brand : c.line,
              backgroundColor: count ? `${c.brand}18` : c.surface,
            }}
          >
            <SlidersHorizontal size={20} color={count ? c.brand : c.fg} />
          </Pressable>
        </View>

        {/* CRED-Style Horizontal Quick Filter Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          {/* All */}
          <Pressable
            onPress={() => setFilters(initial)}
            style={{
              paddingHorizontal: 13,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1,
              borderColor:
                !filters.onlyMine && !filters.availability && !filters.purpose && !filters.sector
                  ? c.brand
                  : `${c.line}90`,
              backgroundColor:
                !filters.onlyMine && !filters.availability && !filters.purpose && !filters.sector
                  ? `${c.brand}20`
                  : c.surface,
            }}
          >
            <Txt
              v="caption"
              style={{
                fontSize: 12,
                fontWeight: '700',
                color:
                  !filters.onlyMine && !filters.availability && !filters.purpose && !filters.sector
                    ? c.brand
                    : c.fg,
              }}
            >
              All
            </Txt>
          </Pressable>

          {/* My Properties */}
          <Pressable
            onPress={() =>
              setFilters({ ...filters, onlyMine: filters.onlyMine === 'true' ? '' : 'true' })
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 13,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: filters.onlyMine === 'true' ? c.brand : `${c.line}90`,
              backgroundColor: filters.onlyMine === 'true' ? `${c.brand}20` : c.surface,
            }}
          >
            <User size={13} color={filters.onlyMine === 'true' ? c.brand : c.muted} />
            <Txt
              v="caption"
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: filters.onlyMine === 'true' ? c.brand : c.fg,
              }}
            >
              My Properties
            </Txt>
          </Pressable>

          {/* Available */}
          <Pressable
            onPress={() =>
              setFilters({
                ...filters,
                availability: filters.availability === 'AVAILABLE' ? '' : 'AVAILABLE',
              })
            }
            style={{
              paddingHorizontal: 13,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: filters.availability === 'AVAILABLE' ? c.success : `${c.line}90`,
              backgroundColor: filters.availability === 'AVAILABLE' ? `${c.success}20` : c.surface,
            }}
          >
            <Txt
              v="caption"
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: filters.availability === 'AVAILABLE' ? c.success : c.fg,
              }}
            >
              🟢 Available
            </Txt>
          </Pressable>

          {/* Rent */}
          <Pressable
            onPress={() =>
              setFilters({ ...filters, purpose: filters.purpose === 'RENT' ? '' : 'RENT' })
            }
            style={{
              paddingHorizontal: 13,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: filters.purpose === 'RENT' ? c.brand : `${c.line}90`,
              backgroundColor: filters.purpose === 'RENT' ? `${c.brand}20` : c.surface,
            }}
          >
            <Txt
              v="caption"
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: filters.purpose === 'RENT' ? c.brand : c.fg,
              }}
            >
              🔑 Rent
            </Txt>
          </Pressable>

          {/* Sale */}
          <Pressable
            onPress={() =>
              setFilters({ ...filters, purpose: filters.purpose === 'SALE' ? '' : 'SALE' })
            }
            style={{
              paddingHorizontal: 13,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: filters.purpose === 'SALE' ? '#F59E0B' : `${c.line}90`,
              backgroundColor: filters.purpose === 'SALE' ? '#F59E0B20' : c.surface,
            }}
          >
            <Txt
              v="caption"
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: filters.purpose === 'SALE' ? '#F59E0B' : c.fg,
              }}
            >
              🏷️ Sale
            </Txt>
          </Pressable>

          {/* Top 4 Sectors */}
          {sectors.data?.slice(0, 4).map((s) => (
            <Pressable
              key={s.sector}
              onPress={() =>
                setFilters({ ...filters, sector: filters.sector === s.sector ? '' : s.sector })
              }
              style={{
                paddingHorizontal: 13,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: filters.sector === s.sector ? c.brand : `${c.line}90`,
                backgroundColor: filters.sector === s.sector ? `${c.brand}20` : c.surface,
              }}
            >
              <Txt
                v="caption"
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: filters.sector === s.sector ? c.brand : c.fg,
                }}
              >
                {s.sector} ({s.count})
              </Txt>
            </Pressable>
          ))}
        </ScrollView>

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
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 28 }}
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
