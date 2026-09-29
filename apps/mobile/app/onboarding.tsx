import { useRef, useState } from 'react';
import { Dimensions, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useLightStatusBar } from '@/lib/hooks';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, ZoomIn, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BellRing, Building2, MessageCircle, Search, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useConfig } from '@/lib/config';
import { palette } from '@/lib/theme';
import { Button, Txt } from '@/ui';
import { LanguagePill } from '@/components/language';

const { width } = Dimensions.get('window');

const SLIDES = [
  { icon: Search, title: 'Gurgaon के verified rental घर', text: 'Furnished flats, builder floors, PG और offices — sector-wise rent, brokerage और map के साथ।', colors: ['#312E81', '#4F46E5'] as const },
  { icon: ShieldCheck, title: 'भरोसेमंद brokers, असली listings', text: 'RERA verified brokers, reviews, और एक tap में call, WhatsApp या site visit।', colors: ['#4338CA', '#7C3AED'] as const },
  { icon: Sparkles, title: 'Brokers के लिए सबसे smart CRM', text: 'Housing, 99acres, Facebook की सारी leads एक app में — WhatsApp automation और AI के साथ।', colors: ['#7C2D12', '#D97706'] as const },
];

function Dot({ active }: { active: boolean }) {
  const s = useAnimatedStyle(() => ({ width: withSpring(active ? 26 : 8), opacity: withSpring(active ? 1 : 0.4) }));
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: '#fff' }, s]} />;
}

export default function Onboarding() {
  useLightStatusBar();
  const { app } = useConfig();
  const [i, setI] = useState(0);
  const list = useRef<FlatList>(null);
  const finish = async (to: '/login' | '/(user)/home') => {
    await SecureStore.setItemAsync('biq.onboarded', '1').catch(() => undefined);
    router.replace(to);
  };
  const s = SLIDES[i];
  return (
    <LinearGradient colors={s.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 }}>
          <Txt v="h3" color="white">{app.siteName}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <LanguagePill light />
            <Txt v="bodyStrong" color="rgba(255,255,255,0.8)" onPress={() => finish('/(user)/home')}>Skip</Txt>
          </View>
        </View>
        <FlatList
          ref={list}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(x) => x.title}
          onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index }) => (
            <View style={{ width, flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>
              {index === i && (
                <>
                  <Animated.View entering={ZoomIn.springify().damping(12)} style={{ width: 120, height: 120, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 36, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
                    <item.icon size={56} color="#fff" strokeWidth={1.6} />
                    <View style={{ position: 'absolute', right: -10, top: -10, width: 40, height: 40, borderRadius: 14, backgroundColor: palette.saffron[400], alignItems: 'center', justifyContent: 'center' }}>
                      {index === 0 ? <Building2 size={20} color="#111" /> : index === 1 ? <MessageCircle size={20} color="#111" /> : <BellRing size={20} color="#111" />}
                    </View>
                  </Animated.View>
                  <Animated.View entering={FadeInDown.delay(120).duration(500)}>
                    <Txt v="display" color="white">{item.title}</Txt>
                  </Animated.View>
                  <Animated.View entering={FadeInDown.delay(240).duration(500)}>
                    <Txt color="rgba(255,255,255,0.85)" style={{ marginTop: 14, fontSize: 16, lineHeight: 24 }}>{item.text}</Txt>
                  </Animated.View>
                </>
              )}
            </View>
          )}
        />
        <View style={{ padding: 24, gap: 18 }}>
          <View style={{ flexDirection: 'row', gap: 6, alignSelf: 'center' }}>{SLIDES.map((_, k) => <Dot key={k} active={k === i} />)}</View>
          {i < SLIDES.length - 1 ? (
            <Button title="आगे" variant="accent" size="lg" onPress={() => list.current?.scrollToIndex({ index: i + 1 })} />
          ) : (
            <>
              <Button title="Login / Sign up" variant="accent" size="lg" onPress={() => finish('/login')} />
              <Button title="Properties देखें" variant="ghost" color="#fff" onPress={() => finish('/(user)/home')} style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            </>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
