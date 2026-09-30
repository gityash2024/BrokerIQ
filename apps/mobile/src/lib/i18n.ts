import { useMemo, type ReactNode } from 'react';
import { Alert, type AlertButton, type AlertOptions } from 'react-native';
import { languageOf, localizeDates, makeTranslator, type Dictionary, type LanguageCode, type Translator } from '@brokeriq/shared';
import { useLang } from './lang';

/**
 * UI translation for the app. `null` language = the original interface (unchanged).
 * The shared primitives (Txt, Button, Input, Chip, Header …) translate their text, so
 * screens need no changes; `tr()` covers non-component places (Alert, toast).
 */
const DICTS: Record<LanguageCode, Dictionary> = {
  en: require('@brokeriq/shared/dist/i18n/locales/en.json'),
  hi: require('@brokeriq/shared/dist/i18n/locales/hi.json'),
  bn: require('@brokeriq/shared/dist/i18n/locales/bn.json'),
  mr: require('@brokeriq/shared/dist/i18n/locales/mr.json'),
  te: require('@brokeriq/shared/dist/i18n/locales/te.json'),
  ta: require('@brokeriq/shared/dist/i18n/locales/ta.json'),
  gu: require('@brokeriq/shared/dist/i18n/locales/gu.json'),
  kn: require('@brokeriq/shared/dist/i18n/locales/kn.json'),
  ml: require('@brokeriq/shared/dist/i18n/locales/ml.json'),
  or: require('@brokeriq/shared/dist/i18n/locales/or.json'),
  pa: require('@brokeriq/shared/dist/i18n/locales/pa.json'),
  as: require('@brokeriq/shared/dist/i18n/locales/as.json'),
  ur: require('@brokeriq/shared/dist/i18n/locales/ur.json'),
};
localizeDates(() => useLang.getState().lang);
const identity = Object.assign((s: string) => s, { has: () => false }) as Translator;
const cache = new Map<LanguageCode, Translator>();
export const translatorFor = (lang: LanguageCode | null): Translator => {
  if (!lang) return identity;
  let t = cache.get(lang);
  if (!t) cache.set(lang, (t = makeTranslator(DICTS[lang])));
  return t;
};

export const useT = () => {
  const lang = useLang((s) => s.lang);
  return useMemo(() => translatorFor(lang), [lang]);
};
/**
 * Urdu text runs right-to-left. Only the text direction is set (digits, ":" and "·" land on the
 * correct side); the screen layout itself is not mirrored, so no layout changes for RTL.
 */
const RTL_TEXT = { writingDirection: 'rtl' } as const;
export const useTextDir = () => useLang((s) => (s.lang && languageOf(s.lang).dir === 'rtl' ? RTL_TEXT : undefined));

/** Non-hook variant for Alert / toast / imperative code. */
export const tr = (s: string) => translatorFor(useLang.getState().lang)(s);

/**
 * Translate text children. `{count} listings` arrives as [12, ' listings'], so plain
 * string/number arrays are joined first (matches `{n} listings`); mixed content (nested
 * elements) is translated piece by piece.
 */
export function translateChildren(t: Translator, children: ReactNode): ReactNode {
  if (typeof children === 'string') return t(children);
  if (!Array.isArray(children)) return children;
  if (children.every((c) => typeof c === 'string' || typeof c === 'number')) {
    const joined = children.join('');
    return t.has(joined) ? t(joined) : children.map((c) => (typeof c === 'string' ? t(c) : c));
  }
  return children.map((c) => (typeof c === 'string' ? t(c) : c));
}

/** Alert.alert with translated title, message and button labels. */
export const alert = (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) =>
  Alert.alert(
    tr(title),
    message && tr(message),
    buttons?.map((b) => ({ ...b, text: b.text && tr(b.text) })),
    options,
  );
