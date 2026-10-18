import { usePathname, router } from 'expo-router';
import { View } from 'react-native';
import { moduleAllowed } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { BrokerScreen } from './screen';
import { Txt, Button } from '@/ui';
import { nativeConsumerPath as consumer, nativeGuestPath as guest, nativeModuleKey } from './routes';
const essential = [
  '/',
  '/login',
  '/onboarding',
  '/data-consent',
  '/handle-share',
  '/broker-settings',
  '/drafts',
  '/product-tools',
  '/edit-profile',
  '/broker-onboarding',
  '/notifications',
  '/privacy',
  '/feedback',
];
export function NativeScreenLayout({ children, route }: { children: React.ReactNode; route: { name: string } }) {
  // Navigators retain their state while individual protected screen content waits for policy.
  if (route.name.startsWith('(')) return <>{children}</>;
  return <NativeModuleGate path={route.name === 'index' ? '/' : '/' + route.name}>{children}</NativeModuleGate>;
}
export function NativeModuleGate({ children, path: explicitPath }: { children: React.ReactNode; path?: string }) {
  const currentPath = usePathname();
  const path = explicitPath ?? currentPath;
  const { user } = useAuth();
  const config = useConfig();
  if (essential.includes(path)) return <>{children}</>;
  const key = path === '/dashboard-records' ? (user?.role === 'BROKER_ADMIN' ? 'today' : 'consumer') : nativeModuleKey(path);
  const role = user?.role ?? 'PUBLIC';
  const allowed =
    config.loaded &&
    moduleAllowed(config.modules, key, role) &&
    (consumer.test(path) || path === '/dashboard-records' ? !!user || guest.test(path) : user?.role === 'BROKER_ADMIN' && !!user.organization?.id);
  if (allowed) return <>{children}</>;
  // Protected children must never mount behind an overlay: their hooks would still fetch/mutate.
  const loading = !config.loaded && !config.error;
  const login = !user && consumer.test(path) && !guest.test(path);
  return (
    <BrokerScreen
      title={loading ? 'Getting things ready…' : login ? 'Sign in to continue' : config.error ? 'Connection needs attention' : 'Feature unavailable'}
    >
      <View style={{ padding: 24, gap: 16 }}>
        <Txt color="muted">
          {loading
            ? 'Loading your workspace permissions.'
            : login
              ? 'Save properties, send enquiries and plan visits with your customer account.'
              : config.error
                ? 'We could not load access settings. Your saved drafts remain on this device.'
                : user?.role === 'SUPER_ADMIN'
                  ? 'Open the responsive web Admin Portal to manage the platform.'
                  : 'This feature is not enabled for your account.'}
        </Txt>
        {config.storageError && <Txt color="danger">{config.storageError}</Txt>}
        {!loading && (
          <>
            <Button
              title={login ? 'Sign in' : 'Back to home'}
              onPress={() => router.replace(login ? '/login' : user?.role === 'BROKER_ADMIN' ? '/(broker)/dashboard' : '/(user)/home')}
            />
            <Button title="Retry" variant="secondary" onPress={() => config.refetch()} />
          </>
        )}
      </View>
    </BrokerScreen>
  );
}
