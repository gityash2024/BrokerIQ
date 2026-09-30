import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { LANGUAGE_CODES, type LanguageCode } from '@brokeriq/shared';
import { create } from './store';

/** Selected UI language (persisted; null = original Hindi/English mix); also sent to the AI assistant. */
const KEY = 'biq.lang';
export const useLang = create<{ lang: LanguageCode | null; ready: boolean; setLang: (l: LanguageCode | null) => void }>((set) => ({
  lang: null,
  ready: false,
  setLang: (lang) => {
    set({ lang });
    (lang ? SecureStore.setItemAsync(KEY, lang) : SecureStore.deleteItemAsync(KEY)).catch(() => undefined);
  },
}));

export async function loadLang() {
  const saved = (await SecureStore.getItemAsync(KEY).catch(() => null)) as LanguageCode | null;
  useLang.setState({ lang: saved && LANGUAGE_CODES.includes(saved) ? saved : null, ready: true });
}

/** Device language (e.g. "ta_IN" / "ta-IN" → "ta"), from the OS settings; no extra native module. */
export function deviceLanguage(): LanguageCode | null {
  let tag = '';
  try {
    tag = (I18nManager as unknown as { getConstants?: () => { localeIdentifier?: string } }).getConstants?.().localeIdentifier ?? '';
  } catch {}
  if (!tag) {
    try {
      tag = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {}
  }
  const code = tag.toLowerCase().split(/[-_]/)[0] as LanguageCode;
  return LANGUAGE_CODES.includes(code) ? code : null;
}

/**
 * Suggest the phone's language once. Skipped when the user already picked a language, and for
 * English/Hindi phones — the default interface is already Hindi + English.
 */
const PROMPTED = 'biq.lang.prompted';
export async function languageToSuggest(): Promise<LanguageCode | null> {
  if (useLang.getState().lang) return null;
  if (await SecureStore.getItemAsync(PROMPTED).catch(() => null)) return null;
  const code = deviceLanguage();
  if (!code || code === 'en' || code === 'hi') return null;
  return code;
}
export const markLanguagePrompted = () => SecureStore.setItemAsync(PROMPTED, '1').catch(() => undefined);
