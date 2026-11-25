import { inventoryAccessRefreshInterval } from '@brokeriq/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, FlatList, Linking, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, Folder, Search } from 'lucide-react-native';
import {
  hasDelegatedAccess,
  inventoryPossessionLabel,
  inventoryAvailabilityDate,
  inventoryAvailabilityLabel,
  lastSurveyNoAnswer,
  normalizePropertyCode,
  type SurveyWhatsAppNote,
  inventoryDate,
  inventoryPrice,
  inventoryCardTitle,
  inventoryConfigurationLabel,
  readableValue,
  type InventoryFolder,
  type InventoryFolderMode,
  type InventoryFolders,
  type LedgerItem,
  type PagedLedger,
} from '@brokeriq/shared';
import { InlineLoader } from '@/components/request-loader';
import { ListJumpControls, resultPage, useListJump } from '@/components/list-jump';
import { api, errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Button, Chip, ErrorView, Input, Row, Segmented, Sheet, Txt } from '@/ui';
import { BrokerScreen, NativeCard } from './screen';
import { NativeInventoryEntryActions } from './inventory-entry-actions';
import { NativeInventoryTabs } from './inventory-tabs';
import { NativeInventoryRecordActions } from './inventory-record-actions';
import { NativeInventoryBulkActions } from '@/launch/inventory-bulk-actions';
import { NativeInventoryFolderControls } from './inventory-folder-controls';

const initialFilters = { sector: '', minBudget: '', maxBudget: '', dateFrom: '', dateTo: '' };
function normalizeDate(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '';
  return new Date(value + (end ? 'T23:59:59.999+05:30' : 'T00:00:00+05:30')).toISOString();
}

