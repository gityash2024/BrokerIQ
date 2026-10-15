import { useState } from 'react';
import {
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Rocket,
  ScanLine,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { formatINR } from '@brokeriq/shared';
import { api, del, patch, post, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { alert } from '@/lib/i18n';
import { ListingsManager } from '@/components/listings-manager';
import { Badge, Button, Card, Chip, Empty, IconBtn, PressableScale, Row, Skeleton, Txt } from '@/ui';

interface InventoryItem {
  id: string;
  sector: string;
  houseNo: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  propertyType?: string | null;
  purpose: string;
  bhk?: number | null;
  floor?: string | null;
  furnishing?: string | null;
  rent?: number | null;
  securityDeposit?: number | null;
  brokerage?: string | null;
  tenantPreference?: string | null;
  notes?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'RENTED';
  date: string;
  pageNo?: number | null;
  isPublished: boolean;
  publishedListingId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#D97706',
  ACTIVE: '#059669',
  RENTED: '#0284C7',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft / Incomplete',
  ACTIVE: 'Active / Ready',
  RENTED: 'Rented',
};

export default function Inventory() {
  const { c } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ledger' | 'listings'>('ledger');

  // Filters for ledger
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [bhk, setBhk] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Edit modal
  const [editItem, setEditItem] = useState<Partial<InventoryItem> | null>(null);

  // WhatsApp dynamic pitch modal
  const [waItem, setWaItem] = useState<InventoryItem | null>(null);
  const [waTemplate, setWaTemplate] = useState<'owner' | 'client'>('owner');
  const [waMessage, setWaMessage] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [copied, setCopied] = useState(false);

  const generateWaMessage = (item: InventoryItem, type: 'owner' | 'client') => {
    const brokerName = user?.name || 'Broker';
    const brokerFirm = user?.organization?.name || 'Real Estate';
    const owner = item.ownerName && item.ownerName !== 'Owner' ? item.ownerName : 'Sir/Ma\'am';
    const bhkStr = item.bhk ? `${item.bhk} BHK` : '';
    const floorStr = item.floor ? `${item.floor} Floor` : '';
    const configStr = [bhkStr, floorStr].filter(Boolean).join(' ');
    const priceStr = item.rent ? formatINR(item.rent) : 'Price on request';
    const houseStr = item.houseNo && item.houseNo !== '--' ? `House No. ${item.houseNo}` : 'Property';
    const furnStr = item.furnishing ? item.furnishing.replace(/_/g, ' ').toLowerCase() : 'standard';

    if (type === 'owner') {
      return `Namaste ${owner}, I am ${brokerName} from ${brokerFirm}. Regarding your property in ${item.sector} ${houseStr} (${configStr}, ${item.purpose === 'SALE' ? 'Sale' : 'Rent'}: ₹${priceStr}), is it currently available for deal/visit? Please let me know suitable time for client site visit.`;
    } else {
      return `🏠 *Verified Property in ${item.sector}*\n` +
        `• Unit: ${houseStr}\n` +
        (configStr ? `• Configuration: ${configStr}\n` : '') +
        (item.furnishing ? `• Furnishing: ${furnStr}\n` : '') +
        `• ${item.purpose === 'SALE' ? 'Demand' : 'Rent'}: ₹${priceStr}\n` +
        (item.tenantPreference ? `• Suitable for: ${item.tenantPreference}\n` : '') +
        `• Contact: ${brokerName} (${brokerFirm})\n\n` +
        `Interested in scheduling a site visit? Reply to this message or call directly.`;
    }
  };

  const openWaDialog = (item: InventoryItem, initialType: 'owner' | 'client' = 'owner') => {
    setWaItem(item);
    setWaTemplate(initialType);
    setWaMessage(generateWaMessage(item, initialType));
    setCopied(false);
    setClientPhone('');
  };

  const handleSendWa = () => {
    if (!waItem) return;
    const encoded = encodeURIComponent(waMessage);
    if (waTemplate === 'owner') {
      const cleanPhone = (waItem.ownerPhone || '').replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        toast.error('Owner ka valid phone number nahi mila');
        return;
      }
      Linking.openURL(`https://wa.me/91${cleanPhone}?text=${encoded}`);
    } else {
      const cleanClient = clientPhone.replace(/\D/g, '');
      if (cleanClient && cleanClient.length >= 10) {
        Linking.openURL(`https://wa.me/91${cleanClient}?text=${encoded}`);
      } else {
        Linking.openURL(`https://api.whatsapp.com/send?text=${encoded}`);
      }
    }
  };

  const handleCopyWa = async () => {
    await Clipboard.setStringAsync(waMessage);
    setCopied(true);
    toast.success('Message copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Query Sectors
  const sectorsQuery = useQuery({
    queryKey: ['mobile-inventory-sectors'],
    queryFn: () => api<{ sector: string; count: number }[]>('/inventory/sectors'),
    staleTime: 60_000,
  });

  // Query Inventory
  const queryParams = {
    search: search.trim() || undefined,
    sector: sector || undefined,
    bhk: bhk || undefined,
    status: status || undefined,
    page,
    pageSize: 20,
  };

  const inventoryQuery = useQuery({
    queryKey: ['mobile-inventory', queryParams],
    queryFn: () =>
      api<{
        items: InventoryItem[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        statusCounts: { ALL: number; DRAFT: number; ACTIVE: number; RENTED: number };
      }>(`/inventory${qs(queryParams)}`),
    enabled: activeTab === 'ledger',
  });

  const saveMutation = useApiMutation(
    (item: Partial<InventoryItem>) => patch(`/inventory/${item.id}`, item),
    {
      success: 'इन्वेंटरी रो अपडेट हो गई',
      invalidate: [['mobile-inventory']],
      onSuccess: () => setEditItem(null),
    }
  );

  const deleteMutation = useApiMutation((id: string) => del(`/inventory/${id}`), {
    success: 'रो हटा दी गई',
    invalidate: [['mobile-inventory']],
  });

  const publishMutation = useApiMutation((id: string) => post(`/inventory/${id}/publish`), {
    success: 'प्रॉपर्टी मार्केटप्लेस पर लाइव पब्लिश हो गई!',
    invalidate: [['mobile-inventory'], ['my-listings']],
  });

  const data = inventoryQuery.data;
  const statusCounts = data?.statusCounts ?? { ALL: 0, DRAFT: 0, ACTIVE: 0, RENTED: 0 };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Top Header */}
      <Row
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 8,
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: c.line,
          backgroundColor: c.surface,
        }}
      >
        <View>
          <Txt v="h2">Inventory</Txt>
          <Txt v="caption" color="muted">
            117-पेज लेजर & लाइव लिस्टिंग्स
          </Txt>
        </View>
        <Row style={{ gap: 8 }}>
          <IconBtn onPress={() => router.push('/scanner')} style={{ backgroundColor: c.surface2 }}>
            <ScanLine size={20} color={c.brand} />
          </IconBtn>
          <IconBtn onPress={() => router.push('/post-property')} style={{ backgroundColor: c.brand }}>
            <Plus size={22} color="#fff" />
          </IconBtn>
        </Row>
      </Row>

      {/* Main Mode Tabs: Property Ledger vs Live Listings */}
      <Row
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 8,
          backgroundColor: c.surface,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        <Button
          size="sm"
          variant={activeTab === 'ledger' ? 'primary' : 'secondary'}
          title={`Ledger (${statusCounts.ALL || '1.9K+'})`}
          icon={<FileSpreadsheet size={16} color={activeTab === 'ledger' ? '#fff' : c.fg} />}
          onPress={() => setActiveTab('ledger')}
          style={{ flex: 1 }}
        />
        <Button
          size="sm"
          variant={activeTab === 'listings' ? 'primary' : 'secondary'}
          title="Live Listings"
          icon={<Building2 size={16} color={activeTab === 'listings' ? '#fff' : c.fg} />}
          onPress={() => setActiveTab('listings')}
          style={{ flex: 1 }}
        />
      </Row>

      {/* View 1: Live Listings Mode */}
      {activeTab === 'listings' && <ListingsManager header={null} />}

      {/* View 2: Property Ledger / Handwritten Sheet Mode */}
      {activeTab === 'ledger' && (
        <View style={{ flex: 1 }}>
          {/* Top Mini Stats Bar */}
          <Row
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: c.surface2,
              gap: 8,
              justifyContent: 'space-around',
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <Txt v="label" color="muted">Total</Txt>
              <Txt v="bodyStrong">{statusCounts.ALL.toLocaleString()}</Txt>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Txt v="label" style={{ color: STATUS_COLORS.DRAFT }}>Draft</Txt>
              <Txt v="bodyStrong" style={{ color: STATUS_COLORS.DRAFT }}>
                {statusCounts.DRAFT.toLocaleString()}
              </Txt>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Txt v="label" style={{ color: STATUS_COLORS.ACTIVE }}>Active</Txt>
              <Txt v="bodyStrong" style={{ color: STATUS_COLORS.ACTIVE }}>
                {statusCounts.ACTIVE.toLocaleString()}
              </Txt>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Txt v="label" style={{ color: STATUS_COLORS.RENTED }}>Rented</Txt>
              <Txt v="bodyStrong" style={{ color: STATUS_COLORS.RENTED }}>
                {statusCounts.RENTED.toLocaleString()}
              </Txt>
            </View>
          </Row>

          {/* Search Box */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: c.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: c.line,
                paddingHorizontal: 12,
                height: 42,
              }}
            >
              <Search size={16} color={c.subtle} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, color: c.fg, fontSize: 14 }}
                placeholder="House No, Phone, Notes..."
                placeholderTextColor={c.subtle}
                value={search}
                onChangeText={(t) => {
                  setSearch(t);
                  setPage(1);
                }}
              />
              {!!search && (
                <IconBtn
                  onPress={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  style={{ width: 28, height: 28 }}
                >
                  <X size={14} color={c.subtle} />
                </IconBtn>
              )}
            </View>
          </View>

          {/* Filter Chips: Status */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 6 }}
          >
            <Chip
              label={`All (${statusCounts.ALL})`}
              active={status === ''}
              onPress={() => {
                setStatus('');
                setPage(1);
              }}
            />
            <Chip
              label={`Draft (${statusCounts.DRAFT})`}
              active={status === 'DRAFT'}
              color={STATUS_COLORS.DRAFT}
              onPress={() => {
                setStatus('DRAFT');
                setPage(1);
              }}
            />
            <Chip
              label={`Active (${statusCounts.ACTIVE})`}
              active={status === 'ACTIVE'}
              color={STATUS_COLORS.ACTIVE}
              onPress={() => {
                setStatus('ACTIVE');
                setPage(1);
              }}
            />
            <Chip
              label={`Rented (${statusCounts.RENTED})`}
              active={status === 'RENTED'}
              color={STATUS_COLORS.RENTED}
              onPress={() => {
                setStatus('RENTED');
                setPage(1);
              }}
            />
          </ScrollView>

          {/* Filter Chips: Sectors */}
          {sectorsQuery.data && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 6 }}
            >
              <Chip
                label="All Sectors"
                active={sector === ''}
                onPress={() => {
                  setSector('');
                  setPage(1);
                }}
              />
              {sectorsQuery.data.slice(0, 15).map((s) => (
                <Chip
                  key={s.sector}
                  label={`${s.sector} (${s.count})`}
                  active={sector === s.sector}
                  onPress={() => {
                    setSector(sector === s.sector ? '' : s.sector);
                    setPage(1);
                  }}
                />
              ))}
            </ScrollView>
          )}

          {/* Filter Chips: BHK */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 6 }}
          >
            <Chip
              label="All BHK"
              active={bhk === ''}
              onPress={() => {
                setBhk('');
                setPage(1);
              }}
            />
            {['1', '2', '3', '4', '5'].map((b) => (
              <Chip
                key={b}
                label={`${b} BHK`}
                active={bhk === b}
                onPress={() => {
                  setBhk(bhk === b ? '' : b);
                  setPage(1);
                }}
              />
            ))}
          </ScrollView>

          {/* Inventory Items List */}
          {inventoryQuery.isLoading ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton style={{ height: 100, borderRadius: 16 }} />
              <Skeleton style={{ height: 100, borderRadius: 16 }} />
              <Skeleton style={{ height: 100, borderRadius: 16 }} />
            </View>
          ) : !data?.items?.length ? (
            <Empty
              title="कोई लेजर रिकॉर्ड नहीं मिला"
              text="फिल्टर बदलें या AI Scanner से नए पेज स्कैन करें।"
            />
          ) : (
            <FlatList
              data={data.items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}
              refreshControl={
                <RefreshControl
                  refreshing={inventoryQuery.isRefetching}
                  onRefresh={() => inventoryQuery.refetch()}
                />
              }
              renderItem={({ item, index }) => (
                <Card style={{ padding: 14 }}>
                  {/* Row 1: Sector, House No, Page No, Status Badge */}
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Row style={{ gap: 6, alignItems: 'center' }}>
                        <Txt v="bodyStrong" style={{ fontSize: 16 }}>
                          House {item.houseNo}
                        </Txt>
                        {item.pageNo && (
                          <View
                            style={{
                              backgroundColor: c.surface2,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Txt v="caption" color="muted">
                              P.{item.pageNo}
                            </Txt>
                          </View>
                        )}
                      </Row>
                      <Row style={{ gap: 4, alignItems: 'center', marginTop: 3 }}>
                        <MapPin size={13} color={c.brand} />
                        <Txt v="caption" color="muted">
                          {item.sector}
                        </Txt>
                      </Row>
                    </View>

                    <View
                      style={{
                        backgroundColor: `${STATUS_COLORS[item.status]}20`,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                      }}
                    >
                      <Txt
                        v="caption"
                        style={{ color: STATUS_COLORS[item.status], fontWeight: '700' }}
                      >
                        {STATUS_LABELS[item.status]}
                      </Txt>
                    </View>
                  </Row>

                  {/* Row 2: Property Specs */}
                  <Row style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: c.surface2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Txt v="caption" color="fg">
                        {item.bhk ? `${item.bhk} BHK` : 'BHK N/A'}
                        {item.floor ? ` · ${item.floor}` : ''}
                      </Txt>
                    </View>

                    {item.rent ? (
                      <View style={{ backgroundColor: '#05966915', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Txt v="caption" style={{ color: '#059669', fontWeight: '700' }}>
                          {formatINR(item.rent)}/mo
                        </Txt>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: '#D9770615', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Txt v="caption" style={{ color: '#D97706' }}>
                          Rent N/A
                        </Txt>
                      </View>
                    )}

                    {item.furnishing && (
                      <View style={{ backgroundColor: c.surface2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Txt v="caption" color="muted">
                          {item.furnishing.replace(/_/g, ' ')}
                        </Txt>
                      </View>
                    )}

                    {item.tenantPreference && (
                      <View style={{ backgroundColor: c.surface2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Txt v="caption" color="muted">
                          {item.tenantPreference}
                        </Txt>
                      </View>
                    )}
                  </Row>

                  {/* Row 3: Notes if any */}
                  {item.notes && (
                    <Txt v="caption" color="muted" style={{ marginTop: 8, fontStyle: 'italic' }}>
                      {item.notes}
                    </Txt>
                  )}

                  {/* Row 4: Owner Contact & Actions */}
                  <Row
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 12,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: c.line,
                    }}
                  >
                    {/* Owner Call & WA */}
                    {item.ownerPhone ? (
                      <Row style={{ gap: 8 }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          title={item.ownerPhone}
                          icon={<Phone size={13} color={c.brand} />}
                          onPress={() => Linking.openURL(`tel:${item.ownerPhone}`)}
                        />
                        <Button
                          size="sm"
                          variant="whatsapp"
                          title="WA"
                          icon={<MessageCircle size={13} color="#fff" />}
                          onPress={() => openWaDialog(item, 'owner')}
                        />
                      </Row>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="WA Pitch"
                        icon={<MessageCircle size={13} color="#25D366" />}
                        onPress={() => openWaDialog(item, 'client')}
                      />
                    )}

                    {/* Action buttons */}
                    <Row style={{ gap: 6 }}>
                      {/* WhatsApp pitch icon */}
                      <IconBtn
                        onPress={() => openWaDialog(item, 'client')}
                        style={{ width: 32, height: 32, backgroundColor: '#25D36620' }}
                      >
                        <MessageCircle size={15} color="#25D366" />
                      </IconBtn>

                      {item.isPublished ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 4 }}>
                          <CheckCircle2 size={14} color="#059669" />
                          <Txt v="caption" style={{ color: '#059669', fontWeight: '700' }}>
                            Live
                          </Txt>
                        </View>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          title="Publish"
                          icon={<Rocket size={13} color="#fff" />}
                          onPress={() =>
                            alert('Publish to Marketplace', 'क्या आप इस इन्वेंटरी आइटम को लाइव मार्केटप्लेस पर पब्लिश करना चाहते हैं?', [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Publish', onPress: () => publishMutation.mutate(item.id) },
                            ])
                          }
                        />
                      )}

                      <IconBtn
                        onPress={() => setEditItem(item)}
                        style={{ width: 32, height: 32, backgroundColor: c.surface2 }}
                      >
                        <Pencil size={14} color={c.fg} />
                      </IconBtn>

                      <IconBtn
                        onPress={() =>
                          alert('Delete Item', `House ${item.houseNo}, ${item.sector} को हटाना चाहते हैं?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', onPress: () => deleteMutation.mutate(item.id) },
                          ])
                        }
                        style={{ width: 32, height: 32, backgroundColor: c.surface2 }}
                      >
                        <Trash2 size={14} color="#E11D48" />
                      </IconBtn>
                    </Row>
                  </Row>
                </Card>
              )}
            />
          )}

          {/* Pagination Controls */}
          {data && data.totalPages > 1 && (
            <Row
              style={{
                padding: 12,
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: c.surface,
                borderTopWidth: 1,
                borderTopColor: c.line,
              }}
            >
              <Button
                size="sm"
                variant="secondary"
                title="Prev"
                disabled={page <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              />
              <Txt v="caption" color="muted">
                Page {page} of {data.totalPages} ({data.total} items)
              </Txt>
              <Button
                size="sm"
                variant="secondary"
                title="Next"
                disabled={page >= data.totalPages}
                onPress={() => setPage((p) => p + 1)}
              />
            </Row>
          )}

          {/* Quick Edit Modal */}
          <Modal
            visible={Boolean(editItem)}
            transparent
            animationType="slide"
            onRequestClose={() => setEditItem(null)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View
                style={{
                  backgroundColor: c.surface,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 20,
                  maxHeight: '80%',
                }}
              >
                <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Txt v="h3">Edit Inventory Row</Txt>
                  <IconBtn onPress={() => setEditItem(null)} style={{ width: 32, height: 32 }}>
                    <X size={18} color={c.fg} />
                  </IconBtn>
                </Row>

                {editItem && (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <Txt v="caption" color="muted" style={{ marginBottom: 4 }}>Sector</Txt>
                    <TextInput
                      style={{
                        backgroundColor: c.surface2,
                        borderRadius: 10,
                        padding: 12,
                        color: c.fg,
                        marginBottom: 12,
                      }}
                      value={editItem.sector || ''}
                      onChangeText={(t) => setEditItem({ ...editItem, sector: t })}
                    />

                    <Txt v="caption" color="muted" style={{ marginBottom: 4 }}>House No</Txt>
                    <TextInput
                      style={{
                        backgroundColor: c.surface2,
                        borderRadius: 10,
                        padding: 12,
                        color: c.fg,
                        marginBottom: 12,
                      }}
                      value={editItem.houseNo || ''}
                      onChangeText={(t) => setEditItem({ ...editItem, houseNo: t })}
                    />

                    <Txt v="caption" color="muted" style={{ marginBottom: 4 }}>Rent (₹)</Txt>
                    <TextInput
                      keyboardType="numeric"
                      style={{
                        backgroundColor: c.surface2,
                        borderRadius: 10,
                        padding: 12,
                        color: c.fg,
                        marginBottom: 12,
                      }}
                      value={editItem.rent ? String(editItem.rent) : ''}
                      onChangeText={(t) => setEditItem({ ...editItem, rent: Number(t) || null })}
                    />

                    <Txt v="caption" color="muted" style={{ marginBottom: 4 }}>Floor</Txt>
                    <TextInput
                      style={{
                        backgroundColor: c.surface2,
                        borderRadius: 10,
                        padding: 12,
                        color: c.fg,
                        marginBottom: 12,
                      }}
                      value={editItem.floor || ''}
                      onChangeText={(t) => setEditItem({ ...editItem, floor: t })}
                    />

                    <Txt v="caption" color="muted" style={{ marginBottom: 4 }}>Owner Phone</Txt>
                    <TextInput
                      keyboardType="phone-pad"
                      style={{
                        backgroundColor: c.surface2,
                        borderRadius: 10,
                        padding: 12,
                        color: c.fg,
                        marginBottom: 12,
                      }}
                      value={editItem.ownerPhone || ''}
                      onChangeText={(t) => setEditItem({ ...editItem, ownerPhone: t })}
                    />

                    <Txt v="caption" color="muted" style={{ marginBottom: 4 }}>Notes</Txt>
                    <TextInput
                      multiline
                      numberOfLines={3}
                      style={{
                        backgroundColor: c.surface2,
                        borderRadius: 10,
                        padding: 12,
                        color: c.fg,
                        marginBottom: 20,
                        minHeight: 70,
                      }}
                      value={editItem.notes || ''}
                      onChangeText={(t) => setEditItem({ ...editItem, notes: t })}
                    />

                    <Button
                      size="lg"
                      title="Save Changes"
                      loading={saveMutation.isPending}
                      onPress={() => editItem && saveMutation.mutate(editItem)}
                    />
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>

          {/* Dynamic WhatsApp Action Modal */}
          <Modal
            visible={Boolean(waItem)}
            transparent
            animationType="slide"
            onRequestClose={() => setWaItem(null)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View
                style={{
                  backgroundColor: c.surface,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 20,
                  maxHeight: '85%',
                }}
              >
                <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Row style={{ gap: 8, alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#25D36620', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageCircle size={18} color="#25D366" />
                    </View>
                    <Txt v="h3">WhatsApp Message</Txt>
                  </Row>
                  <IconBtn onPress={() => setWaItem(null)} style={{ width: 32, height: 32 }}>
                    <X size={18} color={c.fg} />
                  </IconBtn>
                </Row>

                {waItem && (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Unit Info Summary */}
                    <Card style={{ padding: 10, backgroundColor: c.surface2, marginBottom: 12 }}>
                      <Txt v="caption" color="fg" style={{ fontWeight: '700' }}>
                        House {waItem.houseNo}, {waItem.sector}
                      </Txt>
                      <Txt v="caption" color="muted">
                        {waItem.bhk ? `${waItem.bhk} BHK` : ''} {waItem.floor ? `· ${waItem.floor}` : ''} · {waItem.rent ? `${formatINR(waItem.rent)}/mo` : 'Price N/A'}
                        {waItem.ownerPhone ? ` · Owner: ${waItem.ownerPhone}` : ''}
                      </Txt>
                    </Card>

                    {/* Template Switcher */}
                    <Txt v="caption" color="muted" style={{ marginBottom: 6 }}>
                      संदेश प्रकार (Template):
                    </Txt>
                    <Row style={{ gap: 8, marginBottom: 12 }}>
                      <PressableScale
                        onPress={() => {
                          setWaTemplate('owner');
                          setWaMessage(generateWaMessage(waItem, 'owner'));
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          backgroundColor: waTemplate === 'owner' ? '#25D36618' : c.surface2,
                          borderWidth: 1.5,
                          borderColor: waTemplate === 'owner' ? '#25D366' : 'transparent',
                          alignItems: 'center',
                        }}
                      >
                        <Txt
                          v="caption"
                          style={{
                            fontWeight: '700',
                            color: waTemplate === 'owner' ? '#128C7E' : c.fg,
                          }}
                        >
                          Owner Availability
                        </Txt>
                      </PressableScale>

                      <PressableScale
                        onPress={() => {
                          setWaTemplate('client');
                          setWaMessage(generateWaMessage(waItem, 'client'));
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          backgroundColor: waTemplate === 'client' ? '#25D36618' : c.surface2,
                          borderWidth: 1.5,
                          borderColor: waTemplate === 'client' ? '#25D366' : 'transparent',
                          alignItems: 'center',
                        }}
                      >
                        <Txt
                          v="caption"
                          style={{
                            fontWeight: '700',
                            color: waTemplate === 'client' ? '#128C7E' : c.fg,
                          }}
                        >
                          Client Pitch
                        </Txt>
                      </PressableScale>
                    </Row>

                    {/* Optional Client Phone Input */}
                    {waTemplate === 'client' && (
                      <View style={{ marginBottom: 12 }}>
                        <Txt v="caption" color="muted" style={{ marginBottom: 4 }}>
                          Client Phone Number (वैकल्पिक / Optional):
                        </Txt>
                        <TextInput
                          style={{
                            backgroundColor: c.surface2,
                            borderRadius: 10,
                            padding: 10,
                            color: c.fg,
                            fontSize: 13,
                          }}
                          placeholder="e.g. 9876543210 (खाली छोड़ेंगे तो WhatsApp contact chooser खुलेगा)"
                          placeholderTextColor={c.subtle}
                          keyboardType="phone-pad"
                          value={clientPhone}
                          onChangeText={setClientPhone}
                        />
                      </View>
                    )}

                    {/* Message Preview & Edit */}
                    <Txt v="caption" color="muted" style={{ marginBottom: 4 }}>
                      संदेश का पूर्वावलोकन (Preview / Edit):
                    </Txt>
                    <TextInput
                      multiline
                      numberOfLines={6}
                      style={{
                        backgroundColor: c.surface2,
                        borderRadius: 12,
                        padding: 12,
                        color: c.fg,
                        marginBottom: 16,
                        minHeight: 120,
                        textAlignVertical: 'top',
                        fontSize: 13,
                        lineHeight: 18,
                      }}
                      value={waMessage}
                      onChangeText={setWaMessage}
                    />

                    {/* Action Buttons: Copy & Send on WhatsApp */}
                    <Row style={{ gap: 10, marginBottom: 10 }}>
                      <Button
                        style={{ flex: 1 }}
                        variant="secondary"
                        size="lg"
                        title={copied ? 'Copied!' : 'Copy Text'}
                        icon={copied ? <Check size={16} color="#059669" /> : <Copy size={16} color={c.fg} />}
                        onPress={handleCopyWa}
                      />
                      <Button
                        style={{ flex: 1.4, backgroundColor: '#25D366' }}
                        size="lg"
                        title="Send on WhatsApp"
                        icon={<MessageCircle size={18} color="#fff" />}
                        onPress={handleSendWa}
                      />
                    </Row>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}
