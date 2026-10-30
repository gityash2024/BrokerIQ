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
  kyc: 'kyc',
  home: 'consumer',
  search: 'consumer',
  saved: 'consumer',
  messages: 'consumer',
  profile: 'consumer',
};

export function TabBar({ state, descriptors, navigation, badges = {} }: any) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { modules } = useConfig();
  const { user } = useAuth();

  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 4,
        paddingHorizontal: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          backgroundColor: isDark ? 'rgba(18, 22, 38, 0.96)' : 'rgba(255, 255, 255, 0.96)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          borderRadius: 24,
          paddingVertical: 6,
          paddingHorizontal: 6,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.35 : 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 4 },
          elevation: 10,
        }}
      >
        {state.routes
          .filter((route: any) => keys[route.name] && moduleAllowed(modules, keys[route.name], user?.role ?? 'PUBLIC'))
          .map((route: any) => {
            const options = descriptors[route.key].options;
            const focused = state.routes[state.index]?.key === route.key;
            const activeColor = c.brand;
            const inactiveColor = isDark ? '#7E88A0' : '#64748B';

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options.title}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 5,
                  paddingHorizontal: 2,
                  gap: 3,
                }}
              >
                {/* Active Capsule Dock */}
                <View
                  style={{
                    paddingHorizontal: focused ? 14 : 10,
                    paddingVertical: 5,
                    borderRadius: 16,
                    backgroundColor: focused
                      ? (isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)')
                      : 'transparent',
                    borderWidth: 1,
                    borderColor: focused
                      ? (isDark ? 'rgba(99, 102, 241, 0.45)' : 'rgba(99, 102, 241, 0.3)')
                      : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {options.tabBarIcon?.({
                    focused,
                    color: focused ? activeColor : inactiveColor,
                    size: 21,
                  })}

                  {/* Badge Notification */}
                  {badges[route.name] > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        right: 2,
                        top: 2,
                        minWidth: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: c.danger,
                        borderWidth: 1,
                        borderColor: isDark ? '#121626' : '#fff',
                      }}
                    />
                  )}
                </View>

                {/* Tab Label */}
                <Txt
                  v="caption"
                  style={{
                    fontSize: 10.5,
                    color: focused ? activeColor : inactiveColor,
                    fontWeight: focused ? '800' : '500',
                    letterSpacing: focused ? 0.2 : 0,
                  }}
                  numberOfLines={1}
                >
                  {options.title}
                </Txt>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}
