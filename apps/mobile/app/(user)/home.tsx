import { FlatList, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, BedDouble, Bell, Building2, Calculator, KeyRound, Landmark, Search, Sofa, Sparkles, Store , ClipboardList } from 'lucide-react-native';
import { api, img } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig, useFlag } from '@/lib/config';
import { useLightStatusBar } from '@/lib/hooks';
import { palette, useTheme } from '@/lib/theme';
import { BrokerCard, LocalityCard, ProjectCard } from '@/components/cards';
import { ListingCard } from '@/components/listing';
import { Button, Card, ErrorView, IconBtn, PressableScale, Row, SectionTitle, Skeleton, Txt, useStatusScrim } from '@/ui';
import { showStat } from '@brokeriq/shared';

// Rental marketplace quick filters (search is always RENT).
const QUICK = [
  { label: 'Rent', icon: KeyRound, params: { category: 'RESIDENTIAL' } },
  { label: 'Furnished', icon: Sofa, params: { category: 'RESIDENTIAL', furnishing: 'FULLY_FURNISHED' } },
  { label: 'PG', icon: BedDouble, params: { types: 'PG' } },
  { label: 'Commercial', icon: Store, params: { category: 'COMMERCIAL' } },
] as const;

function Hero({ s }: { s: any }) {
  const { app } = useConfig();
  const requirementsOn = useFlag('tenant_requirements');
  const { user } = useAuth();
  const stats = s?.data ?? {};
  const notif = useQuery({ queryKey: ['notifications'], queryFn: () => api<any>('/me/notifications'), enabled: !!user });
  return (
    <LinearGradient colors={['#1E1B4B', '#3730A3', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' }}>
      {!!s?.config?.backgroundUrl && <Image source={{ uri: img(s.config.backgroundUrl, 1000) }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.25 }} contentFit="cover" />}
      <View style={{ position: 'absolute', right: -60, top: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245,158,11,0.25)' }} />
      <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
        <Row style={{ justifyContent: 'space-between', paddingTop: 6 }}>
          <View>
            <Txt v="caption" color="rgba(255,255,255,0.7)">{user ? `नमस्ते, ${user.name.split(' ')[0]} 👋` : `${app.city} में आपका स्वागत है`}</Txt>
            <Txt v="h2" color="white">{app.siteName}</Txt>
          </View>
          <IconBtn onPress={() => router.push(user ? '/notifications' : '/login')} badge={notif.data?.unreadCount} style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <Bell size={20} color="#fff" />
          </IconBtn>
        </Row>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Txt v="display" color="white" style={{ marginTop: 22 }}>{s?.title ?? `${app.city} में अपना अगला घर ढूँढिए`}</Txt>
          {!!s?.subtitle && <Txt color="rgba(255,255,255,0.75)" style={{ marginTop: 8 }} numberOfLines={2}>{s.subtitle}</Txt>}
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(500)}>
          <PressableScale onPress={() => router.push('/(user)/search')} style={{ marginTop: 20, height: 54, borderRadius: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
            <Search size={20} color={palette.brand[600]} />
            <Txt color="#64748B" style={{ flex: 1 }}>Sector, society या project खोजें…</Txt>
            <View style={{ backgroundColor: palette.saffron[500], borderRadius: 12, padding: 8 }}>
              <ArrowRight size={16} color="#111" />
            </View>
          </PressableScale>
        </Animated.View>
        <Row style={{ marginTop: 18, justifyContent: 'space-between' }}>
          {QUICK.map((q, i) => (
            <Animated.View key={q.label} entering={FadeInDown.delay(200 + i * 60)}>
              <PressableScale onPress={() => router.push({ pathname: '/(user)/search', params: q.params })} style={{ alignItems: 'center', gap: 6, width: 72 }}>
                <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                  <q.icon size={22} color="#fff" />
                </View>
                <Txt v="caption" color="white" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{q.label}</Txt>
              </PressableScale>
            </Animated.View>
          ))}
        </Row>
        {requirementsOn && (
        <PressableScale onPress={() => router.push(user ? '/requirements' : '/login')} style={{ marginTop: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
          <ClipboardList size={16} color="#fff" />
          <Txt v="small" color="white">अपनी ज़रूरत बताएँ — मिलती property पर alert</Txt>
        </PressableScale>
        )}
        {[stats.listings, stats.localities, stats.brokers].some(showStat) && (
          <Row gap={20} wrap style={{ marginTop: 20, rowGap: 10, alignItems: 'flex-start' }}>
            {[
              [stats.listings, 'Live properties'],
              [stats.localities, 'Localities'],
              [stats.brokers, 'Verified brokers'],
            ]
              .filter(([n]) => showStat(n))
              .map(([n, l]) => (
                <View key={l as string} style={{ maxWidth: 160 }}>
                  <Txt v="h2" color="white">{Number(n).toLocaleString('en-IN')}+</Txt>
                  <Txt v="caption" color="rgba(255,255,255,0.6)" numberOfLines={2}>{l}</Txt>
                </View>
              ))}
          </Row>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function HScroll<T>({ data, render, keyOf }: { data: T[]; render: (x: T, i: number) => React.ReactElement; keyOf: (x: T) => string }) {
  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={keyOf}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
      renderItem={({ item, index }) => <Animated.View entering={FadeInRight.delay(Math.min(index, 6) * 60)}>{render(item, index)}</Animated.View>}
    />
  );
}

function Section({ s }: { s: any }) {
  const { c } = useTheme();
  const { user, isBroker } = useAuth();
  const { app } = useConfig();
  const items = (s.data ?? []) as any[];
  const T = ({ action }: { action?: React.ReactNode }) => (
    <View style={{ paddingHorizontal: 16 }}>
      <SectionTitle title={s.title} subtitle={s.subtitle} action={action} />
    </View>
  );
  switch (s.type) {
    case 'LOCALITIES':
      return items.length ? (
        <>
          <T />
          <HScroll data={items} keyOf={(x) => x.id} render={(l, i) => <LocalityCard l={l} index={i} />} />
        </>
      ) : null;
    case 'FEATURED_LISTINGS':
      return items.length ? (
        <>
          <T action={<Txt v="small" color="brand" onPress={() => router.push('/(user)/search')}>सब देखें</Txt>} />
          <HScroll data={items} keyOf={(x) => x.id} render={(l) => <ListingCard l={l} width={290} />} />
        </>
      ) : null;
    case 'FEATURED_PROJECTS':
      return items.length ? (
        <>
          <T />
          <HScroll data={items} keyOf={(x) => x.id} render={(p) => <ProjectCard p={p} />} />
        </>
      ) : null;
    case 'TOP_BROKERS':
      return items.length ? (
        <>
          <T />
          <HScroll data={items} keyOf={(x) => x.id} render={(b) => <BrokerCard b={b} />} />
        </>
      ) : null;
    case 'TOOLS':
      return (
        <View style={{ paddingHorizontal: 16 }}>
          <SectionTitle title={s.title} subtitle={s.subtitle} />
          <Row gap={12}>
            {[
              { label: 'Rent budget', icon: Sparkles, tint: c.success, tab: 'rent' },
              { label: 'Move-in cost', icon: Calculator, tint: c.brand, tab: 'movein' },
              { label: 'Rent split', icon: Landmark, tint: c.accent, tab: 'split' },
            ].map((t) => (
              <Card key={t.label} onPress={() => router.push({ pathname: '/tools', params: { tab: t.tab } })} style={{ flex: 1, padding: 14, gap: 8, alignItems: 'flex-start' }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${t.tint}22`, alignItems: 'center', justifyContent: 'center' }}>
                  <t.icon size={20} color={t.tint} />
                </View>
                <Txt v="bodyStrong" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t.label}</Txt>
              </Card>
            ))}
          </Row>
        </View>
      );
    case 'CTA_BANNER':
      return (
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <LinearGradient colors={['#F59E0B', '#EA580C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 20, gap: 8 }}>
            <Building2 size={28} color="#fff" />
            <Txt v="h2" color="white">{s.title}</Txt>
            {!!s.subtitle && <Txt color="rgba(255,255,255,0.9)">{s.subtitle}</Txt>}
            <Button title={s.config?.ctaLabel ?? 'Get started'} variant="dark" size="sm" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => router.push(!user ? '/login' : isBroker ? '/(broker)/dashboard' : '/broker-onboarding')} />
          </LinearGradient>
        </View>
      );
    case 'BANNER':
      return s.config?.imageUrl ? (
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <PressableScale onPress={() => s.config.link && Linking.openURL(String(s.config.link).startsWith('http') ? s.config.link : `${app.siteUrl}${s.config.link}`)} style={{ borderRadius: 22, overflow: 'hidden' }}>
            <Image source={{ uri: img(s.config.imageUrl, 1000) }} style={{ width: '100%', aspectRatio: 2 }} contentFit="cover" />
            {!!s.config.sponsor && (
              <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Txt v="caption" color="white">Sponsored · {s.config.sponsor}</Txt>
              </View>
            )}
          </PressableScale>
        </View>
      ) : null;
    case 'WHY_US':
      return (s.config?.items ?? []).length ? (
        <View style={{ paddingHorizontal: 16 }}>
          <SectionTitle title={s.title} subtitle={s.subtitle} />
          <View style={{ gap: 10 }}>
            {(s.config.items as any[]).map((it, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(i * 60)}>
                <Card style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={20} color={c.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong">{it.title}</Txt>
                    <Txt v="small" color="muted">{it.text}</Txt>
                  </View>
                </Card>
              </Animated.View>
            ))}
          </View>
        </View>
      ) : null;
    default:
      return null;
  }
}

export default function HomeScreen() {
  useLightStatusBar();
  const scrim = useStatusScrim();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['homepage'], queryFn: () => api<any[]>('/public/homepage', { auth: false }) });
  const sections = q.data ?? [];
  const hero = sections.find((s) => s.type === 'HERO');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Animated.ScrollView onScroll={scrim.onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Hero s={hero} />
        {q.isError && <ErrorView error={q.error} onRetry={() => q.refetch()} />}
        {q.isLoading && (
          <View style={{ padding: 16, gap: 12 }}>
            <Skeleton h={24} w="50%" />
            <Row gap={12}>
              <Skeleton h={200} w={168} r={22} />
              <Skeleton h={200} w={168} r={22} />
            </Row>
            <Skeleton h={260} r={22} />
          </View>
        )}
        {sections.filter((s) => s.type !== 'HERO').map((s) => <Section key={s.id} s={s} />)}
      </Animated.ScrollView>
      {scrim.view}
    </View>
  );
}
