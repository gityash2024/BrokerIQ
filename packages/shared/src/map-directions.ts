import { z } from 'zod';

export const GURUGRAM_SECTOR_MAPS_URL = 'https://www.abcbuildcon.in/maps';

export function isDirectionsLink(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (url.hostname === 'maps.app.goo.gl') return /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (url.hostname === 'goo.gl') return /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (url.hostname === 'maps.apple.com') return url.pathname === '/' || /^\/(place|directions)\/?$/.test(url.pathname);
    if (['www.google.com', 'maps.google.com', 'www.google.co.in', 'maps.google.co.in'].includes(url.hostname)) {
      return /^\/maps(?:\/|$)/.test(url.pathname) || (url.hostname.startsWith('maps.') && url.pathname === '/' && url.searchParams.has('q'));
    }
    return false;
  } catch {
    return false;
  }
}

export const directionsLinkSchema = z.string().trim().max(2000).refine(isDirectionsLink, 'Paste an HTTPS Google Maps or Apple Maps location link');

export function googleDirections(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Accept a map link or a pair copied from a confirmed map pin. */
export function normalizeInventoryDirections(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const pair = /^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/.exec(text);
  if (!pair) return text;
  const latitude = Number(pair[1]);
  const longitude = Number(pair[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? googleDirections(`${latitude},${longitude}`) : text;
}

/** A one-time device fix for a property, with the accuracy reported by the platform in metres. */
export function surveyLocationLink({ latitude, longitude, accuracy }: { latitude: number; longitude: number; accuracy: number | null }): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error('This device did not return a valid location. Try again or enter a map link.');
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50)
    throw new Error('Location is too approximate for a property pin. Enable precise location, move outdoors, or enter a map link.');
  return googleDirections(`${Number(latitude.toFixed(6))},${Number(longitude.toFixed(6))}`);
}

export function googleMapSearch(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
