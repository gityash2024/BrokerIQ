import type { LocalityListItem } from '@brokeriq/shared';

type Locality = Pick<LocalityListItem, 'name' | 'city' | 'latitude' | 'longitude'>;
type Coordinates = { latitude: number; longitude: number; accuracy?: number | null };

export function shiftLocationAddress(address: string | null | undefined, point?: Coordinates, localities: readonly Locality[] = []) {
  if (address?.trim()) return address.trim();
  if (!point) return null;
  let nearby: Locality | undefined;
  // Locality records have center points, so describe proximity only.
  let nearestDistance = 1_000;
  for (const locality of localities) {
    if (!Number.isFinite(locality.latitude) || !Number.isFinite(locality.longitude)) continue;
    const distance = Math.hypot(
      (point.latitude - locality.latitude) * 111_195,
      (point.longitude - locality.longitude) * 111_195 * Math.cos((point.latitude * Math.PI) / 180),
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearby = locality;
    }
  }
  return nearby ? `Near ${nearby.name}, ${nearby.city}` : 'Address unavailable';
}

export function shiftLocationMapUrl({ latitude, longitude }: Coordinates) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${latitude},${longitude}`);
}
