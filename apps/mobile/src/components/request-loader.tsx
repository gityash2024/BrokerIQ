import { useEffect, useSyncExternalStore, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { requestActivity } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export function RequestLoader() {
  const { c } = useTheme();
  const { top } = useSafeAreaInsets();
  const busy = useSyncExternalStore(requestActivity.subscribe, requestActivity.getSnapshot) > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 140);
    return () => clearTimeout(timer);
  }, [busy]);
  if (!visible || !busy) return null;
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={tr('Loading…')}
      accessibilityState={{ busy }}
      style={{
        position: 'absolute',
        zIndex: 50,
        top: top + 5,
        right: 12,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: c.surface,
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={c.brand} size="small" />
    </View>
  );
}

export function LoadingArtwork() {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={tr('Loading…')}
      accessibilityState={{ busy: true }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}
    >
      <Image source={require('../../assets/loading-property.webp')} style={{ width: 144, height: 96 }} contentFit="contain" />
      <ActivityIndicator size="small" color={c.brand} />
    </View>
  );
}
