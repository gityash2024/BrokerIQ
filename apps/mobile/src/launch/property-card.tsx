import { floorLabel, inventoryTitle, inventoryPrice, readableValue, formatINR, type LedgerItem } from '@brokeriq/shared';
import { Image } from 'expo-image';
import { View, Pressable, Linking, Share } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Phone,
  Share2,
  ChevronRight,
  BedDouble,
  Layers3,
  Ruler,
  CheckCircle2,
  User,
  Flame,
  AlertTriangle,
  MessageCircle,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { Txt } from '@/ui';
import { toast } from '@/lib/toast';
import { api, errorMessage } from '@/lib/api';
import { NativeCard } from './screen';

export function propertyShare(item: LedgerItem) {
  const parts = [
    `🏠 ${inventoryTitle(item)}`,
    item.sector ? `📍 Location: ${item.sector}` : '',
    item.purpose ? `🏷️ Transaction: ${readableValue(item.purpose)}` : '',
    item.bhk ? `🛏️ Config: ${item.bhk} ${item.roomKind || 'BHK'}` : '',
    item.floor ? `🏢 Floor: ${floorLabel(item.floor)}` : '',
    item.area ? `📐 Area: ${item.area} ${item.areaUnit || 'SQ_FT'}` : '',
    item.furnishing ? `🛋️ Furnishing: ${readableValue(item.furnishing)}` : '',
    `💰 Price: ${inventoryPrice(item)}`,
    item.assignedTo?.name ? `👤 Managed by: ${item.assignedTo.name}` : '',
    item.availability === 'AVAILABLE' ? '✅ Verified Available' : '⚠️ Availability to be confirmed',
  ];
  return parts.filter(Boolean).join('\n');
}

