import { View, Pressable, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, UserRound } from 'lucide-react-native';
import { Txt } from '@/ui';
import { useTheme } from '@/lib/theme';
export function BrokerScreen({
  title,
  subtitle,
  children,
  back = false,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: boolean;
  action?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={back ? ['top', 'bottom'] : ['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {back && (
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={{ padding: 10 }}>
            <ChevronLeft size={22} color={c.fg} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Txt v="h2">{title}</Txt>
          {subtitle && (
            <Txt v="caption" color="muted" style={{ marginTop: 3 }}>
              {subtitle}
            </Txt>
          )}
        </View>
        {action ?? (
          <Pressable
            accessibilityLabel="Profile & settings"
            onPress={() => router.push('/broker-settings')}
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <UserRound size={20} color={c.fg} />
          </Pressable>
        )}
      </View>
      {children}
    </SafeAreaView>
  );
}
export function NativeCard({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const { c } = useTheme();
  const body = (
    <View style={[{ padding: 16, gap: 8, borderWidth: 1, borderColor: c.line, borderRadius: 18, backgroundColor: c.surface }, style]}>{children}</View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}
