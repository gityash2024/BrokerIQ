// Titles and map permalinks from ABC Buildcon's public sector map directory.
import { GURUGRAM_SECTOR_MAPS_URL, googleDirections, googleMapSearch, isDirectionsLink } from './map-directions';

const refs: readonly (readonly [name: string, slug: string])[] = [
  ['Anant Raj', 'anant-raj'],
  ['Dharuhera Master Plan', 'dharuhera-master-plan'],
  ['DLF Alameda', 'dlf-alameda'],
  ['DLF Garden City', 'dlf-garden-city'],
  ['DLF Phase I', 'dlf-phase-i'],
  ['DLF Phase II', 'dlf-phase-ii'],
  ['DLF Phase III', 'dlf-phase-iii'],
  ['DLF Phase IV', 'dlf-phase-iv'],
  ['DLF Phase V', 'dlf-phase-v'],
  ['Emerald Floors', 'emerald-floors'],
  ['Green Wood City', 'green-wood-city'],
  ['Gurgaon Master Plan', 'gurgaon-master-plan'],
  ['Malibu Town', 'malibu-town'],
  ['Manesar Master Plan', 'manesar-master-plan'],
  ['Mayfield Garden', 'mayfield-garden'],
  ['Nirvana Country', 'nirvana-country'],
  ['Pace City - I', 'pace-city---i'],
  ['Pace City - II', 'pace-city---ii'],
  ['Palam Vihar', 'palam-vihar'],
  ['Pataudi Master Plan', 'pataudi-master-plan'],
  ['Raheja Aranya City', 'raheja-aranya-city'],
  ['Rosewood City', 'rosewood-city'],
  ['Saraswati Vihar', 'saraswati-vihar'],
  ['Sector 10', 'sector-10'],
  ['Sector 102 - BPTP Amstoria', 'sector-102---bptp-amstoria'],
  ['Sector 10A', 'sector-10a'],
  ['Sector 12A', 'sector-12a'],
  ['Sector 14', 'sector-14'],
  ['Sector 15-I', 'sector-15-i'],
  ['Sector 15-II', 'sector-15-ii'],
  ['Sector 17', 'sector-17'],
  ['Sector 21', 'sector-21'],
  ['Sector 22', 'sector-22'],
  ['Sector 23', 'sector-23'],
  ['Sector 23A', 'sector-23a'],
  ['Sector 27 & 28', 'sector-27-and-28'],
  ['Sector 29', 'sector-29'],
  ['Sector 31', 'sector-31'],
  ['Sector 31 & 32 A', 'sector-31-and-32-a'],
  ['Sector 32, 33 & 34', 'sector-32-33-and-34'],
  ['Sector 34', 'sector-34'],
  ['Sector 38', 'sector-38'],
  ['Sector 39', 'sector-39'],
  ['Sector 4 & 7', 'sector-4-and-7'],
  ['Sector 40', 'sector-40'],
  ['Sector 42', 'sector-42'],
  ['Sector 43', 'sector-43'],
  ['Sector 44', 'sector-44'],
  ['Sector 45', 'sector-45'],
  ['Sector 46', 'sector-46'],
  ['Sector 47', 'sector-47'],
  ['Sector 5', 'sector-5'],
  ['Sector 51', 'sector-51'],
  ['Sector 52', 'sector-52'],
  ['Sector 57', 'sector-57'],
  ['Sector 60 -  Ireo City', 'sector-60---ireo-city'],
  ['Sector 67 Esencia', 'sector-67-esencia'],
  ['Sector 7', 'sector-7'],
  ['Sector 9', 'sector-9'],
  ['Sector 9A', 'sector-9a'],
  ['Sohna Master Plan', 'sohna-master-plan'],
  ['South City - I', 'south-city---i'],
  ['South City - II', 'south-city---ii'],
  ['Sun City', 'sun-city'],
  ['Sushant Lok - I', 'sushant-lok---i'],
  ['Sushant Lok - II', 'sushant-lok---ii'],
  ['Sushant Lok - III', 'sushant-lok---iii'],
  ['Udyog Vihar', 'udyog-vihar'],
  ['Uppals Southend', 'uppals-southend'],
  ['Vatika City - I', 'vatika-city---i'],
  ['Vatika City - II', 'vatika-city---ii'],
  ['Vatika City - III', 'vatika-city---iii'],
  ['Vatika City - IV', 'vatika-city---iv'],
  ['Vatika City - V', 'vatika-city---v'],
  ['Vatika Sector 82 Map', 'vatika-sector-82-map'],
];

const normalizeArea = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function gurugramSectorMaps(search: string) {
  const term = normalizeArea(search);
  return refs.filter(([name]) => normalizeArea(name).includes(term)).map(([name, slug]) => ({ name, url: `${GURUGRAM_SECTOR_MAPS_URL}/${slug}` }));
}

export function gurugramSectorMap(sector: string) {
  const term = normalizeArea(sector.trim().replace(/^(?:sec\.?\s+(?=\d)|(?=\d))/i, 'Sector '));
  const match = refs.find(([name]) => normalizeArea(name) === term);
  return match ? `${GURUGRAM_SECTOR_MAPS_URL}/${match[1]}` : null;
}

export function inventoryNavigation(item: { sector?: string | null; address?: string | null; houseNo?: string | null; directionsUrl?: string | null }) {
  const sector = item.sector?.trim();
  const sectorMap = sector ? gurugramSectorMap(sector) : null;
  const street = item.address?.trim() || (sector ? item.houseNo?.trim() : undefined);
  const saved = item.directionsUrl?.trim();
  const exact = saved && isDirectionsLink(saved) ? saved : null;
  const destination = [street, sector && !street?.toLowerCase().includes(sector.toLowerCase()) ? sector : null].filter(Boolean).join(', ');
  const search = destination ? (/gurgaon|gurugram/i.test(destination) ? destination : `${destination}, Gurugram`) : null;
  return {
    route: exact ?? (street && search ? googleDirections(search) : null),
    exact: Boolean(exact),
    sectorMap,
    pinSearch: search ? googleMapSearch(search) : null,
  };
}
