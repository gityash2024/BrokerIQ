import * as SecureStore from 'expo-secure-store';
import { LANGUAGE_CODES, type LanguageCode } from '@brokeriq/shared';
import { create } from './store';

/** Selected UI language (persisted); also sent to the AI assistant. */
const KEY = 'biq.lang';
export const useLang = create<{ lang: LanguageCode; ready: boolean; setLang: (l: LanguageCode) => void }>((set) => ({
  lang: 'en',
  ready: false,
  setLang: (lang) => {
    set({ lang });
    SecureStore.setItemAsync(KEY, lang).catch(() => undefined);
  },
}));

export async function loadLang() {
  const saved = (await SecureStore.getItemAsync(KEY).catch(() => null)) as LanguageCode | null;
  useLang.setState({ lang: saved && LANGUAGE_CODES.includes(saved) ? saved : 'en', ready: true });
}
