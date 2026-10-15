import { useState } from 'react';
import { View } from 'react-native';
import { PROPERTY_AMENITIES, visiblePropertyFields } from '@brokeriq/shared';
import { Button, Txt, Input, Chip } from '@/ui';
import { ChoiceField } from './form';
export function NativePropertyExtras({ value, onChange }: { value: Record<string, any>; onChange: (value: Record<string, any>) => void }) {
  const [open, setOpen] = useState(false);
  const fields = visiblePropertyFields(value.category);
  const details = value.details ?? {};
  function change(key: string, v: any) {
    onChange({ ...value, details: { ...details, [key]: v } });
  }
  return (
    <View style={{ gap: 14 }}>
      <Button title={open ? 'Hide additional details' : 'Additional property details'} variant="secondary" onPress={() => setOpen(!open)} />
      {open && (
        <>
          <Txt v="caption" color="muted">
            Only known facts. Missing values stay unknown.
          </Txt>
          {fields.map((f) => (
            <View key={f.key}>
              {f.options || f.kind === 'boolean' ? (
                <ChoiceField
                  label={f.label}
                  value={details[f.key] == null ? null : String(details[f.key])}
                  choices={f.kind === 'boolean' ? ['true', 'false'] : f.options!}
                  onChange={(v) => change(f.key, v == null ? null : f.kind === 'boolean' ? v === 'true' : v)}
                />
              ) : (
                <Input
                  label={f.label}
                  value={details[f.key] == null ? '' : String(details[f.key])}
                  keyboardType={f.kind === 'number' ? 'decimal-pad' : 'default'}
                  onChangeText={(v) => change(f.key, v === '' ? null : v)}
                />
              )}
            </View>
          ))}
          <Txt v="h3">Amenities & facilities</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {PROPERTY_AMENITIES.map((a) => (
              <Chip
                key={a}
                label={a.replace(/_/g, ' ')}
                active={value.amenities?.includes(a)}
                onPress={() =>
                  onChange({
                    ...value,
                    amenities: value.amenities?.includes(a) ? value.amenities.filter((s: string) => s !== a) : [...(value.amenities ?? []), a],
                  })
                }
              />
            ))}
          </View>
          {['photoUrls', 'videoUrls'].map((key) => (
            <Input
              key={key}
              label={key === 'photoUrls' ? 'Photo URLs (one per line)' : 'Video URLs (one per line)'}
              multiline
              value={(value[key] ?? []).join('\n')}
              onChangeText={(v) => onChange({ ...value, [key]: v.split('\n').filter(Boolean) })}
            />
          ))}
        </>
      )}
    </View>
  );
}
