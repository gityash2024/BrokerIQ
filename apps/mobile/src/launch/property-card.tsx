import { floorLabel } from '@brokeriq/shared';
import { View, Pressable, Linking, Share } from 'react-native';
import { router } from 'expo-router';
import { Building2, Phone, Share2, ChevronRight } from 'lucide-react-native';
import { formatINR, type LedgerItem } from '@brokeriq/shared';
import { useTheme } from '@/lib/theme';
import { Txt } from '@/ui';
import { NativeCard } from './screen';
export function propertyShare(item: LedgerItem) {
  const parts = [
    `Property ${item.houseNo || ''}${item.unitLabel ? ` · ${item.unitLabel}` : ''}`,
    item.sector || 'Locality not recorded',
    item.purpose || 'Purpose not recorded',
    item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : '',
    item.floor ? `Floor: ${item.floor}` : '',
    item.furnishing?.replace(/_/g, ' ') || '',
    item.monthlyRent != null && item.purpose === 'RENT'
      ? `${formatINR(item.monthlyRent)}/month`
      : item.totalSalePrice != null
        ? formatINR(item.totalSalePrice)
        : item.ratePerArea != null
          ? `${formatINR(item.ratePerArea)}/${item.rateAreaUnit}`
          : 'Price not recorded',
    item.area ? `${item.area} ${item.areaUnit}` : '',
    item.availability === 'AVAILABLE' ? 'Availability confirmed' : 'Please confirm availability before arranging a visit.',
  ];
  return parts.filter(Boolean).join('\n');
}
export function PropertyCard({ item, selected, onSelect }: { item: LedgerItem; selected?: boolean; onSelect?: () => void }) {
  const { c } = useTheme();
  const phone = item.contacts?.find((contact) => contact.phone)?.phone ?? item.ownerPhone;
  const price = item.purpose === 'RENT' ? item.monthlyRent : item.totalSalePrice;
  return (
    <NativeCard style={{ borderColor: selected ? c.brand : c.line }}>
      <Pressable
        accessibilityLabel={`Property ${item.houseNo ?? item.id}`}
        onLongPress={onSelect}
        onPress={() => (onSelect && selected !== undefined ? onSelect() : router.push(`/inventory/${item.id}` as any))}
        style={{ gap: 8 }}
      >
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.brandSoft }}><Building2 size={20} color={c.brand} /></View>
          <View style={{ flex: 1 }}>
            <Txt v="h3">
              {item.houseNo ? `House ${item.houseNo}` : 'House not recorded'}
              {item.unitLabel ? ` · ${item.unitLabel}` : ''}
            </Txt>
            <Txt v="small" color="muted" style={{ marginTop: 3 }}>
              {item.sector || 'Locality unknown'}
            </Txt>
          </View>
          <ChevronRight size={17} color={c.muted} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Txt v="caption">{item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : 'Rooms unknown'}</Txt>
          <Txt v="caption" color="muted" style={{ backgroundColor: c.surface2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            {floorLabel(item.floor)}
          </Txt>
          <Txt v="caption" color="muted">
            {item.purpose || 'Purpose unknown'}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt v="title" style={{ flex: 1 }}>
            {price != null
              ? `${formatINR(price)}${item.purpose === 'RENT' ? '/mo' : ''}`
              : item.ratePerArea != null
                ? `${formatINR(item.ratePerArea)}/${item.rateAreaUnit}`
                : 'Price not recorded'}
          </Txt>
          <View
            style={{
              backgroundColor: item.availability === 'AVAILABLE' ? `${c.success}18` : c.surface2,
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: 8,
            }}
          >
            <Txt v="caption" color={item.availability === 'AVAILABLE' ? 'success' : 'muted'}>
              {item.availability === 'UNKNOWN' ? 'Check availability' : item.availability || 'Check availability'}
            </Txt>
          </View>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}>
        <Txt v="caption" color="muted" style={{ flex: 1 }}>
          {item.sourceType === 'PDF_REGISTER' ? 'Register' : item.sourceType?.replace(/_/g, ' ')}
          {item.pageNo ? ` · P.${item.pageNo}` : ''}
        </Txt>
        {phone && (
          <Pressable
            accessibilityLabel="Call contact"
            onPress={() => Linking.openURL(`tel:${phone}`)}
            style={{ padding: 11, borderRadius: 10, backgroundColor: c.surface2 }}
          >
            <Phone size={18} color={c.fg} />
          </Pressable>
        )}
        <Pressable
          accessibilityLabel="Share property"
          onPress={() => Share.share({ message: propertyShare(item) })}
          style={{ padding: 11, borderRadius: 10, backgroundColor: c.brandSoft }}
        >
          <Share2 size={18} color={c.brand} />
        </Pressable>
      </View>
    </NativeCard>
  );
}
