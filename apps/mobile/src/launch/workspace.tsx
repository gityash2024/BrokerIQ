import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Txt } from '@/ui';
import { useTheme } from '@/lib/theme';

export function WorkspaceHero({ label, title, description, children }: {
  label: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(350).reduceMotion(ReduceMotion.System)}>
      <LinearGradient colors={['#1e1b4b', '#3730a3', '#4f46e5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, borderRadius: 24, gap: 9, overflow: 'hidden' }}>
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', right: -45, top: -60, width: 180, height: 180, borderRadius: 90, borderWidth: 28, borderColor: '#ffffff09' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fbbf24' }} />
          <Txt v="label" color="#c7d2fe" style={{ fontSize: 9, flex: 1 }}>{label}</Txt>
        </View>
        <Txt v="h2" color="white">{title}</Txt>
        {!!description && <Txt v="small" color="#e0e7ff">{description}</Txt>}
        {children}
      </LinearGradient>
    </Animated.View>
  );
}

export function WorkspaceTag({ label, tone = 'brand' }: { label: string; tone?: 'brand' | 'muted' | 'success' | 'warning' }) {
  const { c } = useTheme();
  const color = c[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: tone === 'muted' ? c.surface2 : `${color}16`, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 }}>
      <Txt v="caption" color={color} style={{ fontSize: 10 }}>{label}</Txt>
    </View>
  );
}
