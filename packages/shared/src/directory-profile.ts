import { z } from 'zod';
const factLabels: Record<string, string> = {
  landArea: 'Project land area · As filed',
  permissibleFar: 'Permissible FAR · As filed',
  proposedFar: 'Proposed FAR · As filed',
  licensedArea: 'Licensed area · As filed',
  licenseNumber: 'DTCP licence',
  layoutApproval: 'Layout approval date · As filed',
  buildingPlanApproval: 'Building-plan approval · As filed',
  constructionStart: 'Planned construction start · As filed',
  plannedCompletion: 'Planned completion · As filed',
  building: 'Building classification',
  'building:levels': 'Above-ground levels',
  'building:levels:underground': 'Underground levels',
  'building:flats': 'Number of flats · Source tag',
  height: 'Building height · Source tag',
  'building:material': 'Building material',
  'building:use': 'Building use',
  wheelchair: 'Wheelchair access · Source tag',
  website: 'Project website · Source tag',
  start_date: 'Start date · Source tag',
  operator: 'Operator · Source tag',
  'addr:postcode': 'Postcode',
};
export const directoryTableNames: Record<string, string> = {
  unitMix: 'Apartment / unit mix · As filed',
  approvals: 'Statutory approvals · As filed',
  specifications: 'Construction specifications · As filed',
  facilities: 'Planned services & facilities · As filed',
};
export const directoryEnrichmentSchema = z.object({
  version: z.literal(1),
  sourceUrl: z.string().max(2000),
  fetchedAt: z.string().max(80),
  sourceHash: z.string().max(128).optional(),
  facts: z.record(z.string(), z.string().max(1000)),
  tables: z
    .array(z.object({ key: z.enum(['unitMix', 'approvals', 'specifications', 'facilities']), rows: z.array(z.array(z.string().max(1000)).max(5)).max(100) }))
    .max(4),
  photos: z
    .array(
      z.object({
        url: z.string().max(2000),
        sourceUrl: z.string().max(2000),
        caption: z.string().max(300),
        author: z.string().max(200),
        license: z.string().max(100),
        licenseUrl: z.string().max(2000),
        capturedAt: z.string().max(80).optional(),
      }),
    )
    .max(12),
  attribution: z.string().max(300).optional(),
});
export type DirectoryRecord = {
  id: string;
  name: string;
  provider: string;
  externalId?: string;
  builderName?: string | null;
  address?: string | null;
  sector?: string | null;
  city?: string;
  category?: string;
  categoryEvidence?: string | null;
  registrationNumber?: string | null;
  registrationStatus?: string | null;
  registrationUntil?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coordinateSource?: string | null;
  sourceUrl: string;
  sourceFetchedAt: string;
  metadata?: unknown;
};
export const directorySafeUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
};
export function directoryProfile(record: DirectoryRecord) {
  const metadata = record.metadata && typeof record.metadata === 'object' ? (record.metadata as Record<string, unknown>) : {};
  const parsed = directoryEnrichmentSchema.safeParse(metadata.enrichment),
    enrichment = parsed.success ? parsed.data : null;
  const facts = Object.entries(enrichment?.facts ?? {})
    .filter(([key]) => key in factLabels)
    .map(([key, value]) => ({ key, label: factLabels[key], value }));
  for (const [key, label] of [
    ['purpose', 'Licensed use'],
    ['caseNumber', 'Licence case number'],
    ['town', 'Source planning area'],
  ] as const) {
    if (typeof metadata[key] === 'string' && metadata[key]) facts.push({ key, label, value: metadata[key] as string });
  }
  return {
    facts,
    tables: enrichment?.tables.map((table) => ({ ...table, title: directoryTableNames[table.key], rows: table.rows.filter((row) => row.length >= 2) })) ?? [],
    photos:
      enrichment?.photos.filter((photo) => !!directorySafeUrl(photo.url) && !!directorySafeUrl(photo.sourceUrl) && !!directorySafeUrl(photo.licenseUrl)) ?? [],
    sourceUrl: directorySafeUrl(record.sourceUrl),
    enrichmentUrl: directorySafeUrl(enrichment?.sourceUrl),
    enrichedAt: enrichment?.fetchedAt,
    note: [metadata.classificationNote, metadata.mapPointMeaning].filter((value) => typeof value === 'string').join(' '),
    attribution: typeof metadata.attribution === 'string' ? metadata.attribution : enrichment?.attribution,
  };
}
