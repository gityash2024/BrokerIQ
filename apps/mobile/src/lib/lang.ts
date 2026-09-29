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
