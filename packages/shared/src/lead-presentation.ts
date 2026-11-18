import { readableValue } from './inventory-presentation';
import { formatPriceShort } from './utils';
import { parseRentalQuery } from './query-parser';

export type LeadEnquiry = {
  sourceDetail?: string | null;
  notes?: string | null;
  listing?: { title?: string | null; bedrooms?: number | null; furnishing?: string | null; locality?: { name: string } | null } | null;
  requirement?: {
    purpose?: string | null;
    bedrooms?: number[];
    furnishing?: string | null;
    maxBudget?: number | null;
    localityNames?: string[];
    notes?: string | null;
  } | null;
};

/** Structured requirements win. Explicit wording fills gaps in older portal enquiries. */
export function leadEnquiryOverview(lead: LeadEnquiry) {
  const requirement = lead.requirement;
  const source = [requirement?.notes, lead.notes, lead.sourceDetail, lead.listing?.title].filter(Boolean).join('\n');
  const hints = parseRentalQuery(source);
  const bedrooms = requirement?.bedrooms?.length ? requirement.bedrooms : lead.listing?.bedrooms ? [lead.listing.bedrooms] : hints.bedrooms;
  const furnishing = requirement?.furnishing || lead.listing?.furnishing || hints.furnishing;
  const location = requirement?.localityNames?.length ? requirement.localityNames.join(', ') : hints.localityText || lead.listing?.locality?.name || '';
  const summary = [
    requirement?.purpose === 'RENT' ? 'Rent' : requirement?.purpose === 'SALE' ? 'Buy' : null,
    bedrooms.length ? bedrooms.join('/') + ' BHK' : null,
    furnishing ? readableValue(furnishing) : null,
    requirement?.maxBudget ? `≤ ${formatPriceShort(requirement.maxBudget)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { location, summary };
}
