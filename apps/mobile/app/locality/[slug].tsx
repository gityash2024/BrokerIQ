import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Home, KeyRound, MapPin, Sparkles, TrendingUp } from 'lucide-react-native';
import { formatPriceShort } from '@brokeriq/shared';
import { api, img, qs } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { BrokerCard, ProjectCard } from '@/components/cards';
import { ListingCard } from '@/components/listing';
import { MapView } from '@/components/map';
import { Button, Card, Chip, ErrorView, IconBtn, Loader, Row, SectionTitle, Stat, Txt } from '@/ui';

export default function Locality() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['locality', slug], queryFn: () => api<any>(`/public/localities/${slug}`, { auth: false }) });
  const listings = useQuery({ queryKey: ['locality-listings', slug], queryFn: () => api<any>(`/listings${qs({ localities: slug, pageSize: 8 })}`, { auth: false }) });
  if (q.isLoading) return <Loader />;
  if (q.isError) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ErrorView error={q.error} onRetry={() => q.refetch()} /></SafeAreaView>;
  const l = q.data;
  const trend = (l.priceTrend ?? []) as { month: string; avgPsf: number }[];
  const maxT = Math.max(1, ...trend.map((t) => t.avgPsf));
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Animated.ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 260 }}>
          {l.coverUrl ? <Image source={{ uri: img(l.coverUrl, 1000) }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : <LinearGradient colors={['#312E81', '#4F46E5', '#7C3AED']} style={{ position: 'absolute', inset: 0 } as any} />}
          <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.65)']} style={{ position: 'absolute', inset: 0 } as any} />
          <SafeAreaView edges={['top']} style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <IconBtn onPress={() => router.back()} style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}><ChevronLeft size={22} color="#0F172A" /></IconBtn>
            <Animated.View entering={FadeInDown}>
              {!!l.zone && <Txt v="small" color="rgba(255,255,255,0.8)">{l.zone}</Txt>}
              <Txt v="display" color="white">{l.name}</Txt>
              <Txt color="rgba(255,255,255,0.85)">{l.city}{l.pincode ? ` · ${l.pincode}` : ''}</Txt>
            </Animated.View>
          </SafeAreaView>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <Row gap={10}>
            <Stat label="Avg sale ₹/sqft" value={l.avgPsf ? `₹${Math.round(l.avgPsf).toLocaleString('en-IN')}` : l.avgPriceSale ? `₹${Math.round(l.avgPriceSale).toLocaleString('en-IN')}` : '—'} icon={<TrendingUp size={18} color={c.brand} />} />
            <Stat label="2BHK rent (avg)" value={l.avgRent2Bhk ? formatPriceShort(l.avgRent2Bhk) : l.rentByBhk?.find((r: any) => r.bedrooms === 2)?.avgRent ? formatPriceShort(l.rentByBhk.find((r: any) => r.bedrooms === 2).avgRent) : '—'} icon={<KeyRound size={18} color={c.accent} />} tint={c.accent} />
          </Row>
          <Row gap={10}>
            <Button title={`Buy · ${l.listingsSale}`} icon={<Home size={16} color="#fff" />} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/(user)/search', params: { purpose: 'SALE', localities: l.slug } })} />
            <Button title={`Rent · ${l.listingsRent}`} variant="secondary" icon={<KeyRound size={16} color={c.fg} />} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/(user)/search', params: { purpose: 'RENT', localities: l.slug } })} />
          </Row>
          {trend.length > 1 && (
            <Card style={{ padding: 16, gap: 10 }}>
              <Txt v="h3">Price trend (₹/sqft)</Txt>
              <Row style={{ alignItems: 'flex-end', height: 120, gap: 6 }}>
                {trend.map((t, i) => (
                  <Animated.View key={t.month} entering={FadeInDown.delay(i * 50)} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: '70%', height: Math.max(6, (t.avgPsf / maxT) * 96), borderRadius: 6, backgroundColor: i === trend.length - 1 ? c.brand : `${c.brand}66` }} />
                    <Txt v="caption" color="subtle" style={{ fontSize: 9 }}>{new Date(t.month).toLocaleDateString('en-IN', { month: 'short' })}</Txt>
                  </Animated.View>
                ))}
              </Row>
            </Card>
          )}
          {!!l.description && <Txt color="muted" style={{ lineHeight: 22 }}>{l.description}</Txt>}
          {!!l.highlights?.length && (
            <Row wrap gap={8}>{l.highlights.map((h: string) => <Chip key={h} label={h} icon={<Sparkles size={13} color={c.accent} />} />)}</Row>
          )}
          <MapView points={[{ id: l.id, lat: l.latitude, lng: l.longitude }, ...(l.nearby ?? []).filter((n: any) => n.latitude).map((n: any) => ({ id: n.slug, lat: n.latitude, lng: n.longitude }))]} center={{ lat: l.latitude, lng: l.longitude }} zoom={14} height={200} />
        </View>
        {!!listings.data?.items?.length && (
          <>
            <View style={{ paddingHorizontal: 16 }}><SectionTitle title={`${l.name} में properties`} action={<Txt v="small" color="brand" onPress={() => router.push({ pathname: '/(user)/search', params: { localities: l.slug } })}>सब देखें</Txt>} /></View>
            <FlatList horizontal data={listings.data.items} keyExtractor={(x: any) => x.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }} renderItem={({ item }) => <ListingCard l={item} width={270} />} />
          </>
        )}
        {!!l.projects?.length && (
          <>
            <View style={{ paddingHorizontal: 16 }}><SectionTitle title="Projects" /></View>
            <FlatList horizontal data={l.projects} keyExtractor={(x: any) => x.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }} renderItem={({ item }) => <ProjectCard p={item} />} />
          </>
        )}
        {!!l.brokers?.length && (
          <>
            <View style={{ paddingHorizontal: 16 }}><SectionTitle title={`${l.name} के experts`} /></View>
            <FlatList horizontal data={l.brokers} keyExtractor={(x: any) => x.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }} renderItem={({ item }) => <BrokerCard b={item} />} />
          </>
        )}
        {!!l.nearby?.length && (
          <View style={{ paddingHorizontal: 16 }}>
            <SectionTitle title="आस-पास के इलाके" />
            <Row wrap gap={8}>{l.nearby.map((n: any) => <Chip key={n.id} label={`${n.name} · ${n.km} km`} icon={<MapPin size={13} color={c.muted} />} onPress={() => router.push(`/locality/${n.slug}`)} />)}</Row>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}
