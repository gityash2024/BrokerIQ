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

