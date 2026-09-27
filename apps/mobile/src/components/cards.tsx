import { View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, Building2, MapPin, Star, TrendingUp } from 'lucide-react-native';
import { POSSESSION_LABELS, formatPriceShort } from '@brokeriq/shared';
import { img } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Avatar, Badge, PressableScale, Row, Txt } from '@/ui';

const GRADS: [string, string][] = [
  ['#4F46E5', '#7C3AED'],
  ['#0EA5E9', '#4F46E5'],
  ['#F59E0B', '#EA580C'],
  ['#10B981', '#0EA5E9'],
  ['#E11D48', '#7C3AED'],
];

export function LocalityCard({ l, index = 0 }: { l: any; index?: number }) {
  const g = GRADS[index % GRADS.length];
  return (
    <PressableScale onPress={() => router.push(`/locality/${l.slug}`)} style={{ width: 168, height: 200, borderRadius: 22, overflow: 'hidden' }}>
      {l.coverUrl ? <Image source={{ uri: img(l.coverUrl, 400) }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : <LinearGradient colors={g} style={{ position: 'absolute', inset: 0 } as any} />}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={{ position: 'absolute', inset: 0 } as any} />
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: 14, gap: 2 }}>
        {!!l.zone && <Txt v="caption" color="rgba(255,255,255,0.75)" numberOfLines={1}>{l.zone}</Txt>}
        <Txt v="h3" color="white" numberOfLines={1}>{l.name}</Txt>
        {!!l.avgPsf && (
          <Row gap={4}>
            <TrendingUp size={12} color="#6EE7B7" />
            <Txt v="caption" color="#D1FAE5">₹{Math.round(l.avgPsf).toLocaleString('en-IN')}/sqft</Txt>
          </Row>
        )}
        <Txt v="caption" color="rgba(255,255,255,0.8)">{(l.listingsSale ?? 0) + (l.listingsRent ?? 0)} listings</Txt>
      </View>
    </PressableScale>
  );
}

export function ProjectCard({ p, width = 260 }: { p: any; width?: number }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={() => router.push(`/project/${p.slug}`)} style={{ width, backgroundColor: c.surface, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: c.line }}>
      <View style={{ aspectRatio: 16 / 10, backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center' }}>
        {p.photos?.[0] ? <Image source={{ uri: img(p.photos[0], 600) }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : <Building2 size={40} color="rgba(255,255,255,0.3)" />}
        <Row gap={6} style={{ position: 'absolute', top: 10, left: 10 }}>
          {!!p.reraNumber && <Badge label="RERA" solid color="rgba(15,23,42,0.75)" />}
          {!!p.possession && <Badge label={POSSESSION_LABELS[p.possession as keyof typeof POSSESSION_LABELS]} solid color="rgba(15,23,42,0.75)" />}
        </Row>
      </View>
      <View style={{ padding: 12, gap: 2 }}>
        <Txt v="h3" numberOfLines={1}>{p.name}</Txt>
        <Txt v="small" color="muted" numberOfLines={1}>by {p.builder?.name}</Txt>
        <Row gap={4}>
          <MapPin size={12} color={c.subtle} />
          <Txt v="caption" color="muted">{p.locality?.name}</Txt>
        </Row>
        {!!(p.minPrice || p.maxPrice) && <Txt v="title" color="brand" style={{ marginTop: 4 }}>{formatPriceShort(p.minPrice)}{p.maxPrice && p.maxPrice !== p.minPrice ? ` – ${formatPriceShort(p.maxPrice)}` : ''}</Txt>}
      </View>
    </PressableScale>
  );
}

export function BrokerCard({ b }: { b: any }) {
  const { c } = useTheme();
  const listings = b._count?.listings ?? b.listingsCount ?? 0;
  return (
    <PressableScale onPress={() => router.push(`/broker/${b.slug}`)} style={{ width: 150, alignItems: 'center', padding: 14, gap: 6, backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.line }}>
      <View>
        <Avatar name={b.name} uri={b.logoUrl} size={58} />
        {b.verification === 'VERIFIED' && (
          <View style={{ position: 'absolute', right: -4, bottom: -4, backgroundColor: c.surface, borderRadius: 12 }}>
            <BadgeCheck size={22} color={c.success} />
          </View>
        )}
      </View>
      <Txt v="bodyStrong" numberOfLines={1}>{b.name}</Txt>
      <Row gap={3}>
        <Star size={12} color="#F59E0B" fill={b.reviewCount ? '#F59E0B' : 'transparent'} />
        <Txt v="caption" color="muted">{b.reviewCount ? `${Number(b.rating).toFixed(1)} (${b.reviewCount})` : 'New'}</Txt>
      </Row>
      <Txt v="caption" color="brand">{listings} listings</Txt>
    </PressableScale>
  );
}
