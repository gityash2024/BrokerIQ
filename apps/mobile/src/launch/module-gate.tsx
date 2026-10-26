import { usePathname, router } from 'expo-router';
import { Fragment } from 'react';
import { View } from 'react-native';
import { moduleAllowed, defaultModulePolicies } from '@brokeriq/shared';
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
  const broker = !!user && ['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role);
  const config = useConfig();
  if (essential.includes(path)) return <Fragment key={user?.id ?? 'guest'}>{children}</Fragment>;
  const key = path === '/dashboard-records' ? (broker ? 'today' : 'consumer') : nativeModuleKey(path);
  const role = user?.role ?? 'PUBLIC';
  const allowed =
    config.loaded &&
    moduleAllowed(config.modules, key, role) &&
    (consumer.test(path) || path === '/dashboard-records' ? !!user || guest.test(path) : broker && !!user?.organization?.id);
  if (allowed) return <Fragment key={user?.id ?? 'guest'}>{children}</Fragment>;
  // Protected children must never mount behind an overlay: their hooks would still fetch/mutate.
  const loading = !config.loaded && !config.error;
  const login = !user && consumer.test(path) && !guest.test(path);
  const policy = config.modules?.[key] ?? defaultModulePolicies()[key];
  const upcoming = policy?.state === 'COMING_SOON';
  return (
    <BrokerScreen
      title={
        loading
          ? 'Getting things ready…'
          : login
            ? 'Sign in to continue'
            : config.error
              ? 'Connection needs attention'
              : upcoming
                ? 'Coming soon · Disabled'
                : policy?.state === 'HIDDEN'
                  ? 'Module disabled'
                  : 'Access restricted'
      }
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
                  : upcoming
                    ? 'This workflow is on the product roadmap. Existing records remain safe while it is disabled.'
                    : 'This feature is not enabled for your account. Your records and offline drafts remain safe.'}
        </Txt>
        {config.storageError && <Txt color="danger">{config.storageError}</Txt>}
        {!loading && (
          <>
            <Button
              title={login ? 'Sign in' : 'Back to home'}
              onPress={() => router.replace(login ? '/login' : broker ? '/(broker)/dashboard' : '/(user)/home')}
            />
            <Button title="Retry" variant="secondary" onPress={() => config.refetch()} />
          </>
        )}
      </View>
    </BrokerScreen>
  );
}
