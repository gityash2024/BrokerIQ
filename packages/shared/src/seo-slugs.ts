/**
 * Programmatic SEO landing pages: /rent/<slug>, e.g.
 *   2-bhk-furnished-flats-for-rent-in-sector-54
 *   pg-for-rent-in-sohna-road
 *   flats-for-rent-in-golf-course-road
 * build ↔ parse must round-trip; unknown slugs return null (→ 404).
 */
export interface SeoCombo {
  bedrooms?: number | null;
  furnishing?: 'FULLY_FURNISHED' | 'SEMI_FURNISHED' | 'UNFURNISHED' | null;
  kind: 'flats' | 'pg' | 'builder-floors' | 'houses';
  localitySlug: string;
}

const FURNISH_SLUG: Record<string, NonNullable<SeoCombo['furnishing']>> = {
  furnished: 'FULLY_FURNISHED',
  'semi-furnished': 'SEMI_FURNISHED',
  unfurnished: 'UNFURNISHED',
};
const FURNISH_OUT: Record<NonNullable<SeoCombo['furnishing']>, string> = {
  FULLY_FURNISHED: 'furnished',
  SEMI_FURNISHED: 'semi-furnished',
  UNFURNISHED: 'unfurnished',
};

/** Property types each landing-page kind covers. */
export const SEO_KIND_TYPES: Record<SeoCombo['kind'], string[]> = {
  flats: ['APARTMENT', 'STUDIO', 'SERVICE_APARTMENT', 'PENTHOUSE'],
  pg: ['PG'],
  'builder-floors': ['BUILDER_FLOOR'],
  houses: ['INDEPENDENT_HOUSE', 'VILLA'],
};

const KIND_LABEL: Record<SeoCombo['kind'], string> = { flats: 'Flats', pg: 'PG', 'builder-floors': 'Builder Floors', houses: 'Houses & Villas' };

export function buildSeoSlug(c: SeoCombo): string {
  const parts: string[] = [];
  if (c.bedrooms && c.kind !== 'pg') parts.push(`${c.bedrooms}-bhk`);
  if (c.furnishing && c.kind !== 'pg') parts.push(FURNISH_OUT[c.furnishing]);
  parts.push(c.kind, 'for-rent-in', c.localitySlug);
  return parts.join('-');
}

export function parseSeoSlug(slug: string): SeoCombo | null {
  const m = slug.toLowerCase().match(/^(?:(\d)-bhk-)?(?:(furnished|semi-furnished|unfurnished)-)?(flats|pg|builder-floors|houses)-for-rent-in-([a-z0-9-]+)$/);
  if (!m) return null;
  const [, bhk, furnish, kind, localitySlug] = m;
  const combo: SeoCombo = {
    kind: kind as SeoCombo['kind'],
    localitySlug,
    bedrooms: bhk ? Number(bhk) : null,
    furnishing: furnish ? FURNISH_SLUG[furnish] : null,
  };
  if (combo.kind === 'pg' && (combo.bedrooms || combo.furnishing)) return null;
  if (combo.bedrooms != null && (combo.bedrooms < 1 || combo.bedrooms > 5)) return null;
  return buildSeoSlug(combo) === slug.toLowerCase() ? combo : null;
}

/** "2 BHK Furnished Flats for Rent in Sector 54, Gurgaon" */
export function seoTitle(c: SeoCombo, localityName: string): string {
  const furnish = c.furnishing
    ? `${FURNISH_OUT[c.furnishing].replace(/(^|-)(\w)/g, (_, a, b) => `${a ? ' ' : ''}${b.toUpperCase()}`).replace('Semi Furnished', 'Semi-furnished')} `
    : '';
  return `${c.bedrooms && c.kind !== 'pg' ? `${c.bedrooms} BHK ` : ''}${furnish}${KIND_LABEL[c.kind]} for Rent in ${localityName}, Gurgaon`;
}
