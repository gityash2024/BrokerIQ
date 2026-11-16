import { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { requestActivity } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export function InlineLoader({ size = 27, style }: { size?: number; style?: StyleProp<ViewStyle> } = {}) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!reduceMotion) progress.value = withRepeat(withTiming(size * 0.68, { duration: 780 }), -1, true);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion, size]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value }] }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={tr('Loading…')}
      accessibilityState={{ busy: true }}
      style={[{ alignItems: 'center', justifyContent: 'center', gap: 2 }, style]}
    >
      <Image source={require('../../assets/loading-property.webp')} style={{ width: size, height: (size * 2) / 3 }} contentFit="contain" />
      <View style={{ width: size, height: size >= 40 ? 3 : 2, borderRadius: 4, overflow: 'hidden', backgroundColor: c.brandSoft }}>
        <Animated.View style={[{ width: '32%', height: '100%', borderRadius: 4, backgroundColor: c.brand }, animated]} />
      </View>
    </View>
  );
}

export function RequestLoader() {
  const { c } = useTheme();
  const { top } = useSafeAreaInsets();
  const visible = useSyncExternalStore(requestActivity.subscribe, requestActivity.getVisibility);
  return visible ? (
    <View pointerEvents="none" style={{ position: 'absolute', zIndex: 50, top: top + 5, right: 12, padding: 4, borderRadius: 10, backgroundColor: c.surface }}>
      <InlineLoader size={37} />
    </View>
  ) : null;
}

export function LoadingArtwork({ h, w, style }: { h?: number; w?: number | `${number}%`; style?: StyleProp<ViewStyle> } = {}) {
  const dimensions = h == null && !style ? { flex: 1, minHeight: 120, padding: 24 } : { height: h, width: w ?? ('100%' as const) };
  const specifiedHeight = StyleSheet.flatten(style)?.height;
  const height = typeof specifiedHeight === 'number' ? specifiedHeight : h;
  return <InlineLoader size={height == null ? 144 : Math.max(12, Math.min(108, height))} style={[dimensions, style]} />;
}
