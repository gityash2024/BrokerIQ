import { Platform, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { fonts, useTheme } from '@/lib/theme';
import { PressableScale, Txt } from '@/ui';

function Item({ focused, label, icon, onPress, badge }: { focused: boolean; label: string; icon: React.ReactNode; onPress: () => void; badge?: number }) {
  const { c } = useTheme();
  const pill = useAnimatedStyle(() => ({ opacity: withSpring(focused ? 1 : 0), transform: [{ scale: withSpring(focused ? 1 : 0.6) }] }));
  return (
    <PressableScale onPress={onPress} haptic={false} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 3 }}>
      <View>
        <Animated.View style={[{ position: 'absolute', top: -6, left: -14, right: -14, bottom: -6, borderRadius: 14, backgroundColor: c.brandSoft }, pill]} />
        {icon}
        {!!badge && (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -10,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: c.danger,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <Txt v="caption" color="white" style={{ fontSize: 9, fontFamily: fonts.bold }}>
              {badge > 9 ? '9+' : badge}
            </Txt>
          </View>
        )}
      </View>
      <Txt
        v="caption"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{ fontSize: 10.5, fontFamily: focused ? fonts.bold : fonts.medium, color: focused ? c.brand : c.subtle }}
      >
        {label}
      </Txt>
    </PressableScale>
  );
}

/** Floating glass tab bar shared by user & broker modes. */
export function TabBar({ state, descriptors, navigation, badges = {} }: BottomTabBarProps & { badges?: Record<string, number | undefined> }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: Math.max(insets.bottom, 10),
        borderRadius: 26,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: c.line,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 12,
      }}
    >
      {Platform.OS === 'ios' && (
        <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      )}
      {/* Android has no cheap real blur: use an (almost) opaque surface so content never shows through. */}
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 8,
          paddingHorizontal: 4,
          backgroundColor:
            Platform.OS === 'ios' ? (isDark ? 'rgba(19,22,38,0.72)' : 'rgba(255,255,255,0.78)') : isDark ? 'rgba(19,22,38,0.97)' : 'rgba(255,255,255,0.98)',
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? c.brand : c.subtle;
          return (
            <Item
              key={route.key}
              focused={focused}
              label={(options.title ?? route.name) as string}
              badge={badges[route.name]}
              icon={options.tabBarIcon?.({ focused, color, size: 22 })}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
