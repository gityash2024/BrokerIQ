import { useState } from 'react';
import { View } from 'react-native';
import { Plus } from 'lucide-react-native';
import type { InventoryInput } from '@brokeriq/shared';
import { useTheme } from '@/lib/theme';
import { Button, Input, Row, Txt } from '@/ui';
import { ChoiceField } from './form';

type Contacts = NonNullable<InventoryInput['contacts']>;
const blank = (): Contacts[number] => ({ name: '', phone: '', role: 'OWNER' });

export function SurveyContactFields({
  contacts,
  onChange,
  disabled,
  onlyOwner,
}: {
  contacts: Contacts;
  onChange: (contacts: Contacts) => void;
  disabled?: boolean;
  onlyOwner?: boolean;
}) {
  const { c } = useTheme();
  const [options, setOptions] = useState(false);
  const rows = contacts.length ? contacts : [blank()];
  function update(index: number, patch: Partial<Contacts[number]>) {
    onChange(rows.map((contact, i) => (index === i ? { ...contact, ...patch } : contact)));
  }
  return (
    <View style={{ gap: 8 }}>
      <Txt v="bodyStrong">{onlyOwner ? 'Owner contacts' : 'Contacts'}</Txt>
      {rows.map((contact, index) => (
        <View key={index} style={{ gap: 6 }}>
          <Row align="flex-start" gap={8}>
            <Input
              label={`Name ${index + 1}`}
              value={contact.name ?? ''}
              editable={!disabled}
              onChangeText={(name) => update(index, { name })}
              containerStyle={{ flex: 1 }}
            />
            <Input
              label={`Phone number ${index + 1}`}
              value={contact.phone ?? ''}
              editable={!disabled}
              keyboardType="phone-pad"
              maxLength={25}
              onChangeText={(phone) => update(index, { phone })}
              containerStyle={{ flex: 1.2 }}
            />
          </Row>
          {options && (
            <ChoiceField
              label={`Contact ${index + 1} role`}
              value={contact.role}
              choices={['UNKNOWN', 'OWNER', 'BROKER']}
              access={!disabled}
              onChange={(role) => update(index, { role: role === 'OWNER' || role === 'BROKER' ? role : 'UNKNOWN' })}
            />
          )}
          {contacts.length > 0 && (
            <Button
              title={`Remove contact ${index + 1}`}
              size="sm"
              variant="ghost"
              disabled={disabled}
              onPress={() => onChange(rows.filter((_, i) => i !== index))}
            />
          )}
        </View>
      ))}
      <Row wrap>
        <Button
          title="Add contact"
          size="sm"
          variant="secondary"
          icon={<Plus size={16} color={c.brand} />}
          disabled={disabled || rows.length >= 30}
          onPress={() => onChange([...rows, blank()])}
        />
        {!onlyOwner && !!contacts.length && (
          <Button title={options ? 'Hide contact options' : 'Contact options'} size="sm" variant="ghost" onPress={() => setOptions(!options)} />
        )}
      </Row>
    </View>
  );
}
