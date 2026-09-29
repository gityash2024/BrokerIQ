import { View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { BadgeCheck, BedDouble, Heart, Images, MapPin, Maximize2, Sparkles } from 'lucide-react-native';
import { FURNISHING_LABELS, PROPERTY_TYPE_LABELS, firstMonthCost, formatPriceShort, responseBadge, type Furnishing, type PropertyType } from '@brokeriq/shared';
import { api, img } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { fonts, palette, useTheme } from '@/lib/theme';
import { PressableScale, Row, Txt } from '@/ui';

export interface ListingCardData {
  id: string;
  slug: string;
  title: string;
  purpose: 'SALE' | 'RENT';
  propertyType: string;
  price: number;
  bedrooms?: number | null;
  superArea?: number | null;
  builtUpArea?: number | null;
  carpetArea?: number | null;
  plotArea?: number | null;
  furnishing?: string | null;
  societyName?: string | null;
  coverUrl?: string | null;
  isVerified?: boolean;
  isFeatured?: boolean;
  postedByType?: string;
  locality?: { name: string; slug: string } | null;
  organization?: { name: string; logoUrl?: string | null; responseMinutes?: number | null } | null;
  securityDeposit?: number | null;
  maintenance?: number | null;
  brokerageType?: string | null;
  brokerageAmount?: number | null;
  coBroking?: boolean;
  _count?: { media: number };
}

export const areaOf = (l: ListingCardData) => l.superArea ?? l.builtUpArea ?? l.carpetArea ?? l.plotArea;

export function useSavedIds() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['saved-ids'], queryFn: () => api<string[]>('/listings/saved/ids'), enabled: !!user, staleTime: 60_000 });
}

export function SaveButton({ id, size = 20, light }: { id: string; size?: number; light?: boolean }) {
  const { user } = useAuth();
  const { c } = useTheme();
  const qc = useQueryClient();
  const saved = useSavedIds().data?.includes(id) ?? false;
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const toggle = async () => {
    if (!user) return router.push('/login');
    s.value = withSequence(withSpring(1.35), withSpring(1));
    qc.setQueryData<string[]>(['saved-ids'], (o = []) => (saved ? o.filter((x) => x !== id) : [...o, id]));
    try {
      await api(`/listings/${id}/save`, { method: saved ? 'DELETE' : 'POST', body: saved ? undefined : {} });
      qc.invalidateQueries({ queryKey: ['saved'] });
    } catch (e) {
      qc.invalidateQueries({ queryKey: ['saved-ids'] });
      showError(e);
    }
  };
  return (
    <PressableScale onPress={toggle} style={{ width: size + 18, height: size + 18, borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: light ? 'rgba(255,255,255,0.9)' : c.surface2 }}>
      <Animated.View style={a}>
        <Heart size={size} color={saved ? palette.rose : light ? '#0F172A' : c.muted} fill={saved ? palette.rose : 'transparent'} />
      </Animated.View>
    </PressableScale>
  );
}

export function ListingCard({ l, width }: { l: ListingCardData; width?: number }) {
  const { c } = useTheme();
  const area = areaOf(l);
  return (
    <PressableScale onPress={() => router.push(`/property/${l.slug}`)} style={{ width, backgroundColor: c.surface, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: c.line }}>
      <View style={{ aspectRatio: 4 / 3, backgroundColor: c.surface2 }}>
        {l.coverUrl && <Image source={{ uri: img(l.coverUrl, 800) }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={250} />}
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.55)']} style={{ position: 'absolute', inset: 0 } as any} />
        <Row style={{ position: 'absolute', top: 10, left: 10 }} gap={6}>
          {l.isFeatured && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: palette.saffron[400], borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Sparkles size={11} color="#111" />
              <Txt v="caption" color="#111" style={{ fontFamily: fonts.bold }}>Featured</Txt>
            </View>
          )}
          {l.isVerified && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(16,185,129,0.95)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
              <BadgeCheck size={11} color="#fff" />
              <Txt v="caption" color="white" style={{ fontFamily: fonts.bold }}>Verified</Txt>
            </View>
          )}
        </Row>
        <View style={{ position: 'absolute', top: 8, right: 8 }}>
          <SaveButton id={l.id} light size={18} />
        </View>
        <View style={{ position: 'absolute', bottom: 10, left: 12, right: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Txt v="h2" color="white">
            {formatPriceShort(l.price)}
            {l.purpose === 'RENT' && <Txt v="small" color="rgba(255,255,255,0.8)">/mo</Txt>}
          </Txt>
          {!!l._count?.media && (
            <Row gap={3} style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Images size={12} color="#fff" />
              <Txt v="caption" color="white">{l._count.media}</Txt>
            </Row>
          )}
        </View>
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <Txt v="title" numberOfLines={1}>{l.title}</Txt>
        <Row gap={4}>
          <MapPin size={13} color={c.subtle} />
          <Txt v="small" color="muted" numberOfLines={1} style={{ flex: 1 }}>{[l.societyName, l.locality?.name].filter(Boolean).join(', ')}</Txt>
        </Row>
        <Row gap={12} style={{ marginTop: 4 }}>
          {l.bedrooms != null && (
            <Row gap={4}>
              <BedDouble size={14} color={c.muted} />
              <Txt v="caption" color="muted">{l.bedrooms} BHK</Txt>
            </Row>
          )}
          {!!area && (
            <Row gap={4}>
              <Maximize2 size={13} color={c.muted} />
              <Txt v="caption" color="muted">{Math.round(area).toLocaleString('en-IN')} sqft</Txt>
            </Row>
          )}
          <Txt v="caption" color="subtle" numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>{l.furnishing ? FURNISHING_LABELS[l.furnishing as Furnishing] : PROPERTY_TYPE_LABELS[l.propertyType as PropertyType]}</Txt>
        </Row>
        {l.purpose === 'RENT' && (!!l.securityDeposit || (!!l.brokerageType && l.brokerageType !== 'NONE')) && (
          <Txt v="caption" color="muted" numberOfLines={1}>{`पहले महीने का कुल ~${formatPriceShort(firstMonthCost(l))}`}</Txt>
        )}
        {!!responseBadge(l.organization?.responseMinutes) && <Txt v="caption" color={c.success} numberOfLines={1}>{`⚡ ${responseBadge(l.organization?.responseMinutes)}`}</Txt>}
      </View>
    </PressableScale>
  );
}

/** Compact horizontal row card (lists, matches, saved). */
export function ListingRow({ l, right, onPress }: { l: ListingCardData; right?: React.ReactNode; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onPress ?? (() => router.push(`/property/${l.slug}`))} style={{ flexDirection: 'row', gap: 12, padding: 10, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line }}>
      <View style={{ width: 92, height: 92, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surface2 }}>
        {l.coverUrl && <Image source={{ uri: img(l.coverUrl, 300) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
      </View>
      <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
        <Txt v="h3" color="brand">{formatPriceShort(l.price)}{l.purpose === 'RENT' ? '/mo' : ''}</Txt>
        <Txt v="bodyStrong" numberOfLines={1}>{l.title}</Txt>
        <Txt v="small" color="muted" numberOfLines={1}>{l.locality?.name}{l.bedrooms != null ? ` · ${l.bedrooms} BHK` : ''}{areaOf(l) ? ` · ${Math.round(areaOf(l)!)} sqft` : ''}</Txt>
      </View>
      {right}
    </PressableScale>
  );
}
