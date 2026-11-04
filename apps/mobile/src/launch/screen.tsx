import { useState } from 'react';
import { Image } from 'expo-image';
import { View, useWindowDimensions, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { ChevronLeft, Languages, Moon, MoreHorizontal, Sun, UserRound } from 'lucide-react-native';
import { Button, Card, IconBtn, Sheet, Txt } from '@/ui';
import { useTheme, useThemeMode } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { LanguageSheet } from '@/components/language';
import { NotificationBell } from '@/components/notification-bell';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const broker = useAuth().isBroker;
  const path = usePathname();
  const profilePath = broker ? '/broker-settings' : '/profile';
  const { width, fontScale } = useWindowDimensions();
  const compact = width / Math.max(1, fontScale) < 600;

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <SafeAreaView edges={back ? ['top', 'bottom'] : ['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          marginBottom: 8,
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: 8,
          backgroundColor: c.surface,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        {back && (
          <IconBtn
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace(broker ? '/(broker)/dashboard' : '/(user)/home'))}
            style={{ backgroundColor: c.surface2, flexShrink: 0 }}
          >
            <ChevronLeft size={20} color={c.fg} />
          </IconBtn>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 16, height: 16, borderRadius: 4 }} />
            <Txt v="caption" color="muted" style={{ fontSize: 9, letterSpacing: 1 }}>
              BROKERIQ
            </Txt>
          </View>
          <Txt v="h2" style={{ fontSize: 20, lineHeight: 26 }} numberOfLines={2}>
            {title}
          </Txt>
          {subtitle && (
            <Txt v="caption" color="muted" numberOfLines={1} style={{ marginTop: 2 }}>
              {subtitle}
            </Txt>
          )}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0,
            gap: 4,
          }}
        >
          <NotificationBell />
          {compact ? (
            <IconBtn accessibilityLabel="More options" onPress={() => setSettingsOpen(true)} style={{ backgroundColor: c.surface2 }}>
              <MoreHorizontal size={20} color={c.fg} />
            </IconBtn>
          ) : (
            (action ?? (
              <>
                <IconBtn
                  accessibilityLabel="Toggle Theme"
                  onPress={toggleTheme}
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    backgroundColor: c.surface2,
                    borderWidth: 1,
                    borderColor: c.line,
                  }}
                >
                  {isDark ? <Sun size={18} color={c.accent} /> : <Moon size={18} color={c.fg} />}
                </IconBtn>
                <IconBtn
                  accessibilityLabel="Select Language"
                  onPress={() => setLangSheetOpen(true)}
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    backgroundColor: c.surface2,
                    borderWidth: 1,
                    borderColor: c.line,
                  }}
                >
                  <Languages size={18} color={c.brand} />
                </IconBtn>
                {path !== profilePath && (
                  <IconBtn
                    accessibilityLabel="Profile & settings"
                    onPress={() => router.push(broker ? '/broker-settings' : '/(user)/profile')}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                      backgroundColor: c.surface2,
                      borderWidth: 1,
                      borderColor: c.line,
                    }}
                  >
                    <UserRound size={18} color={c.fg} />
                  </IconBtn>
                )}
              </>
            ))
          )}
        </View>
      </View>
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Quick settings">
        {action && <View style={{ alignItems: 'flex-start' }}>{action}</View>}
        <Button
          title={isDark ? 'Light theme' : 'Dark theme'}
          variant="secondary"
          icon={isDark ? <Sun size={20} color={c.accent} /> : <Moon size={20} color={c.fg} />}
          onPress={toggleTheme}
        />
        <Button
          title="Select Language"
          variant="secondary"
          icon={<Languages size={20} color={c.brand} />}
          onPress={() => {
            setSettingsOpen(false);
            setLangSheetOpen(true);
          }}
        />
        {path !== profilePath && (
          <Button
            title="Profile & settings"
            variant="secondary"
            icon={<UserRound size={20} color={c.fg} />}
            onPress={() => {
              setSettingsOpen(false);
              router.push(broker ? '/broker-settings' : '/(user)/profile');
            }}
          />
        )}
      </Sheet>
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
