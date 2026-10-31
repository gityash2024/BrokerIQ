import { useEffect, useState } from 'react';

/**
 * High-performance reverse geocoding utility for agent live locations.
 * Uses client-side caching (in-memory + localStorage) with ~100m grid rounding.
 */

export interface GeocodedLocation {
  locality: string;
  city: string;
  state: string;
  pincode?: string;
  shortAddress: string;
  fullAddress: string;
}

const memoryCache = new Map<string, GeocodedLocation>();

function cacheKey(lat: number, lng: number): string {
  // Round to ~100 meters (3 decimal places)
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedLocation> {
  const key = cacheKey(lat, lng);

  // 1. In-memory hit
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }

  // 2. localStorage hit
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`biq_geo_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as GeocodedLocation;
        memoryCache.set(key, parsed);
        return parsed;
      }
    } catch {}
  }

  // 3. Fetch from Nominatim OpenStreetMap (free, accurate for India)
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const suburb = addr.suburb || addr.neighbourhood || addr.residential || addr.road || '';
      const city = addr.city || addr.town || addr.city_district || addr.county || 'Gurugram';
      const state = addr.state || 'Haryana';
      const pincode = addr.postcode || '';

      const parts = [suburb, city, state].filter(Boolean);
      const shortAddress = parts.slice(0, 2).join(', ') || city;
      const fullAddress = data.display_name || parts.join(', ');

      const result: GeocodedLocation = {
        locality: suburb || city,
        city,
        state,
        pincode,
        shortAddress,
        fullAddress,
      };

      memoryCache.set(key, result);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`biq_geo_${key}`, JSON.stringify(result));
        } catch {}
      }
      return result;
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode error, falling back to BigDataCloud:', err);
  }

  // 4. Fallback to BigDataCloud client API
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || data.city || '';
      const city = data.city || 'Gurugram';
      const state = data.principalSubdivision || 'Haryana';
      const shortAddress = [locality, city].filter(Boolean).join(', ') || city;

      const result: GeocodedLocation = {
        locality: locality || city,
        city,
        state,
        shortAddress,
        fullAddress: `${shortAddress}, ${state}, ${data.countryName || 'India'}`,
      };

      memoryCache.set(key, result);
      return result;
    }
  } catch {}

  // 5. Default fallback to coordinates
  const fallback: GeocodedLocation = {
    locality: 'फील्ड लोकेशन',
    city: 'Gurugram',
    state: 'Haryana',
    shortAddress: `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
    fullAddress: `Coordinates: ${lat}, ${lng}`,
  };
  return fallback;
}

export function useReverseGeocode(lat?: number | null, lng?: number | null) {
  const [location, setLocation] = useState<GeocodedLocation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) {
      setLocation(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    reverseGeocode(lat, lng)
      .then((loc) => {
        if (!cancelled) {
          setLocation(loc);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return { location, loading };
}

