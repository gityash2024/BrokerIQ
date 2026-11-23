import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { ChevronLeft, Languages, LogOut, Moon, MoreHorizontal, Sun, UserRound } from 'lucide-react-native';
import { Button, Card, IconBtn, Sheet, Txt } from '@/ui';
import { useTheme, useThemeMode } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { goBack } from '@/lib/navigation';
import { LanguageSheet } from '@/components/language';
import { NotificationBell } from '@/components/notification-bell';
import { alert } from '@/lib/i18n';
import { showError } from '@/lib/hooks';

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
  const { isBroker: broker, user, logout } = useAuth();
  const platformMonitor = user?.role === 'SUPER_ADMIN';
  const confirmLogout = () =>
    alert('Log out?', 'Sign out of this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', onPress: () => logout().catch(showError) },
    ]);
  const path = usePathname();
  const profilePath = broker ? '/broker-settings' : '/profile';
  const { width, fontScale } = useWindowDimensions();
  const compact = width / Math.max(1, fontScale) < 600;

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <SafeAreaView edges={back ? ['top', 'bottom'] : ['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      {!isDark && (
        <Image pointerEvents="none" source={require('../../assets/workspace/lavender-waves.png')} contentFit="fill" style={[StyleSheet.absoluteFill, { top: 110, bottom: -110 }]} />
      )}
      <View
        style={{
          paddingHorizontal: 21,
          paddingVertical: 14,
          marginBottom: 8,
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: 8,
          backgroundColor: isDark ? c.surface : 'rgba(255,255,255,0.38)',
          borderBottomWidth: 1,
          borderBottomColor: isDark ? c.line : 'transparent',
        }}
      >
        {back && (
          <IconBtn
            accessibilityLabel="Back"
            onPress={() => goBack()}
            style={{ backgroundColor: c.surface2, flexShrink: 0 }}
          >
            <ChevronLeft size={20} color={c.fg} />
          </IconBtn>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 20, height: 20, borderRadius: 5 }} />
            <Txt v="caption" color="muted" style={{ fontSize: 12, letterSpacing: 0.1, fontWeight: '700' }}>
              BROKERIQ
            </Txt>
          </View>
          <Txt v="h2" style={{ fontSize: 23, lineHeight: 30 }} numberOfLines={2}>
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
              {!platformMonitor && path !== profilePath && (
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
              {platformMonitor && (
                <IconBtn accessibilityLabel="Log out" onPress={confirmLogout} style={{ backgroundColor: c.surface2 }}>
                  <LogOut size={18} color={c.fg} />
                </IconBtn>
              )}
            </>
          )}
        </View>
      </View>
      {action && (
        <View accessibilityLabel="Page actions" style={{ paddingHorizontal: 10, paddingBottom: 12, gap: 8 }}>
          {action}
        </View>
      )}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Quick settings">
        {broker && (
          <Button
            title="Product features"
            variant="secondary"
            onPress={() => {
              setSettingsOpen(false);
              router.push('/product-tools');
            }}
          />
        )}
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
        {!platformMonitor && path !== profilePath && (
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
        {platformMonitor && <Button title="Log out" variant="secondary" icon={<LogOut size={20} color={c.fg} />} onPress={confirmLogout} />}
      </Sheet>
      <LanguageSheet open={langSheetOpen} onClose={() => setLangSheetOpen(false)} />
      {children}
    </SafeAreaView>
  );
}
export function NativeCard({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={[{ padding: 14, gap: 8, borderRadius: 18 }, style]}>
      {children}
    </Card>
  );
}
