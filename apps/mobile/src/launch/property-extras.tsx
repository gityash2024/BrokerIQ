import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { PROPERTY_AMENITIES, visiblePropertyFields } from '@brokeriq/shared';
import { Button, Txt, Input, Chip } from '@/ui';
import { ChoiceField } from './form';
import { NativePropertyMedia } from './property-media';
import { PropertyDateField } from './property-date-field';
export function NativePropertyExtras({
  value,
  onChange,
  onUploading,
  disabled,
  children,
  quickEntry,
  separatePossession = false,
}: {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  onUploading?: (busy: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  quickEntry?: { open: boolean; onToggle: (open: boolean) => void };
  separatePossession?: boolean;
}) {
  const latest = useRef(value);
  latest.current = value;
  function changeMedia(key: string, update: (urls: string[]) => string[]) {
    const next = { ...latest.current, [key]: update(latest.current[key] ?? []) };
    latest.current = next;
    onChange(next);
  }
  const [expanded, setExpanded] = useState(false);
  const open = quickEntry?.open ?? expanded;
  const setOpen = quickEntry?.onToggle ?? setExpanded;
  const fields = visiblePropertyFields(value.category).filter(
    (field) =>
      (!quickEntry || !['tenantType', 'foodPreference'].includes(field.key)) && (!(quickEntry || separatePossession) || field.key !== 'possessionDate'),
  );
  const details = value.details ?? {};
  function change(key: string, v: any) {
    onChange({ ...value, details: { ...details, [key]: v } });
  }
  const media = (
    <NativePropertyMedia
      photos={value.photoUrls ?? []}
      videos={value.videoUrls ?? []}
      disabled={disabled}
      onUploading={onUploading}
      onAdd={(key, url) => changeMedia(key, (urls) => [...urls, url])}
      onRemove={(key, index) => changeMedia(key, (urls) => urls.filter((_, i) => i !== index))}
    />
  );
  return (
    <View style={{ gap: 14 }}>
      {media}
      <Button title={open ? 'Hide additional details' : 'Additional property details'} variant="secondary" onPress={() => setOpen(!open)} />
      {open && (
        <>
          <Txt v="caption" color="muted">
            Only known facts. Missing values stay unknown.
          </Txt>
          {children}
          {fields.map((f) => (
            <View key={f.key}>
              {['possessionDate', 'availableFrom'].includes(f.key) ? (
                <PropertyDateField label={f.label} value={details[f.key]} onChange={(date) => change(f.key, date)} />
              ) : f.options || f.kind === 'boolean' ? (
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
                  keyboardType={f.kind === 'number' ? (f.integer ? 'number-pad' : 'decimal-pad') : 'default'}
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
        </>
      )}
    </View>
  );
}
