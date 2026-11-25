import { View } from 'react-native';
import { roleModulePermissions, delegatedGrant } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { Card, Chip, Txt } from '@/ui';

export function DelegatedPermissions({ value, onChange, role = 'SUB_BROKER_ADMIN' }: { value: string[]; onChange: (value: string[]) => void; role?: string }) {
  const { modules, loaded } = useConfig();
  if (!loaded) return <Txt color="muted">Loading available permissions…</Txt>;
  return (
    <View style={{ gap: 10 }}>
      <Txt color="muted">Choose individual actions. Unchecked actions remain restricted.</Txt>
      {roleModulePermissions(modules, role).map((module) => (
        <Card key={module.key} style={{ padding: 12, gap: 8 }}>
          <Txt v="bodyStrong">{module.name}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {module.actions.map((action) => {
              const grant = delegatedGrant(module.key, action);
              return (
                <Chip
                  key={grant}
                  label={action === 'approve_details' ? 'Approve property details access' : (action[0].toUpperCase() + action.slice(1)).replaceAll('_', ' ')}
                  active={value.includes(grant)}
                  onPress={() => onChange(value.includes(grant) ? value.filter((item) => item !== grant) : [...value, grant])}
                />
              );
            })}
          </View>
        </Card>
      ))}
    </View>
  );
}
