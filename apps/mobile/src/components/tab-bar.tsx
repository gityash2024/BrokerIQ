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
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 9),
        paddingHorizontal: 6,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        shadowColor: '#0f172a',
        shadowOpacity: 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
        elevation: 8,
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
              <View style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 14, backgroundColor: focused ? c.brand : 'transparent' }}>
                {options.tabBarIcon?.({ focused, color: focused ? '#fff' : color, size: 21 })}
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
