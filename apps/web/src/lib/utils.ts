import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://brokeriqapi.mymultimeds.com').replace(/\/$/, '');
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://brokeriq.mymultimeds.com').replace(/\/$/, '');

/** On-the-fly resize for Cloudinary and self-hosted (/api/media) URLs; no-op for other hosts. */
export function img(url: string | null | undefined, w = 800): string {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', `/upload/w_${w},c_limit,q_auto,f_auto/`);
  }
  if (url.includes('/api/media/f/') && !url.includes('?')) {
    const width = [320, 480, 800, 1200].find((x) => x >= w);
    return width ? `${url}?w=${width}` : url;
  }
  return url;
}

export function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function formatDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
}

export function formatDateTime(d: string | Date | null | undefined) {
  return formatDate(d, { dateStyle: 'medium', timeStyle: 'short' });
}

export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
