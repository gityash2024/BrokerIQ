'use client';

const KEY = 'biq_ref';
const MAX_AGE_MS = 30 * 86_400_000;

/** Remembers a friend's invite code from `?ref=` (30 days) so it survives navigation before signup. */
export function captureReferral() {
  if (typeof window === 'undefined') return;
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (!ref || !/^[A-Za-z0-9]{4,20}$/.test(ref)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ref: ref.toUpperCase(), at: Date.now() }));
  } catch {
    /* storage blocked — the code is still in the URL for this visit */
  }
}

/** The pending invite code, if any (sent with signup; the API ignores it for existing accounts). */
export function pendingReferral(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const fromUrl = new URLSearchParams(window.location.search).get('ref');
  if (fromUrl && /^[A-Za-z0-9]{4,20}$/.test(fromUrl)) return fromUrl.toUpperCase();
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { ref: string; at: number } | null;
    return v && Date.now() - v.at < MAX_AGE_MS ? v.ref : undefined;
  } catch {
    return undefined;
  }
}
