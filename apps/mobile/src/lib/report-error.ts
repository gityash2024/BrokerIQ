import Constants from 'expo-constants';
import { API_URL } from './api';

const MAX_PER_SESSION = 20;
const sent = new Set<string>();

/** Sends an app crash / unexpected error to the API (Admin → Health → Errors). Never throws. */
export function reportAppError(error: unknown, route?: string) {
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
  const message = (e.message || 'Unknown error').slice(0, 1000);
  const key = `${message}|${route ?? ''}`;
  if (sent.has(key) || sent.size >= MAX_PER_SESSION) return;
  sent.add(key);
  fetch(`${API_URL}/public/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'MOBILE',
      message,
      stack: e.stack?.slice(0, 8000) ?? null,
      route: route ?? null,
      appVersion: Constants.expoConfig?.version ?? null,
    }),
  }).catch(() => undefined);
}

/** JS errors outside React rendering (callbacks, timers). Keeps React Native's default handler (red box / crash). */
export function installGlobalErrorHandler() {
  const g = globalThis as {
    ErrorUtils?: { getGlobalHandler: () => (e: Error, fatal?: boolean) => void; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void };
    __biqErr?: boolean;
  };
  if (!g.ErrorUtils || g.__biqErr) return;
  g.__biqErr = true;
  const prev = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((e, fatal) => {
    reportAppError(e, fatal ? 'fatal' : undefined);
    prev(e, fatal);
  });
}
