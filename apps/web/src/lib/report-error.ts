'use client';
import { API_URL } from './utils';

/** Web app version sent with error reports (matches apps/web/package.json). */
const WEB_VERSION = '2.0.0';
const MAX_PER_PAGE = 10;
const sent = new Set<string>();

/**
 * Sends a crash/unexpected error to the API (Admin → Health → Errors). Each distinct error is sent once
 * per page load, at most 10 per load, and failures to report are ignored.
 */
export function reportClientError(error: unknown, extra?: { digest?: string }) {
  if (typeof window === 'undefined') return;
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
  const message = `${e.message || 'Unknown error'}${extra?.digest ? ` (digest ${extra.digest})` : ''}`.slice(0, 1000);
  const key = `${message}|${location.pathname}`;
  if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
  sent.add(key);
  const body = JSON.stringify({ source: 'WEB', message, stack: e.stack?.slice(0, 8000) ?? null, route: location.pathname, appVersion: WEB_VERSION });
  fetch(`${API_URL}/api/public/client-errors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(
    () => undefined,
  );
}

/** Catches errors outside React (event handlers, async code, failed promises). */
export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined' || (window as { __biqErrors?: boolean }).__biqErrors) return;
  (window as { __biqErrors?: boolean }).__biqErrors = true;
  window.addEventListener('error', (ev) => {
    // Ignore failed script/image loads from extensions/ad blockers — only real JS errors.
    if (ev.error) reportClientError(ev.error);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    // API errors are already shown to the user and logged by the API itself.
    if (r && typeof r === 'object' && 'status' in r) return;
    reportClientError(r instanceof Error ? r : new Error(String(r)));
  });
}