export function PropertyCard({
  item,
  selected,
  onSelect,
}: {
  item: LedgerItem;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const phone = item.contacts?.find((contact) => contact.phone)?.phone ?? item.ownerPhone;

  // Check if inventory is stale (>7 days since update/verification)
  const isStale = (() => {
    if (item.availability !== 'AVAILABLE') return false;
    const dateToCheck = item.updatedAt ? new Date(item.updatedAt) : new Date(item.createdAt);
    const diffDays = (Date.now() - dateToCheck.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  })();

  async function quickConfirmAvailable() {
    try {
      await api(`/inventory/${item.id}`, {
        method: 'PATCH',
        body: { availability: 'AVAILABLE', expectedRevision: item.revision },
      });
      await qc.invalidateQueries({ queryKey: ['ledger'] });
      await qc.invalidateQueries({ queryKey: ['ledger-stats'] });
      toast.success('Availability confirmed');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';

  return (
    <NativeCard
      style={{
        borderColor: selected ? c.brand : `${c.line}90`,
        borderRadius: 20,
        backgroundColor: c.surface,
        padding: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <Pressable
        accessibilityLabel={`Property ${item.houseNo ?? item.id}`}
        onLongPress={onSelect}
        onPress={() => (onSelect && selected !== undefined ? onSelect() : router.push(`/inventory/${item.id}` as any))}
        style={{ gap: 12 }}
      >
        {/* Top Header: Purpose & Sector Kicker + Availability Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
            <View
              style={{
                backgroundColor: item.purpose === 'RENT' ? `${c.brand}20` : '#F59E0B20',
                paddingHorizontal: 8,
                paddingVertical: 3.5,
                borderRadius: 7,
              }}
            >
              <Txt
                v="caption"
                style={{
                  color: item.purpose === 'RENT' ? c.brand : '#F59E0B',
                  fontWeight: '700',
                  fontSize: 10,
                  letterSpacing: 0.5,
                }}
              >
                {item.purpose || 'PROPERTY'}
              </Txt>
            </View>
            <Txt
              v="caption"
              color="muted"
              numberOfLines={1}
              style={{ flex: 1, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 }}
            >
              {item.sector || 'Locality not recorded'}
            </Txt>
          </View>

          {/* Availability Pill */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4.5,
              backgroundColor:
                item.availability === 'AVAILABLE'
                  ? `${c.success}18`
                  : item.availability === 'RENTED' || item.availability === 'SOLD'
                    ? '#EF444418'
                    : `${c.line}60`,
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: 20,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  item.availability === 'AVAILABLE'
                    ? c.success
                    : item.availability === 'RENTED' || item.availability === 'SOLD'
                      ? '#EF4444'
                      : '#F59E0B',
              }}
            />
            <Txt
              v="caption"
              style={{
                color:
                  item.availability === 'AVAILABLE'
                    ? c.success
                    : item.availability === 'RENTED' || item.availability === 'SOLD'
                      ? '#EF4444'
                      : c.muted,
                fontWeight: '700',
                fontSize: 11,
              }}
            >
              {item.availability === 'AVAILABLE'
                ? 'Available'
                : item.availability === 'RENTED'
                  ? 'Rented'
                  : item.availability === 'SOLD'
                    ? 'Sold'
                    : 'Check Avail.'}
            </Txt>
          </View>
        </View>

        {/* Pricing Typography & Title */}
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Txt
              v="h2"
              style={{
                fontSize: 24,
                lineHeight: 30,
                fontWeight: '800',
                letterSpacing: -0.5,
                color: c.fg,
              }}
            >
              {item.purpose === 'RENT' && item.monthlyRent != null
                ? formatINR(item.monthlyRent)
                : item.totalSalePrice != null
                  ? formatINR(item.totalSalePrice)
                  : item.ratePerArea != null
                    ? `${formatINR(item.ratePerArea)}/${item.rateAreaUnit || 'sq.ft'}`
                    : inventoryPrice(item)}
            </Txt>
            {item.purpose === 'RENT' && item.monthlyRent != null && (
              <Txt v="caption" color="muted" style={{ fontWeight: '600' }}>
                / month
              </Txt>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <Txt
              v="body"
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: c.fg,
                flex: 1,
              }}
            >
              {inventoryTitle(item)}
            </Txt>
            <ChevronRight size={16} color={c.muted} />
          </View>
        </View>

        {/* Lead Matches & Stale Inventory Alerts */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {item.matchingLeadsCount != null && item.matchingLeadsCount > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#FF6B0018',
                borderWidth: 1,
                borderColor: '#FF6B0035',
                paddingHorizontal: 9,
                paddingVertical: 4.5,
                borderRadius: 20,
              }}
            >
              <Flame size={13} color="#FF6B00" />
              <Txt v="caption" style={{ color: '#FF6B00', fontWeight: '800', fontSize: 11 }}>
                {item.matchingLeadsCount} Leads Match
              </Txt>
            </View>
          )}

          {isStale && (
            <Pressable
              onPress={quickConfirmAvailable}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#F59E0B18',
                borderWidth: 1,
                borderColor: '#F59E0B35',
                paddingHorizontal: 9,
                paddingVertical: 4.5,
                borderRadius: 20,
              }}
            >
              <Clock size={12} color="#F59E0B" />
              <Txt v="caption" style={{ color: '#F59E0B', fontWeight: '700', fontSize: 11 }}>
                Unverified &gt;7d · Tap to Confirm
              </Txt>
            </Pressable>
          )}
        </View>

        {/* Property Photo (if available) */}
        {!!item.photoUrls?.[0] && (
          <Image
            source={{ uri: item.photoUrls[0] }}
            contentFit="cover"
            style={{ width: '100%', aspectRatio: 2.1, borderRadius: 14 }}
            accessibilityLabel="Property photograph"
          />
        )}

        {/* Micro Spec Chips (CRED layout) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[
            {
              Icon: BedDouble,
              label: item.bhk ? `${item.bhk} ${item.roomKind || 'BHK'}` : item.roomKind === 'STUDIO' ? 'Studio' : null,
            },
            {
              Icon: Layers3,
              label: floorLabel(item.floor),
            },
            {
              Icon: Ruler,
              label: item.area != null ? `${item.area} ${item.areaUnit?.replace(/_/g, ' ').toLowerCase() ?? 'sq.ft'}` : null,
            },
          ]
            .filter((s) => Boolean(s.label))
            .map(({ Icon, label }, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  gap: 5,
                  alignItems: 'center',
                  backgroundColor: c.surface2,
                  paddingHorizontal: 9,
                  paddingVertical: 6,
                  borderRadius: 9,
                }}
              >
                <Icon size={12} color={c.muted} />
                <Txt v="caption" style={{ fontSize: 11.5, fontWeight: '600' }}>
                  {label}
                </Txt>
              </View>
            ))}

          {!!item.furnishing && (
            <View
              style={{
                backgroundColor: c.surface2,
                paddingHorizontal: 9,
                paddingVertical: 6,
                borderRadius: 9,
              }}
            >
              <Txt v="caption" color="muted" style={{ fontSize: 11.5, fontWeight: '500' }}>
                {readableValue(item.furnishing)}
              </Txt>
            </View>
          )}
        </View>

        {/* Assignee Capsule */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: `${c.brand}0D`,
            borderWidth: 1,
            borderColor: `${c.brand}22`,
            paddingHorizontal: 9,
            paddingVertical: 5,
            borderRadius: 10,
            alignSelf: 'flex-start',
          }}
        >
          <User size={12} color={c.brand} />
          <Txt v="caption" style={{ fontSize: 11, fontWeight: '600', color: c.brand }}>
            Assignee: {item.assignedTo?.name || 'Assigned to You'}
          </Txt>
          {item.assignedTo?.role && (
            <Txt v="caption" color="muted" style={{ fontSize: 10 }}>
              ({item.assignedTo.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'})
            </Txt>
          )}
        </View>
      </Pressable>

      {/* Floating 1-Tap Quick Action Bar */}
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: `${c.line}70`,
          paddingTop: 10,
        }}
      >
        <Txt v="caption" color="muted" numberOfLines={1} style={{ flex: 1, fontSize: 11 }}>
          {item.sourceType === 'PDF_REGISTER' ? 'Register' : readableValue(item.sourceType)}
          {item.pageNo ? ` · P.${item.pageNo}` : ''}
        </Txt>

        {item.verificationStatus === 'VERIFIED' && (
          <CheckCircle2 size={16} color={c.success} accessibilityLabel="Source reviewed" />
        )}

        {/* 1-Tap Call Owner */}
        {phone && (
          <Pressable
            accessibilityLabel="Call contact"
            onPress={() => Linking.openURL(`tel:${phone}`).catch((error) => toast.error(errorMessage(error)))}
            style={{
              padding: 9,
              borderRadius: 10,
              backgroundColor: c.surface2,
              borderWidth: 1,
              borderColor: `${c.line}60`,
            }}
          >
            <Phone size={16} color={c.fg} />
          </Pressable>
        )}

        {/* 1-Tap WhatsApp Share */}
        {cleanPhone ? (
          <Pressable
            accessibilityLabel="WhatsApp contact"
            onPress={() =>
              Linking.openURL(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(propertyShare(item))}`).catch(
                (error) => toast.error(errorMessage(error)),
              )
            }
            style={{
              padding: 9,
              borderRadius: 10,
              backgroundColor: '#25D36618',
              borderWidth: 1,
              borderColor: '#25D36635',
            }}
          >
            <MessageCircle size={16} color="#25D366" />
          </Pressable>
        ) : null}

        {/* Standard Share */}
        <Pressable
          accessibilityLabel="Share property"
          onPress={() => Share.share({ message: propertyShare(item) }).catch((error) => toast.error(errorMessage(error)))}
          style={{
            padding: 9,
            borderRadius: 10,
            backgroundColor: `${c.brand}18`,
            borderWidth: 1,
            borderColor: `${c.brand}35`,
          }}
        >
          <Share2 size={16} color={c.brand} />
        </Pressable>
      </View>
    </NativeCard>
  );
}
