import { View } from 'react-native';
import { router } from 'expo-router';
import { hasDelegatedAccess, moduleAllowed } from '@brokeriq/shared';
import { Camera, FileArchive, Plus } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { Button, Txt } from '@/ui';

export function NativeInventoryEntryActions({ params }: { params?: Record<string, string> }) {
  const { user } = useAuth();
  const { modules } = useConfig();
  const { c } = useTheme();
  const role = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const canCreate = !!user && hasDelegatedAccess(user, 'inventory', 'create');
  const canImport = canCreate && moduleAllowed(modules, 'inbox', role) && hasDelegatedAccess(user, 'inbox', 'view', 'create');
  return (
    <View accessibilityLabel="Inventory entry actions" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button
        title="Add property"
        disabled={!canCreate}
        icon={<Plus size={17} color="white" />}
        style={{ flexGrow: 1, flexBasis: 150 }}
        onPress={() => router.push({ pathname: '/inventory-edit', params })}
      />
      <Button
        title="Scan property"
        variant="secondary"
        disabled={!canImport}
        icon={<Camera size={17} color={c.brand} />}
        style={{ flexGrow: 1, flexBasis: 150 }}
        onPress={() => router.push('/scanner?target=INVENTORY')}
      />
      <Button
        title="WhatsApp import"
        variant="secondary"
        disabled={!canImport}
        icon={<FileArchive size={17} color={c.brand} />}
        style={{ flexGrow: 1, flexBasis: 150 }}
        onPress={() => router.push('/capture?target=INVENTORY')}
      />
      {!canImport && (
        <Txt v="caption" color="muted" style={{ width: '100%' }}>
          Ask your Broker Admin for inventory create and capture access to use these actions.
        </Txt>
      )}
    </View>
  );
}
