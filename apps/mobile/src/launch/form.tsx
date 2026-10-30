import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { Txt, Sheet } from '@/ui';
import { useTheme } from '@/lib/theme';
export function ChoiceField({
  label,
  value,
  choices,
  onChange,
  emptyLabel = 'Not recorded',
  labels,
}: {
  label: string;
  value?: string | null;
  choices: string[];
  onChange: (v: string | null) => void;
  emptyLabel?: string;
  labels?: Record<string, string>;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const display = (option: string | null) => (option ? (labels?.[option] ?? option.replace(/_/g, ' ')) : emptyLabel);
  return (
    <View style={{ gap: 6 }}>
      <Txt v="caption" color="muted">
        {label}
      </Txt>
      <Pressable
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 50,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: c.line,
          borderRadius: 14,
          paddingHorizontal: 14,
          backgroundColor: c.surface,
        }}
      >
        <Txt style={{ flex: 1 }} color={value ? 'fg' : 'muted'}>
          {display(value ?? null)}
        </Txt>
        <ChevronDown size={16} color={c.muted} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        {[null, ...choices].map((option) => (
          <Pressable
            key={option ?? 'unknown'}
            onPress={() => {
              onChange(option);
              setOpen(false);
            }}
            style={{ padding: 15, minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: c.line }}
          >
            <Txt>{display(option)}</Txt>
            {value === option && <Check size={19} color={c.brand} />}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
