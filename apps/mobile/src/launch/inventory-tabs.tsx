import { View } from 'react-native';
import { router } from 'expo-router';
import { brokerWorkspaceGroups, hasDelegatedAccess, moduleAllowed } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { toast } from '@/lib/toast';
import { Chip } from '@/ui';

export function NativeInventoryTabs({ active }: { active: string }) {
  const { user } = useAuth();
  const { modules } = useConfig();
  const role = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const group = brokerWorkspaceGroups(undefined, 'BROKER_ADMIN').find((entry) => entry.key === 'inventory');
  return (
    <View accessibilityLabel="Inventory sections" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4, paddingBottom: 6 }}>
      {group?.links
        .filter((link) => link.nativeHref && !link.href.includes('?'))
        .map((link) => {
          const canOpen =
            moduleAllowed(modules, link.module, role) &&
            hasDelegatedAccess(user, link.module, 'view') &&
            (!link.adminOnly || ((user?.role === 'BROKER_ADMIN' || user?.role === 'SUB_BROKER_ADMIN') && hasDelegatedAccess(user, 'inventory', 'approve')));
          return (
            <Chip
              key={link.href}
              style={{ minHeight: 38, paddingHorizontal: 22 }}
              textStyle={{ fontSize: 15, fontWeight: '700' }}
              label={link.label}
              active={active === link.href}
              onPress={() => {
                if (!canOpen)
                  toast.info(
                    link.adminOnly
                      ? 'Publication review requires Broker Admin approval access.'
                      : 'Ask your Broker Admin for access to this inventory section.',
                  );
                else if (active !== link.href) router.navigate(link.nativeHref as never);
              }}
            />
          );
        })}
    </View>
  );
}
