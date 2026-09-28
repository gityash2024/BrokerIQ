import { useEffect } from 'react';
import { Linking, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import Constants from 'expo-constants';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { registerPush } from '@/lib/push';
import { useTheme } from '@/lib/theme';
import { Button, Toaster, Txt } from '@/ui';
import { AssistantButton } from '@/components/assistant';
import { loadLang } from '@/lib/lang';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function Gate({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const { app, loaded } = useConfig();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const blocked = loaded && app.mobile?.minVersion && cmpVersion(version, app.mobile.minVersion) < 0;
  if (loaded && app.maintenance?.enabled)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Wrench size={48} color={c.brand} />
        <Txt v="h1" style={{ textAlign: 'center' }}>थोड़ी देर में वापस आएँ</Txt>
        <Txt color="muted" style={{ textAlign: 'center' }}>{app.maintenance.message || 'हम app को बेहतर बना रहे हैं।'}</Txt>
      </View>
    );
  if (blocked)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Download size={48} color={c.brand} />
        <Txt v="h1" style={{ textAlign: 'center' }}>नया version उपलब्ध है</Txt>
        <Txt color="muted" style={{ textAlign: 'center' }}>{app.mobile.forceUpdateMessage || 'जारी रखने के लिए app update करें।'}</Txt>
        {!!app.playStoreUrl && <Button title="Update करें" onPress={() => Linking.openURL(app.playStoreUrl)} />}
      </View>
    );
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = useSession((s) => s.ready);
  const loggedIn = useSession((s) => !!s.session);
  const { c, isDark } = useTheme();
  useEffect(() => {
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
    if (loggedIn) registerPush().catch(() => undefined);
  }, [loggedIn]);
  if (!fontsLoaded || !ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={qc}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Gate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="data-consent" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
              <Stack.Screen name="(user)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(broker)" options={{ animation: 'fade' }} />
            </Stack>
          </Gate>
          <AssistantButton />
          <Toaster />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
