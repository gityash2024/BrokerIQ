import { useEffect, useState } from 'react';
import { parseVisitLocalDateTime } from '@brokeriq/shared';
import { Input, Txt } from '@/ui';
export interface DateTimeFieldProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  dateOnly?: boolean;
}
export function dateTimeInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function DateTimeField({ value, onChange, dateOnly }: DateTimeFieldProps) {
  const format = (date: Date) => (dateOnly ? dateTimeInput(date).slice(0, 10) : dateTimeInput(date));
  const [input, setInput] = useState(value ? format(value) : '');
  useEffect(() => {
    if (value) setInput(format(value));
  }, [value?.getTime(), dateOnly]);
  return (
    <>
      <Input
        value={input}
        onChangeText={(v) => {
          setInput(v);
          onChange(parseVisitLocalDateTime(dateOnly ? v + 'T12:00' : v));
        }}
        placeholder={dateOnly ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'}
      />
      <Txt v="caption" color="muted">
        {dateOnly ? 'Date (YYYY-MM-DD)' : 'Date & time (24-hour clock)'}
      </Txt>
    </>
  );
}
