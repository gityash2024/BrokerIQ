import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { normalizePropertyDate, propertyDateSchema } from '@brokeriq/shared';
import { Button, Txt } from '@/ui';

/** Calendar dates stay date-only: no UTC conversion can move the selected day. */
export function PropertyDateField({ label, value, onChange }: { label: string; value?: string | null; onChange: (date: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = propertyDateSchema.safeParse(value);
  const selected = parsed.success ? new Date(`${parsed.data}T12:00:00`) : new Date();
  const change = (date: Date) => onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  const show = () => {
    if (Platform.OS === 'android')
      DateTimePickerAndroid.open({
        value: selected,
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) change(date);
        },
      });
    else setOpen(true);
  };
  return (
    <View style={{ gap: 6 }}>
      <Txt v="small">{label}</Txt>
      <Button title={value ? String(normalizePropertyDate(value)) : 'Select date'} accessibilityLabel={label} variant="secondary" onPress={show} />
      {!!value && <Button title={`Clear ${label}`} size="sm" variant="ghost" onPress={() => onChange(null)} />}
      {open && (
        <>
          <DateTimePicker value={selected} mode="date" onChange={(_, date) => date && change(date)} />
          <Button title="Done" size="sm" onPress={() => setOpen(false)} />
        </>
      )}
    </View>
  );
}
