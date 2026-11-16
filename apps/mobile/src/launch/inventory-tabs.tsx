import { ScrollView } from '@/components/keyboard-scroll-view';
import { router } from 'expo-router';
import { brokerWorkspaceGroups, delegatedModulePolicies, hasDelegatedAccess } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { Chip } from '@/ui';

export function NativeInventoryTabs({ active }: { active: string }) {
  const { user } = useAuth();
  const { modules } = useConfig();
  const delegated = user?.role === 'SUB_BROKER_ADMIN';
  const group = brokerWorkspaceGroups(
    delegated ? delegatedModulePolicies(modules, user?.delegatedPermissions ?? []) : modules,
    delegated ? 'BROKER_ADMIN' : (user?.role ?? ''),
  ).find((entry) => entry.key === 'inventory');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
      {group?.links
        .filter(
          (link) => link.nativeHref && !link.href.includes('?') && (link.href !== '/broker/publications' || hasDelegatedAccess(user, 'inventory', 'approve')),
        )
        .map((link) => (
          <Chip
            key={link.href}
            label={link.label}
            active={active === link.href}
            onPress={() => {
              if (active !== link.href) router.navigate(link.nativeHref as never);
            }}
          />
        ))}
    </ScrollView>
  );
}
