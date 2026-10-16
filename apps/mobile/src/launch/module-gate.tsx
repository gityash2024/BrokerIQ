import { usePathname, router } from 'expo-router';
import { View } from 'react-native';
import { moduleAllowed, moduleForPath } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { BrokerScreen } from './screen';
import { Txt, Button } from '@/ui';

const essential = ['/', '/login', '/onboarding', '/handle-share', '/broker-settings', '/drafts', '/edit-profile', '/broker-onboarding', '/notifications'];
function keyFor(path: string) {
  if (path.startsWith('/area-directory')) return 'directory';
  if (/^\/(inventory(?:-edit)?)(\/|$)/.test(path)) return 'inventory';
  if (/^\/(lead|leads|add-lead|pipeline|follow-ups|visits|requirements|requirement-edit)(\/|$)/.test(path)) return 'leads';
  if (/^\/(capture|import-review|wa|chat)(\/|$)/.test(path)) return 'inbox';
  if (/^\/(automations|connectors)(\/|$)/.test(path)) return 'automation';
  return moduleForPath(path, 'web') ?? 'legacy';
}
export function NativeModuleGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user } = useAuth();
  const config = useConfig();
  if (essential.includes(path)) return <>{children}</>;
  const key = path === '/dashboard' ? 'today' : keyFor(path);
  const allowed = user?.role === 'BROKER_ADMIN' && !!user.organization?.id && config.loaded && moduleAllowed(config.modules, key, user.role);
  if (allowed) return <>{children}</>;
  return (
    <View style={{ flex: 1 }}>
      {children}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100 }}>
        <BrokerScreen title={!user ? 'Sign in required' : !config.loaded ? 'Loading permissions…' : 'Feature unavailable'}>
          <View style={{ padding: 24, gap: 16 }}>
            <Txt color="muted">
              {config.error
                ? 'Could not load module permissions. Retry to continue.'
                : user?.role === 'SUPER_ADMIN'
                  ? 'Use the web panel to manage the platform.'
                  : 'This feature is not currently available for your account.'}
            </Txt>
            {config.storageError && <Txt color="danger">{config.storageError}</Txt>}
            {user?.role === 'BROKER_ADMIN' &&
              [
                ['inventory', '/inventory', 'Inventory'],
                ['leads', '/leads', 'Leads & Requirements'],
                ['inbox', '/inbox', 'Inbox'],
                ['automation', '/automations', 'Automation & Housing'],
              ]
                .filter(([module]) => moduleAllowed(config.modules, module, user.role))
                .map(([, path, label]) => <Button key={path} title={label} variant="secondary" onPress={() => router.replace(path as any)} />)}
            <Button title="Retry" variant="secondary" onPress={() => config.refetch()} />
            <Button title={user ? 'Profile & settings' : 'Sign in'} onPress={() => router.replace(user ? '/broker-settings' : '/login')} />
          </View>
        </BrokerScreen>
      </View>
    </View>
  );
}
