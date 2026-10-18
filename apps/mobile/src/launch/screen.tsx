import { Image } from 'expo-image';
import { View, Pressable, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, UserRound } from 'lucide-react-native';
import { Card, IconBtn, Txt } from '@/ui';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
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
  const broker = useAuth().user?.role === 'BROKER_ADMIN';
  return (
    <SafeAreaView edges={back ? ['top', 'bottom'] : ['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 16,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: c.surface,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        {back && (
          <IconBtn
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace(broker ? '/(broker)/dashboard' : '/(user)/home'))}
            style={{ backgroundColor: c.surface2 }}
          >
            <ChevronLeft size={22} color={c.fg} />
          </IconBtn>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 18, height: 18, borderRadius: 5 }} />
            <Txt v="caption" color="muted" style={{ fontSize: 9, letterSpacing: 1 }}>
              BROKERIQ
            </Txt>
          </View>
          <Txt v="h2" style={{ fontSize: 22, lineHeight: 29 }}>
            {title}
          </Txt>
          {subtitle && (
            <Txt v="caption" color="muted" style={{ marginTop: 3 }}>
              {subtitle}
            </Txt>
          )}
        </View>
        {action ?? (
          <Pressable
            accessibilityLabel="Profile & settings"
            onPress={() => router.push(broker ? '/broker-settings' : '/(user)/profile')}
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
  return (
    <Card onPress={onPress} style={[{ padding: 16, gap: 10, borderRadius: 22 }, style]}>
      {children}
    </Card>
  );
}
