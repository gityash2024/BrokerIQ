import { Alert, ScrollView, View, Linking } from 'react-native';
import { router } from 'expo-router';
import { tr } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { PLATFORM_MODULES, defaultModulePolicies, moduleAllowed } from '@brokeriq/shared';
import { Txt, Button } from '@/ui';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { LanguageSwitch } from '@/components/language';
export default function BrokerSettings() {
  const { user, logout } = useAuth();
  const { modules = defaultModulePolicies() } = useConfig();
  const handleLogout = () => {
    Alert.alert(
      tr('Log out of BrokerIQ?'),
      tr('Are you sure you want to log out of your account?'),
      [
        { text: tr('Cancel'), style: 'cancel' },
        { text: tr('Log out'), style: 'destructive', onPress: logout },
      ]
    );
  };
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
        {moduleAllowed(modules, 'team', user?.role ?? 'PUBLIC') && <Button title="Team & sub-agents" variant="secondary" onPress={() => router.push('/team')} />}
        <Button title="Saved drafts & sync" variant="secondary" onPress={() => router.push('/drafts')} />
        <Button title="Browse User Portal" variant="secondary" onPress={() => router.push('/(user)/home')} />
        {user?.role === 'BROKER_ADMIN' && <Button title="Firm profile" variant="secondary" onPress={() => router.push('/broker-onboarding')} />}
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
        <Button title="Log out" variant="secondary" onPress={handleLogout} />
      </ScrollView>
    </BrokerScreen>
  );
}