export function NativeInventoryFolders({ initialMode = 'AVAILABLE' }: { initialMode?: 'AVAILABLE' | 'SURVEY' } = {}) {
  const { user } = useAuth();
  const { c } = useTheme();
  const qc = useQueryClient();
  const [today, setToday] = useState(inventoryDate);
  const current = today.slice(0, 7);
  useEffect(() => {
    const timer = setInterval(() => setToday(inventoryDate()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const [mode, setMode] = useState<Exclude<InventoryFolderMode, 'REVIEW'>>(initialMode);
  const survey = mode === 'SURVEY';
  const [notesOpen, setNotesOpen] = useState(false);
  const [surveyShelf, setSurveyShelf] = useState<'PENDING' | 'NO_ANSWER'>('PENDING');
  const [selectedPath, setPath] = useState<InventoryFolder[]>([]);
  const kind = selectedPath[0]?.kind;
  const path = mode === 'AVAILABLE' && !kind && selectedPath[0]?.key !== current ? [] : selectedPath;
  useFocusEffect(useCallback(() => {
    if (!path.length && mode === initialMode) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (path.length) setPath(path.slice(0, -1));
      else setMode(initialMode);
      return true;
    });
    return () => back.remove();
  }, [initialMode, mode, path]));
  const [search, setSearch] = useState('');
  const [openFilters, setOpenFilters] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [busy, setBusy] = useState('');
  const term = useDebounced(search);
  const query = {
    ...filters,
    search: survey && !path.length && !normalizePropertyCode(term) ? '' : term,
    dateFrom: normalizeDate(filters.dateFrom),
    dateTo: normalizeDate(filters.dateTo, true),
    folderMode: mode,
    surveyShelf: survey ? surveyShelf : undefined,
    currentInventory: mode === 'AVAILABLE' ? 'true' : undefined,
    ...(kind === 'CUSTOM' ? { customFolderId: path[0].key } : kind === 'SECTOR' ? { folderSector: path[0].key } : survey
      ? { folderSector: path[0]?.key }
      : term
        ? {}
        : mode === 'AVAILABLE'
          ? { folderMonth: path[0]?.key, folderRoom: path[1]?.key, folderFurnishing: path[2]?.key }
          : { folderSector: path[0]?.key }),
  };
  const leaf = !!kind || Boolean(normalizePropertyCode(term)) || (!survey && Boolean(term)) || path.length === (mode === 'AVAILABLE' ? 3 : 1);
  const notes = useQuery({
    queryKey: ['survey-whatsapp-notes', user?.id],
    queryFn: () => api<SurveyWhatsAppNote[]>('/inventory/survey-notes'),
    enabled: survey && notesOpen && user?.role === 'BROKER_ADMIN',
  });
  const folders = useQuery({
    queryKey: ['inventory-folders', user?.id, today, query],
    queryFn: () => api<InventoryFolders>(`/inventory/folders${qs(query)}`),
    enabled: !!user && (!leaf || survey),
  });
  const jumpScope = JSON.stringify([query, user?.id, user?.organization?.id]);
  const [anchor, setAnchor] = useState({ scope: '', page: 1 });
  const startPage = anchor.scope === jumpScope ? anchor.page : 1;
  const scroll = useListJump();
  const list = useRef<FlatList<InventoryFolder | LedgerItem>>(null);

  const records = useInfiniteQuery({
    queryKey: ['inventory-folder-items', user?.id, today, query, startPage],
    queryFn: ({ pageParam }) => api<PagedLedger>(`/inventory${qs({ ...query, page: pageParam, pageSize: 30 })}`),
    initialPageParam: startPage,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !!user && leaf,
    refetchInterval: (state) => inventoryAccessRefreshInterval(state.state.data?.pages.flatMap((page) => page.items) ?? []),
  });
  const active = leaf ? records : folders;
  const photoCounts = leaf ? records.data?.pages[0]?.photoCounts : folders.data?.photoCounts;
  const canEdit = hasDelegatedAccess(user, 'inventory', 'edit');
  const rows: (InventoryFolder | LedgerItem)[] = leaf
    ? (records.data?.pages.flatMap((page) => page.items) ?? [])
    : [...(folders.data?.folders ?? []), ...(folders.data?.extraFolders ?? [])].filter((folder) => !survey || !term || folder.label.toLowerCase().includes(term.toLowerCase()));

  const bulkScope = JSON.stringify([user?.id, user?.organization?.id, query]);
  const [bulkSelection, setBulkSelection] = useState<{ scope: string; ids: string[] }>({ scope: '', ids: [] });
  const selecting = bulkSelection.scope === bulkScope;
  const selection = selecting ? bulkSelection.ids : [];
  const select = (ids: string[]) => setBulkSelection({ scope: bulkScope, ids });

  function setShelf(next: Exclude<InventoryFolderMode, 'REVIEW'>) {
    setMode(next);
    setPath([]);
  }

  async function markNoAnswer(item: LedgerItem) {
    if (!canEdit || item.canEdit === false || busy) return;
    setBusy(item.id);
    try {
      await api(`/inventory/${encodeURIComponent(item.id)}/survey-call`, { method: 'PATCH', body: { expectedRevision: item.revision } });
      await Promise.all(['inventory-folder-items', 'ledger-item', 'ledger'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success('No answer recorded. Property moved to No answer.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy('');
    }
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
                [
                  'inventory-folders',
                  'inventory-folder-items',
                  'ledger',
                  'ledger-item',
                  'ledger-stats',
                  'broker-today',
                  'agent-assignments',
                  'agent-assignment-records',
                ].map((key) => qc.invalidateQueries({ queryKey: [key] })),
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
    <BrokerScreen title={survey ? 'Survey' : 'Available Inventory'}>
      <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        onScroll={scroll.measure}
        scrollEventThrottle={64}
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(row) => ('id' in row ? row.id : row.key)}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 28, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        refreshing={active.isRefetching}
        onRefresh={() => active.refetch()}
        onEndReached={() => {
          if (leaf && records.hasNextPage && !records.isFetchingNextPage) void records.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <NativeInventoryEntryActions
              survey={survey}
              params={{
                ...((kind === 'SECTOR' || (survey && !kind)) && path[0]?.key && path[0].key !== '__unset__' ? { sector: path[0].key } : {}),
                ...(kind === 'CUSTOM' ? { customFolderId: path[0].key } : {}),
                makeAvailable: '1',
                directoryMonth: mode === 'AVAILABLE' && !kind ? (path[0]?.key ?? current) : current,
                ...(mode === 'AVAILABLE' && path[1] ? { folderRoom: path[1].key } : {}),
                ...(mode === 'AVAILABLE' && path[2] ? { furnishing: path[2].key } : {}),
              }}
            />
            <NativeInventoryFolderControls onCreated={(folder) => setPath([{ key: folder.kind === 'CUSTOM' ? folder.id : folder.label, label: folder.label, kind: folder.kind, count: 0 }])} />
            <NativeInventoryTabs active="/broker/inventory" />
            <Segmented
              value={mode}
              onChange={setShelf}
              options={[
                { value: 'AVAILABLE', label: 'Available' },
                { value: 'RENTED', label: 'Rented out' },
                { value: 'SURVEY', label: 'Survey' },
              ]}
            />
            {survey && (
              <Segmented
                value={surveyShelf}
                onChange={setSurveyShelf}
                options={[
                  { value: 'PENDING', label: `Pending ${folders.data?.surveyCounts?.pending ?? ''}`.trim() },
                  { value: 'NO_ANSWER', label: `No answer ${folders.data?.surveyCounts?.noAnswer ?? ''}`.trim() },
                ]}
              />
            )}
            {survey && user?.role === 'BROKER_ADMIN' && (
              <Button title={notesOpen ? 'Hide WhatsApp notes' : 'WhatsApp notes'} variant="secondary" onPress={() => setNotesOpen(!notesOpen)} />
            )}
            {survey && notesOpen && user?.role === 'BROKER_ADMIN' && (
              <>
                {notes.isLoading && <Txt v="caption">Loading notes…</Txt>}
                {notes.isError && <Button title="Retry notes" variant="secondary" onPress={() => void notes.refetch()} />}
                {notes.data?.length === 0 && <Txt v="caption">No WhatsApp notes to review.</Txt>}
                {notes.data?.map((note) => (
                  <Button key={note.id} variant="secondary"
                    title={`${note.conversation.contactName || note.conversation.contactPhone || 'WhatsApp'} · ${note.state === 'REVIEW' ? 'Needs review' : 'No Survey match'} · ${note.body.slice(0, 80)}`}
                    onPress={() => router.push(`/wa/${note.conversationId}`)}
                  />
                ))}
              </>
            )}
            <Txt color="muted" v="caption">
              Browse properties with complete details. Review older or incomplete records in All Inventory.
            </Txt>
            <Row gap={8}>
              <Input
                icon={<Search size={18} color={c.muted} />}
                accessibilityLabel="Search inventory"
                placeholder="Search Property ID, house, sector or contact"
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
            {canEdit && leaf && <Button title={selecting ? 'Done selecting' : 'Select properties'} size="sm" variant="secondary"
              onPress={() => { if (selecting) setBulkSelection({ scope: '', ids: [] }); else select([]); }} />}
            {canEdit && leaf && selecting && <NativeInventoryBulkActions key={bulkScope} selected={selection} onSelect={select}
              filters={query} count={records.data?.pages[0]?.total ?? 0}
              pageIds={rows.flatMap((row) => 'id' in row && row.canEdit !== false ? [row.id] : [])} />}
            {photoCounts && (
              <Row gap={12} wrap>
                <Txt v="caption">With photos: {photoCounts.withPhotos}</Txt>
                <Txt v="caption">Without photos: {photoCounts.withoutPhotos}</Txt>
              </Row>
            )}
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
              {selecting && canEdit && item.canEdit !== false && <Button size="sm" variant="secondary"
                title={selection.includes(item.id) ? 'Deselect ' + item.propertyCode : 'Select ' + item.propertyCode}
                onPress={() => select(selection.includes(item.id) ? selection.filter((id) => id !== item.id) : [...selection, item.id])} />}
              {!!(item.agentCoverPhotoUrl || item.photoUrls?.[0]) && (
                <Image source={item.agentCoverPhotoUrl || item.photoUrls?.[0]} contentFit="cover" style={{ height: 138, width: '100%', borderRadius: 12 }} />
              )}
              {mode !== 'RENTED' && (
                <Txt v="small" color="brand">
                  {mode === 'AVAILABLE' && (inventoryAvailabilityDate(item) ?? '') > today ? inventoryAvailabilityLabel(item) : inventoryPossessionLabel(item)}
                </Txt>
              )}
              {!survey && <Txt v="h3">{inventoryPrice(item)}</Txt>}
              <Txt color="brand" v="title" onPress={() => router.push(`/inventory/${item.id}`)}>
                {inventoryCardTitle(item)}
              </Txt>
              <Row gap={8} wrap>
                <Txt color="muted" style={{ flex: 1 }}>
                  {[inventoryConfigurationLabel(item), item.furnishing ? readableValue(item.furnishing) : null].filter(Boolean).join(' · ')}
                </Txt>
                {!survey && (
                  <Switch
                    accessibilityLabel={mode === 'AVAILABLE' ? 'Property is available' : 'Make property available'}
                    value={mode === 'AVAILABLE'}
                    disabled={!canEdit || item.canEdit === false || !!busy}
                    onValueChange={() =>
                      mode === 'AVAILABLE' ? moveToRent(item) : router.push({ pathname: '/inventory-edit', params: { id: item.id, makeAvailable: '1' } })
                    }
                  />
                )}
              </Row>
              {survey && lastSurveyNoAnswer(item.notes) && (
                <Txt v="caption" color="muted">
                  {lastSurveyNoAnswer(item.notes)}
                </Txt>
              )}
              {survey && (
                <Row wrap gap={8}>
                  <Button
                    title="No answer"
                    size="sm"
                    variant="ghost"
                    disabled={!canEdit || item.canEdit === false || !!busy}
                    onPress={() => void markNoAnswer(item)}
                  />
                  {!!(item.contacts?.find((contact) => contact.phone)?.phone ?? item.ownerPhone) && (
                    <Button
                      title="Call contact"
                      size="sm"
                      variant="ghost"
                      onPress={() =>
                        void Linking.openURL(`tel:${item.contacts?.find((contact) => contact.phone)?.phone ?? item.ownerPhone}`).catch(() =>
                          toast.error('Unable to open phone'),
                        )
                      }
                    />
                  )}
                  <Button
                    title="Confirm availability"
                    size="sm"
                    variant="secondary"
                    disabled={!canEdit || item.canEdit === false}
                    onPress={() => router.push({ pathname: '/inventory-edit', params: { id: item.id, makeAvailable: '1' } })}
                  />
                  <Button
                    title="Mark rented out"
                    size="sm"
                    variant="ghost"
                    disabled={!canEdit || item.canEdit === false || !!busy}
                    onPress={() => moveToRent(item)}
                  />
                </Row>
              )}
              {user?.role === 'BROKER_AGENT' && ['LOCKED', 'EXPIRED', 'REJECTED', 'REVOKED'].includes(item.detailAccess ?? '') && (
                <Button title="Request full details" size="sm" variant="ghost" onPress={() => router.push(`/inventory/${item.id}`)} />
              )}
              <NativeInventoryRecordActions item={item} />
            </NativeCard>
          ) : (
            <NativeCard
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 22,
                shadowColor: '#231345',
                shadowOpacity: 0.1,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 8,
                elevation: 3,
              }}
              onPress={() => setPath([...path, item])}
            >
              <Row gap={12}>
                <View style={{ width: 48, height: 48, backgroundColor: c.brandSoft, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                  {mode === 'AVAILABLE' && !path.length ? <CalendarDays size={24} color={c.brand} /> : <Folder size={24} color={c.brand} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="h3">{item.label}</Txt>
                  <Txt v="small" color="muted">
                    {item.count} {item.count === 1 ? 'property' : 'properties'}
                  </Txt>
                </View>
                <ChevronRight size={21} color={c.fg} />
              </Row>
            </NativeCard>
          )
        }
      />
      {scroll.visible && leaf && records.data && <ListJumpControls onJump={(to) => {
        const total = records.data!.pages[0]?.totalPages ?? 1;
        const page = resultPage(to, Math.max(total, 1));
        if (page === startPage && to === 'bottom') list.current?.scrollToEnd();
        else {
          setAnchor({ scope: jumpScope, page });
          scroll.reset();
          list.current?.scrollToOffset({ offset: 0, animated: false });
        }
      }} />}
      </View>
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
              router.push({ pathname: '/(broker)/inventory-ledger', params: query });
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
