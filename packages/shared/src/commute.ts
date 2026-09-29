/**
 * "Office के पास घर": approximate commute from a listing to a Gurgaon office hub by car and by
 * metro (Yellow line + Rapid Metro). Coordinates are real public data from OpenStreetMap.
 * Times are estimates for peak hours, always labelled "अनुमानित" in the UI.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export type MetroLine = 'YELLOW' | 'RAPID' | 'AIRPORT';

export interface MetroStation extends GeoPoint {
  name: string;
  line: MetroLine;
}

/** Gurgaon metro stations (+ Aerocity) — OpenStreetMap. Sikanderpur is the Yellow ↔ Rapid interchange. */
export const METRO_STATIONS: MetroStation[] = [
  { name: 'Millennium City Centre', line: 'YELLOW', lat: 28.4593429, lng: 77.0726571 },
  { name: 'IFFCO Chowk', line: 'YELLOW', lat: 28.4723277, lng: 77.0724222 },
  { name: 'MG Road', line: 'YELLOW', lat: 28.4795543, lng: 77.0798926 },
  { name: 'Sikanderpur', line: 'YELLOW', lat: 28.4812716, lng: 77.0930017 },
  { name: 'Guru Dronacharya', line: 'YELLOW', lat: 28.4820212, lng: 77.1022685 },
  { name: 'Arjan Garh', line: 'YELLOW', lat: 28.4807352, lng: 77.1257622 },
  { name: 'Ghitorni', line: 'YELLOW', lat: 28.493751, lng: 77.1491866 },
  { name: 'Sikanderpur (Rapid)', line: 'RAPID', lat: 28.4809969, lng: 77.0944367 },
  { name: 'DLF Phase 2', line: 'RAPID', lat: 28.4875596, lng: 77.0929909 },
  { name: 'Belvedere Towers', line: 'RAPID', lat: 28.4917023, lng: 77.0881318 },
  { name: 'Cyber City', line: 'RAPID', lat: 28.4980703, lng: 77.0892567 },
  { name: 'Moulsari Avenue', line: 'RAPID', lat: 28.5007775, lng: 77.0946306 },
  { name: 'DLF Phase 3', line: 'RAPID', lat: 28.4935677, lng: 77.093661 },
  { name: 'DLF Phase 1', line: 'RAPID', lat: 28.4714258, lng: 77.0939606 },
  { name: 'Sector 42-43', line: 'RAPID', lat: 28.4574254, lng: 77.0969529 },
  { name: 'Sector 53-54', line: 'RAPID', lat: 28.4463829, lng: 77.1004632 },
  { name: 'Sector 54 Chowk', line: 'RAPID', lat: 28.4329768, lng: 77.1048971 },
  { name: 'Sector 55-56', line: 'RAPID', lat: 28.4233556, lng: 77.1051327 },
  { name: 'Delhi Aerocity', line: 'AIRPORT', lat: 28.5487786, lng: 77.1207949 },
];

export interface OfficeHub extends GeoPoint {
  key: string;
  name: string;
}

/** Main office clusters — OpenStreetMap / Nominatim. */
export const OFFICE_HUBS: OfficeHub[] = [
  { key: 'cyber-city', name: 'Cyber City', lat: 28.4973098, lng: 77.091798 },
  { key: 'udyog-vihar', name: 'Udyog Vihar', lat: 28.4971745, lng: 77.0813511 },
  { key: 'golf-course-road', name: 'Golf Course Road', lat: 28.4574254, lng: 77.0969529 },
  { key: 'mg-road', name: 'MG Road', lat: 28.4795543, lng: 77.0798926 },
  { key: 'iffco-chowk', name: 'IFFCO Chowk', lat: 28.4723277, lng: 77.0724222 },
  { key: 'sector-44', name: 'Sector 44', lat: 28.4507064, lng: 77.0738281 },
  { key: 'sector-29', name: 'Sector 29', lat: 28.4669197, lng: 77.0671306 },
  { key: 'sohna-road', name: 'Sohna Road', lat: 28.406116, lng: 77.0434698 },
  { key: 'golf-course-extension', name: 'Golf Course Extension', lat: 28.4090032, lng: 77.0658498 },
  { key: 'manesar', name: 'IMT Manesar', lat: 28.3671851, lng: 76.920669 },
  { key: 'aerocity', name: 'Aerocity', lat: 28.5487786, lng: 77.1207949 },
];

export const officeHub = (key?: string | null) => OFFICE_HUBS.find((h) => h.key === key) ?? null;

export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Peak-hour assumptions.
const ROAD_FACTOR = 1.35; // road distance / straight-line distance
const CAR_KMPH = 22;
const CAR_OVERHEAD_MIN = 6;
const WALK_MIN_PER_KM = 13;
const AUTO_KMPH = 16;
const METRO_KMPH = 30;
const METRO_WAIT_MIN = 5;
const INTERCHANGE_MIN = 8;
const MAX_ACCESS_KM = 3;

/** Getting to/from a station: walk if close, else an auto-rickshaw. */
function accessMin(km: number) {
  return km <= 1 ? km * WALK_MIN_PER_KM : ((km * ROAD_FACTOR) / AUTO_KMPH) * 60 + 4;
}

function nearestStation(p: GeoPoint) {
  let best: { s: MetroStation; km: number } | null = null;
  for (const s of METRO_STATIONS) {
    const km = haversineKm(p, s);
    if (!best || km < best.km) best = { s, km };
  }
  return best!;
}

export interface CommuteEstimate {
  carMin: number;
  metroMin: number | null;
  bestMin: number;
  mode: 'car' | 'metro';
  km: number;
}

export function estimateCommute(from: GeoPoint, to: GeoPoint): CommuteEstimate {
  const km = haversineKm(from, to);
  const carMin = Math.round(((km * ROAD_FACTOR) / CAR_KMPH) * 60 + CAR_OVERHEAD_MIN);
  let metroMin: number | null = null;
  const a = nearestStation(from);
  const b = nearestStation(to);
  if (a.km <= MAX_ACCESS_KM && b.km <= MAX_ACCESS_KM && a.s.name !== b.s.name) {
    const ride = ((haversineKm(a.s, b.s) * 1.2) / METRO_KMPH) * 60 + 2;
    const change = a.s.line !== b.s.line ? INTERCHANGE_MIN : 0;
    metroMin = Math.round(accessMin(a.km) + METRO_WAIT_MIN + ride + change + accessMin(b.km));
  }
  const mode = metroMin != null && metroMin < carMin ? 'metro' : 'car';
  return { carMin, metroMin, bestMin: mode === 'metro' ? metroMin! : carMin, mode, km: Math.round(km * 10) / 10 };
}

/** Straight-line radius (km) worth checking for a max commute (used to pre-filter by bounding box). */
export function commuteRadiusKm(maxMin: number) {
  return Math.max(3, ((maxMin - CAR_OVERHEAD_MIN) / 60) * CAR_KMPH) / ROAD_FACTOR + 2;
}
