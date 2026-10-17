import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { Txt } from '@/ui';
import * as Haptics from 'expo-haptics';
import { useConfig } from '@/lib/config';
import { moduleAllowed } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
const keys: Record<string, string> = {
  dashboard: 'today',
  inventory: 'inventory',
  leads: 'leads',
  inbox: 'inbox',
  automations: 'automation',
  home: 'consumer',
  search: 'consumer',
  saved: 'consumer',
  messages: 'consumer',
  profile: 'consumer',
};
export function TabBar({ state, descriptors, navigation, badges = {} }: any) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { modules } = useConfig();
  const { user } = useAuth();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingTop: 7,
        paddingBottom: Math.max(insets.bottom, 9),
        paddingHorizontal: 6,
      }}
    >
      {state.routes
        .filter((route: any) => keys[route.name] && moduleAllowed(modules, keys[route.name], user?.role ?? 'PUBLIC'))
        .map((route: any) => {
          const options = descriptors[route.key].options;
          const focused = state.routes[state.index]?.key === route.key;
          const color = focused ? c.brand : c.muted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.title}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <View style={{ paddingHorizontal: 18, paddingVertical: 4, borderRadius: 12, backgroundColor: focused ? c.brandSoft : 'transparent' }}>
                {options.tabBarIcon?.({ focused, color, size: 21 })}
                {badges[route.name] > 0 && (
                  <View style={{ position: 'absolute', right: 5, top: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: c.danger }} />
                )}
              </View>
              <Txt v="caption" style={{ fontSize: 10, color, fontWeight: focused ? '700' : '500' }} numberOfLines={1}>
                {options.title}
              </Txt>
            </Pressable>
          );
        })}
    </View>
  );
}
