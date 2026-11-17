import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Folder, Plus } from 'lucide-react-native';
import {
  hasDelegatedAccess,
  inventoryDate,
  inventoryDateLabel,
  inventoryPrice,
  inventoryTitle,
  readableValue,
  type InventoryFolder,
  type InventoryFolderMode,
  type InventoryFolders,
  type LedgerItem,
  type PagedLedger,
} from '@brokeriq/shared';
import { InlineLoader } from '@/components/request-loader';
import { api, errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Button, Chip, ErrorView, Input, Row, Segmented, Sheet, Txt } from '@/ui';
import { BrokerScreen, NativeCard } from './screen';
import { NativeInventoryTabs } from './inventory-tabs';

const initialFilters = { sector: '', minBudget: '', maxBudget: '', dateFrom: '', dateTo: '' };
function normalizeDate(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '';
  return new Date(value + (end ? 'T23:59:59.999+05:30' : 'T00:00:00+05:30')).toISOString();
}

export function NativeInventoryFolders() {
  const { user } = useAuth();
  const { c } = useTheme();
  const qc = useQueryClient();
  const [today, setToday] = useState(inventoryDate);
  const current = today.slice(0, 7);
  useEffect(() => {
    const timer = setInterval(() => setToday(inventoryDate()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const [mode, setMode] = useState<Exclude<InventoryFolderMode, 'REVIEW'>>('AVAILABLE');
  const [selectedPath, setPath] = useState<InventoryFolder[]>([]);
  const path = mode === 'AVAILABLE' && selectedPath[0]?.key !== current ? [] : selectedPath;
  const [search, setSearch] = useState('');
  const [openFilters, setOpenFilters] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [busy, setBusy] = useState('');
  const term = useDebounced(search);
  const query = {
    ...filters,
    search: term,
    dateFrom: normalizeDate(filters.dateFrom),
    dateTo: normalizeDate(filters.dateTo, true),
    folderMode: mode,
    currentInventory: mode === 'AVAILABLE' ? 'true' : undefined,
    ...(term
      ? {}
      : mode === 'AVAILABLE'
        ? { folderMonth: path[0]?.key, folderRoom: path[1]?.key, folderFurnishing: path[2]?.key }
        : { folderSector: path[0]?.key }),
  };
  const leaf = Boolean(term) || path.length === (mode === 'AVAILABLE' ? 3 : 1);
  const folders = useQuery({
    queryKey: ['inventory-folders', user?.id, today, query],
    queryFn: () => api<InventoryFolders>(`/inventory/folders${qs(query)}`),
    enabled: !!user,
  });
  const records = useInfiniteQuery({
    queryKey: ['inventory-folder-items', user?.id, today, query],
    queryFn: ({ pageParam }) => api<PagedLedger>(`/inventory${qs({ ...query, page: pageParam, pageSize: 30 })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !!user && leaf,
  });
  const active = leaf ? records : folders;
  const canEdit = hasDelegatedAccess(user, 'inventory', 'edit');
  const canCreate = hasDelegatedAccess(user, 'inventory', 'create');
  const rows: (InventoryFolder | LedgerItem)[] = leaf ? (records.data?.pages.flatMap((page) => page.items) ?? []) : (folders.data?.folders ?? []);

  function setShelf(next: Exclude<InventoryFolderMode, 'REVIEW'>) {
    setMode(next);
    setPath([]);
  }

  function moveToRent(item: LedgerItem) {
    if (busy) return;
    Alert.alert(
      'Mark rented out',
      item.publishedListing?.status === 'ACTIVE' ? 'This will withdraw the public listing.' : 'Move this property to its rented sector?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark rented out',
          onPress: async () => {
            setBusy(item.id);
            try {
              await api(`/inventory/${item.id}`, { method: 'PATCH', body: { availability: 'RENTED', status: 'RENTED', expectedRevision: item.revision } });
              await Promise.all(
                ['inventory-folders', 'inventory-folder-items', 'ledger', 'ledger-item', 'ledger-stats'].map((key) =>
                  qc.invalidateQueries({ queryKey: [key] }),
                ),
              );
              toast.success('Marked as rented out');
            } catch (error) {
              toast.error(errorMessage(error));
            } finally {
              setBusy('');
            }
          },
        },
      ],
    );
  }

  return (
    <BrokerScreen
      title="Available Inventory"
      action={
        canCreate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add property"
            onPress={() =>
              router.push({
                pathname: '/inventory-edit',
                params: {
                  makeAvailable: '1',
                  directoryMonth: mode === 'AVAILABLE' ? (path[0]?.key ?? current) : current,
                  ...(mode === 'AVAILABLE' && path[1] ? { folderRoom: path[1].key } : {}),
                  ...(mode === 'AVAILABLE' && path[2] ? { furnishing: path[2].key } : {}),
                },
              })
            }
          >
            <Plus color={c.brand} size={28} />
          </Pressable>
        ) : undefined
      }
    >
      <FlatList
        data={rows}
        keyExtractor={(row) => ('id' in row ? row.id : row.key)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        refreshing={active.isRefetching}
        onRefresh={() => active.refetch()}
        onEndReached={() => {
          if (leaf && records.hasNextPage && !records.isFetchingNextPage) void records.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <NativeInventoryTabs active="/broker/inventory" />
            <Segmented
              value={mode}
              onChange={setShelf}
              options={[
                { value: 'AVAILABLE', label: 'Available' },
                { value: 'RENTED', label: 'Rented out' },
              ]}
            />
            <Txt color="muted" v="caption">
              Browse properties with complete details. Review older or incomplete records in All Inventory.
            </Txt>
            <Row gap={8}>
              <Input
                accessibilityLabel="Search inventory"
                placeholder="Search house, sector or contact"
                value={search}
                onChangeText={setSearch}
                containerStyle={{ flex: 1 }}
              />
              <Button
                title="Filters"
                size="sm"
                variant="secondary"
                onPress={() => {
                  setDraft(filters);
                  setOpenFilters(true);
                }}
              />
            </Row>
            <Row gap={5} wrap>
              <Chip label={mode === 'AVAILABLE' ? 'Current month' : readableValue(mode)} onPress={() => setPath([])} />
              {path.map((folder, index) => (
                <Chip key={folder.key} label={folder.label} onPress={() => setPath(path.slice(0, index + 1))} />
              ))}
            </Row>
          </View>
        }
        ListEmptyComponent={
          active.isError ? (
            <ErrorView error={active.error} onRetry={() => active.refetch()} />
          ) : active.isPending ? (
            <InlineLoader style={{ padding: 30 }} />
          ) : (
            <Txt color="muted" style={{ padding: 12 }}>
              {leaf ? 'No properties match this view.' : 'No folders match this view.'}
            </Txt>
          )
        }
        ListFooterComponent={leaf && records.isFetchingNextPage ? <InlineLoader style={{ padding: 12 }} /> : null}
        renderItem={({ item }) =>
          'id' in item ? (
            <NativeCard style={{ gap: 8 }}>
              {!!item.photoUrls?.[0] && <Image source={item.photoUrls[0]} contentFit="cover" style={{ height: 138, width: '100%', borderRadius: 12 }} />}
              <Txt v="h3">{inventoryPrice(item)}</Txt>
              <Txt color="brand" v="title" onPress={() => router.push(`/inventory/${item.id}`)}>
                {inventoryTitle(item)}
              </Txt>
              <Row gap={8} wrap>
                <Txt color="muted" style={{ flex: 1 }}>
                  {item.sector}
                  {item.bhk ? ' · ' + item.bhk + ' BHK' : ''}
                  {item.furnishing ? ' · ' + readableValue(item.furnishing) : ''}
                </Txt>
                {canEdit && (
                  <Switch
                    accessibilityLabel={mode === 'AVAILABLE' ? 'Property is available' : 'Make property available'}
                    value={mode === 'AVAILABLE'}
                    disabled={!!busy}
                    onValueChange={() =>
                      mode === 'AVAILABLE' ? moveToRent(item) : router.push({ pathname: '/inventory-edit', params: { id: item.id, makeAvailable: '1' } })
                    }
                  />
                )}
              </Row>
              {mode === 'AVAILABLE' && (
                <Txt v="caption" color="muted">
                  Available since: {item.availableSince ? inventoryDateLabel(item.availableSince) : 'Not recorded'}
                </Txt>
              )}
            </NativeCard>
          ) : (
            <NativeCard onPress={() => setPath([...path, item])}>
              <Row gap={12}>
                <View style={{ width: 52, height: 52, backgroundColor: c.brandSoft, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                  {mode === 'AVAILABLE' && !path.length ? <CalendarDays size={24} color={c.brand} /> : <Folder size={24} color={c.brand} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="title">{item.label}</Txt>
                  <Txt v="caption" color="muted">
                    {item.count} {item.count === 1 ? 'property' : 'properties'}
                  </Txt>
                </View>
              </Row>
            </NativeCard>
          )
        }
      />
      <Sheet open={openFilters} onClose={() => setOpenFilters(false)} title="Inventory filters">
        <View style={{ gap: 10 }}>
          <Input label="Sector / locality" value={draft.sector} onChangeText={(sector) => setDraft({ ...draft, sector })} />
          <Input label="Minimum price ₹" value={draft.minBudget} keyboardType="numeric" onChangeText={(minBudget) => setDraft({ ...draft, minBudget })} />
          <Input label="Maximum price ₹" value={draft.maxBudget} keyboardType="numeric" onChangeText={(maxBudget) => setDraft({ ...draft, maxBudget })} />
          <Input label="Record date from (YYYY-MM-DD)" value={draft.dateFrom} onChangeText={(dateFrom) => setDraft({ ...draft, dateFrom })} />
          <Input label="Record date through (YYYY-MM-DD)" value={draft.dateTo} onChangeText={(dateTo) => setDraft({ ...draft, dateTo })} />
          <Button
            title="Apply filters"
            onPress={() => {
              if ((draft.dateFrom && !normalizeDate(draft.dateFrom)) || (draft.dateTo && !normalizeDate(draft.dateTo))) {
                toast.error('Use a valid date in YYYY-MM-DD format');
                return;
              }
              setFilters(draft);
              setOpenFilters(false);
            }}
          />
          <Button
            title="Advanced filters"
            variant="secondary"
            onPress={() => {
              setOpenFilters(false);
              router.push({ pathname: '/(broker)/inventory', params: { ...query, view: 'ledger' } });
            }}
          />
          <Button
            title="Reset filters"
            variant="secondary"
            onPress={() => {
              setDraft(initialFilters);
              setFilters(initialFilters);
              setOpenFilters(false);
            }}
          />
        </View>
      </Sheet>
    </BrokerScreen>
  );
}
