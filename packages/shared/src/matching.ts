/**
 * Requirement ↔ listing matching, shared by the API (auto-match alerts) and clients (match badges).
 * A listing "matches" when it clears the hard filters; the score orders matches (0–100).
 */
export interface MatchRequirement {
  bedrooms?: number[] | null;
  minBudget?: number | null;
  maxBudget?: number | null;
  localityIds?: string[] | null;
  furnishing?: string | null;
  propertyTypes?: string[] | null;
}

export interface MatchListing {
  bedrooms?: number | null;
  price: number;
  localityId: string;
  furnishing?: string | null;
  propertyType: string;
}

/** Budget tolerance: a listing up to 10% above the max budget still counts (people stretch). */
export const BUDGET_STRETCH = 1.1;

export function isRequirementMatch(r: MatchRequirement, l: MatchListing): boolean {
  if (r.bedrooms?.length && (l.bedrooms == null || !r.bedrooms.includes(l.bedrooms))) return false;
  if (r.maxBudget && l.price > r.maxBudget * BUDGET_STRETCH) return false;
  if (r.minBudget && l.price < r.minBudget * 0.8) return false;
  if (r.localityIds?.length && !r.localityIds.includes(l.localityId)) return false;
  if (r.propertyTypes?.length && !r.propertyTypes.includes(l.propertyType)) return false;
  if (r.furnishing && l.furnishing && r.furnishing !== l.furnishing && r.furnishing === 'FULLY_FURNISHED') return false;
  return true;
}

export function requirementMatchScore(r: MatchRequirement, l: MatchListing): number {
  let score = 50;
  if (r.localityIds?.includes(l.localityId)) score += 20;
  if (r.maxBudget && l.price <= r.maxBudget) score += 15;
  if (r.bedrooms?.length && l.bedrooms != null && r.bedrooms.includes(l.bedrooms)) score += 10;
  if (r.furnishing && l.furnishing === r.furnishing) score += 5;
  return Math.min(100, score);
}
