import { useState } from 'react';
import { Image } from 'expo-image';
import { View, Pressable, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Languages, Moon, Sun, UserRound } from 'lucide-react-native';
import { Card, IconBtn, Txt } from '@/ui';
import { useTheme, useThemeMode } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { LanguageSheet } from '@/components/language';

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
  const { c, isDark } = useTheme();
  const setMode = useThemeMode((s) => s.setMode);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const broker = useAuth().isBroker;

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <SafeAreaView edges={back ? ['top', 'bottom'] : ['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 14,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: c.surface,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        {back && (
          <IconBtn
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace(broker ? '/(broker)/dashboard' : '/(user)/home'))}
            style={{ backgroundColor: c.surface2, width: 38, height: 38 }}
          >
            <ChevronLeft size={20} color={c.fg} />
          </IconBtn>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 16, height: 16, borderRadius: 4 }} />
            <Txt v="caption" color="muted" style={{ fontSize: 9, letterSpacing: 1 }}>
              BROKERIQ
            </Txt>
          </View>
          <Txt v="h2" style={{ fontSize: 20, lineHeight: 26 }} numberOfLines={1}>
            {title}
          </Txt>
          {subtitle && (
            <Txt v="caption" color="muted" numberOfLines={1} style={{ marginTop: 2 }}>
              {subtitle}
            </Txt>
          )}
        </View>
        {action ?? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityLabel="Toggle Theme"
              onPress={toggleTheme}
              style={{
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              {isDark ? <Sun size={18} color={c.accent} /> : <Moon size={18} color={c.fg} />}
            </Pressable>
            <Pressable
              accessibilityLabel="Select Language"
              onPress={() => setLangSheetOpen(true)}
              style={{
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              <Languages size={18} color={c.brand} />
            </Pressable>
            <Pressable
              accessibilityLabel="Profile & settings"
              onPress={() => router.push(broker ? '/broker-settings' : '/(user)/profile')}
              style={{
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              <UserRound size={18} color={c.fg} />
            </Pressable>
          </View>
        )}
      </View>
      <LanguageSheet open={langSheetOpen} onClose={() => setLangSheetOpen(false)} />
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
