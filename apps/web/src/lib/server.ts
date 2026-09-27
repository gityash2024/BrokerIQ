import 'server-only';
import { API_URL } from './utils';

/** Server-side fetch for SEO pages (ISR). Returns null on 404. */
export async function sget<T = any>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL || API_URL}/api${path}`, { next: { revalidate } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getConfig() {
  return sget<any>('/public/config', 120);
}
