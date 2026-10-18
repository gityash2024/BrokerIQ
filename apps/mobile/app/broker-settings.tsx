import { ScrollView, View, Linking } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { PLATFORM_MODULES, defaultModulePolicies } from '@brokeriq/shared';
import { Txt, Button } from '@/ui';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { LanguageSwitch } from '@/components/language';
export default function BrokerSettings() {
  const { user, logout } = useAuth();
  const { modules = defaultModulePolicies() } = useConfig();
  return (
    <BrokerScreen title="Profile & settings" back>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 30 }}>
        <NativeCard>
          <Txt v="h3">{user?.name}</Txt>
          <Txt color="muted">{user?.organization?.name}</Txt>
          <Txt v="caption" color="muted">
            {user?.email}
          </Txt>
          <Button title="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} />
        </NativeCard>
        <LanguageSwitch render={(label, open) => <Button title={label} variant="secondary" onPress={open} />} />
        <Button title="Product features & upcoming" variant="secondary" onPress={() => router.push('/product-tools' as any)} />
        <Button title="Saved drafts & sync" variant="secondary" onPress={() => router.push('/drafts')} />
        <Button title="Browse User Portal" variant="secondary" onPress={() => router.push('/(user)/home')} />
        <Button title="Firm profile" variant="secondary" onPress={() => router.push('/broker-onboarding')} />
        <Button title="Open web panel" variant="secondary" onPress={() => Linking.openURL('https://brokeriq.mymultimeds.com/login')} />
        <Txt v="h3">Upcoming features</Txt>
        {PLATFORM_MODULES.filter((m) => modules[m.key]?.state === 'COMING_SOON' && m.key !== 'legacy').map((m) => (
          <View key={m.key} accessibilityState={{ disabled: true }}>
            <NativeCard>
              <Txt v="title">{m.name}</Txt>
              <Txt v="caption" color="muted">
                Coming soon
              </Txt>
            </NativeCard>
          </View>
        ))}
        <Button title="Log out" variant="secondary" onPress={logout} />
      </ScrollView>
    </BrokerScreen>
  );
}
