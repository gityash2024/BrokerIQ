import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { Button, Row, Txt } from '@/ui';
import type { DateTimeFieldProps } from './date-time-field';

export function DateTimeField({ value, onChange }: DateTimeFieldProps) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  const base = value || new Date();
  return (
    <>
      <Row>
        <Button title={value ? value.toLocaleDateString('en-IN') : 'Choose date'} variant="secondary" onPress={() => setMode('date')} />
        <Button
          title={value ? value.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : 'Choose time'}
          variant="secondary"
          onPress={() => setMode('time')}
        />
      </Row>
      {mode && (
        <DateTimePicker
          value={base}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onDismiss={() => setMode(null)}
          onValueChange={(_, chosen) => {
            const next = new Date(base);
            if (mode === 'date') next.setFullYear(chosen.getFullYear(), chosen.getMonth(), chosen.getDate());
            else next.setHours(chosen.getHours(), chosen.getMinutes(), 0, 0);
            onChange(next);
            if (Platform.OS === 'android') setMode(null);
          }}
        />
      )}
      {mode && Platform.OS === 'ios' && <Button title="Done" onPress={() => setMode(null)} />}
      {!value && (
        <Txt v="caption" color="muted">
          Choose a date and time before saving.
        </Txt>
      )}
    </>
  );
}
