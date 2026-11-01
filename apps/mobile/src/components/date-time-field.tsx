import { useEffect, useState } from 'react';
import { parseVisitLocalDateTime } from '@brokeriq/shared';
import { Input, Txt } from '@/ui';
export interface DateTimeFieldProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
}
export function dateTimeInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function DateTimeField({ value, onChange }: DateTimeFieldProps) {
  const [input, setInput] = useState(value ? dateTimeInput(value) : '');
  useEffect(() => {
    if (value) setInput(dateTimeInput(value));
  }, [value?.getTime()]);
  return (
    <>
      <Input
        value={input}
        onChangeText={(v) => {
          setInput(v);
          onChange(parseVisitLocalDateTime(v));
        }}
        placeholder="YYYY-MM-DDTHH:mm"
      />
      <Txt v="caption" color="muted">
        Date & time (24-hour clock)
      </Txt>
    </>
  );
}
