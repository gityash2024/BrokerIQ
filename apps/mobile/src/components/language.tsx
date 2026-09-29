import { useState } from 'react';
import { Text, View } from 'react-native';
import { Check, Languages } from 'lucide-react-native';
import { LANGUAGES, languageOf, type LanguageCode } from '@brokeriq/shared';
import { useLang } from '../lib/lang';
import { fonts, useTheme } from '../lib/theme';
import { PressableScale, Sheet } from '../ui';

/** Language names are shown in their own script, so they are rendered with plain Text (never translated). */
export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const options: { code: LanguageCode | null; native: string; name: string }[] = [{ code: null, native: 'Default', name: 'हिंग्लिश (original)' }, ...LANGUAGES.map((l) => ({ code: l.code, native: l.native, name: l.name }))];
  return (
    <Sheet open={open} onClose={onClose} title="भाषा चुनें">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {options.map((o) => {
          const on = lang === o.code;
          return (
            <PressableScale
              key={o.code ?? 'default'}
              onPress={() => {
                setLang(o.code);
                onClose();
              }}
              style={{ width: '48%', flexGrow: 1, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: on ? c.brand : c.line, backgroundColor: on ? c.brandSoft : c.surface, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.fg }}>{o.native}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: c.muted }}>{o.name}</Text>
              </View>
              {on && <Check size={18} color={c.brand} />}
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}

/** Current language + a sheet to change it. `render` gets the current label and an opener. */
export function LanguageSwitch({ render }: { render: (label: string, open: () => void) => React.ReactNode }) {
  const lang = useLang((s) => s.lang);
  const [open, setOpen] = useState(false);
  return (
    <>
      {render(lang ? languageOf(lang).native : 'Default', () => setOpen(true))}
      <LanguageSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Compact pill for dark/hero headers (onboarding, login). */
export function LanguagePill({ light }: { light?: boolean }) {
  const { c } = useTheme();
  const col = light ? '#fff' : c.fg;
  return (
    <LanguageSwitch
      render={(label, open) => (
        <PressableScale onPress={open} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 999, borderWidth: 1, borderColor: light ? 'rgba(255,255,255,0.35)' : c.line }}>
          <Languages size={15} color={col} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: col }}>{label}</Text>
        </PressableScale>
      )}
    />
  );
}
