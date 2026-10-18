import { floorLabel, inventoryTitle, inventoryPrice, readableValue } from '@brokeriq/shared';
import { Image } from 'expo-image';
import { View, Pressable, Linking, Share } from 'react-native';
import { router } from 'expo-router';
import { Building2, Phone, Share2, ChevronRight, BedDouble, Layers3, Ruler, CheckCircle2 } from 'lucide-react-native';
import { formatINR, type LedgerItem } from '@brokeriq/shared';
import { useTheme } from '@/lib/theme';
import { Txt } from '@/ui';
import { toast } from '@/lib/toast';
import { errorMessage } from '@/lib/api';
import { NativeCard } from './screen';
export function propertyShare(item: LedgerItem) {
  const parts = [
    `Property ${item.houseNo || ''}${item.unitLabel ? ` · ${item.unitLabel}` : ''}`,
    item.sector || 'Locality not recorded',
    item.purpose || 'Purpose not recorded',
    item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : '',
    item.floor ? `Floor: ${item.floor}` : '',
    item.furnishing?.replace(/_/g, ' ') || '',
    inventoryPrice(item),
    item.area ? `${item.area} ${item.areaUnit}` : '',
    item.availability === 'AVAILABLE' ? 'Availability confirmed' : 'Please confirm availability before arranging a visit.',
  ];
  return parts.filter(Boolean).join('\n');
}
export function PropertyCard({ item, selected, onSelect }: { item: LedgerItem; selected?: boolean; onSelect?: () => void }) {
  const { c } = useTheme();
  const phone = item.contacts?.find((contact) => contact.phone)?.phone ?? item.ownerPhone;
  return (
    <NativeCard style={{ borderColor: selected ? c.brand : c.line }}>
      <Pressable
        accessibilityLabel={`Property ${item.houseNo ?? item.id}`}
        onLongPress={onSelect}
        onPress={() => (onSelect && selected !== undefined ? onSelect() : router.push(`/inventory/${item.id}` as any))}
        style={{ gap: 14 }}
      >
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.brandSoft }}>
            <Building2 size={20} color={c.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="title" style={{ fontSize: 19, lineHeight: 26 }}>
              {inventoryTitle(item)}
            </Txt>
            <Txt v="small" color="muted" style={{ marginTop: 3 }}>
              {item.sector || 'Locality unknown'}
            </Txt>
          </View>
          <ChevronRight size={17} color={c.muted} />
        </View>
        {!!item.photoUrls?.[0] && (
          <Image
            source={{ uri: item.photoUrls[0] }}
            contentFit="cover"
            style={{ width: '100%', aspectRatio: 1.9, borderRadius: 15 }}
            accessibilityLabel="Property photograph"
          />
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            { Icon: BedDouble, value: item.bhk ? `${item.bhk} ${item.roomKind || 'rooms'}` : item.roomKind === 'STUDIO' ? 'Studio' : 'Rooms unknown' },
            { Icon: Layers3, value: floorLabel(item.floor) },
            { Icon: Ruler, value: item.area != null ? `${item.area} ${item.areaUnit?.replace(/_/g, ' ').toLowerCase() ?? ''}` : 'Area not recorded' },
          ].map(({ Icon, value }, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                gap: 5,
                alignItems: 'center',
                backgroundColor: c.surface2,
                paddingHorizontal: 9,
                paddingVertical: 8,
                borderRadius: 10,
              }}
            >
              <Icon size={13} color={c.muted} />
              <Txt v="caption">{value}</Txt>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Txt v="caption" color="brand">
            {item.purpose ? readableValue(item.purpose) : 'Purpose unknown'}
          </Txt>
          {!!item.furnishing && (
            <Txt v="caption" color="muted">
              · {readableValue(item.furnishing)}
            </Txt>
          )}
          {!!item.details?.projectName && (
            <Txt v="caption" color="muted">
              · {String(item.details.projectName)}
            </Txt>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt v="h3" style={{ flex: 1, fontSize: 21 }}>
            {inventoryPrice(item)}
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
        {item.verificationStatus === 'VERIFIED' && <CheckCircle2 size={16} color={c.success} accessibilityLabel="Source reviewed" />}
        {phone && (
          <Pressable
            accessibilityLabel="Call contact"
            onPress={() => Linking.openURL(`tel:${phone}`).catch((error) => toast.error(errorMessage(error)))}
            style={{ padding: 11, borderRadius: 10, backgroundColor: c.surface2 }}
          >
            <Phone size={18} color={c.fg} />
          </Pressable>
        )}
        <Pressable
          accessibilityLabel="Share property"
          onPress={() => Share.share({ message: propertyShare(item) }).catch((error) => toast.error(errorMessage(error)))}
          style={{ padding: 11, borderRadius: 10, backgroundColor: c.brandSoft }}
        >
          <Share2 size={18} color={c.brand} />
        </Pressable>
      </View>
    </NativeCard>
  );
}
