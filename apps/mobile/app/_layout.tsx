import { RequestLoader } from '@/components/request-loader';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import '@/lib/background-shift-tracking';
import { useEffect } from 'react';
import { AppState, Linking, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { addPushTokenListener, type DevicePushToken } from 'expo-notifications';
import Constants from 'expo-constants';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Import only the weights we use (the package index would bundle every weight).
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Download, Wrench } from 'lucide-react-native';
import { authStore, useSession } from '@/lib/api';
import { cmpVersion, useConfig } from '@/lib/config';
import { registerPush, reconcileLocalReminders } from '@/lib/push';
import { useRealtime } from '@/lib/realtime';
import { useTheme } from '@/lib/theme';
import { Button, Toaster, Txt } from '@/ui';
import { DraftPump } from '@/launch/draft-pump';
import { NativeScreenLayout } from '@/launch/module-gate';
import { LanguageSuggestion } from '@/components/language';
import { loadLang } from '@/lib/lang';
import { installGlobalErrorHandler } from '@/lib/report-error';
import { AppErrorBoundary } from '@/components/error-boundary';
import { NotificationNavigation } from '@/components/notification-navigation';

/** A crashing screen shows a friendly retry screen and is reported to Admin → Health. */
export { AppErrorBoundary as ErrorBoundary };
export const unstable_settings = { initialRouteName: 'index' };

SplashScreen.preventAutoHideAsync().catch(() => undefined);
import { queryClient as qc } from '@/lib/query';

function Gate({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const { app, loaded } = useConfig();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const blocked = loaded && app.mobile?.minVersion && cmpVersion(version, app.mobile.minVersion) < 0;
  if (loaded && app.maintenance?.enabled)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Wrench size={48} color={c.brand} />
        <Txt v="h1" style={{ textAlign: 'center' }}>
          थोड़ी देर में वापस आएँ
        </Txt>
        <Txt color="muted" style={{ textAlign: 'center' }}>
          {app.maintenance.message || 'हम app को बेहतर बना रहे हैं।'}
        </Txt>
      </View>
    );
  if (blocked)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Download size={48} color={c.brand} />
        <Txt v="h1" style={{ textAlign: 'center' }}>
          नया version उपलब्ध है
        </Txt>
        <Txt color="muted" style={{ textAlign: 'center' }}>
          {app.mobile.forceUpdateMessage || 'जारी रखने के लिए app update करें।'}
        </Txt>
        {!!app.playStoreUrl && <Button title="Update करें" onPress={() => Linking.openURL(app.playStoreUrl)} />}
      </View>
    );
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const ready = useSession((s) => s.ready);
  const loggedInUserId = useSession((s) => s.session?.user.id);
  const { c, isDark } = useTheme();
  useEffect(() => {
    installGlobalErrorHandler();
    authStore.load();
    loadLang();
  }, []);
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined);
  }, [c.bg]);
  useEffect(() => {
    if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, ready]);
  useEffect(() => {
    if (!loggedInUserId) return;
    let registering = false;
    let registered = false;
    let promptPending = true;
    let refreshedToken: DevicePushToken | undefined;
    const register = async () => {
      if (registering || AppState.currentState !== 'active' || (registered && !refreshedToken)) return;
      registering = true;
      const token = refreshedToken;
      refreshedToken = undefined;
      try {
        const prompt = promptPending;
        promptPending = false;
        registered = Boolean(await registerPush(prompt, token));
      } catch {
        // Retry on foreground or after a temporary network failure.
      } finally {
        registering = false;
      }
    };
    void register();
    const tokenChanges = addPushTokenListener((token) => {
      refreshedToken = token;
      void register();
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        registered = false;
        void register();
      }
    });
    const timer = setInterval(() => void register(), 60_000);
    return () => {
      foreground.remove();
      tokenChanges.remove();
      clearInterval(timer);
    };
  }, [loggedInUserId]);
  useEffect(() => {
    if (!loggedInUserId) return;
    const refresh = () => {
      if (AppState.currentState === 'active') void reconcileLocalReminders().catch(() => undefined);
    };
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(refresh, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [loggedInUserId]);
  useRealtime<any>('notification', (notice) => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    if (['LEAD_ASSIGNED', 'LEAD_ASSIGNMENT_ACCEPTED', 'LEAD_ASSIGNMENT_DECLINED'].includes(notice?.kind)) {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      if (notice.leadId) void qc.invalidateQueries({ queryKey: ['lead', notice.leadId] });
    }
    if (typeof notice?.kind === 'string' && notice.kind.startsWith('INVENTORY_ACCESS_')) {
      for (const key of ['ledger', 'ledger-item', 'inventory-folder-items', 'inventory-access']) void qc.invalidateQueries({ queryKey: [key] });
    }
  });
  if (!fontsLoaded || !ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider preload={false}>
          <QueryClientProvider client={qc}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Gate>
              <Stack
                screenLayout={NativeScreenLayout}
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="data-consent" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
                <Stack.Screen name="(user)" options={{ animation: 'fade' }} />
                <Stack.Screen name="(broker)" options={{ animation: 'fade' }} />
                <Stack.Screen name="agent-assignments/[id]" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
              </Stack>
            </Gate>
            <NotificationNavigation />
            <DraftPump />
            <LanguageSuggestion />
            <Toaster />
            <RequestLoader />
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
