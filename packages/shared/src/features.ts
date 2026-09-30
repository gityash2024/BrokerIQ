/**
 * Features Super Admin can switch on/off (Admin → Settings → Feature flags).
 * `defaultOn` is used until a flag row exists (so a new feature works before the seed runs, and
 * off-by-default features stay off). `name` is the label on the switch and in the "disabled" error.
 */
export const GROWTH_FEATURES = [
  { key: 'cobroking', name: 'Co-broking network', description: 'Brokers share listings and split commission' },
  { key: 'tenant_requirements', name: 'Tenant requirements', description: '"अपनी ज़रूरत बताएँ" — alerts on matching listings, optional share with top brokers' },
  { key: 'slot_booking', name: 'Visit slot booking', description: 'Tenants book site visits in the broker’s free slots' },
  { key: 'visit_tokens', name: 'Token record', description: 'Manual record of token/advance paid to the broker (no payment gateway)' },
  { key: 'locality_reviews', name: 'Locality reviews', description: 'Residents review water, power, safety of a sector/society' },
  { key: 'commute', name: 'Near my office', description: 'Office-hub filter and estimated commute times' },
  { key: 'flatmates', name: 'Flatmates', description: 'Flatmate / shared-room matching' },
  { key: 'rent_agreement', name: 'Rent agreement', description: '11-month draft rent agreement PDF' },
  { key: 'move_in_services', name: 'Move-in services', description: 'Packers, furniture, broadband partner callbacks' },
  { key: 'whatsapp_bot', name: 'WhatsApp search bot', description: 'Search + alerts on the platform WhatsApp number' },
  { key: 'sale_listings', name: 'Sale & new projects', description: 'Buy, plots, new-launch projects, EMI tools (rental-only launch: keep OFF)', defaultOn: false },
] as const;

export type GrowthFeature = (typeof GROWTH_FEATURES)[number]['key'];
export const featureName = (key: string) => GROWTH_FEATURES.find((f) => f.key === key)?.name ?? key;
/** Default state of a flag that has no row yet. */
export const featureDefault = (key: string) => {
  const f = GROWTH_FEATURES.find((x) => x.key === key) as { defaultOn?: boolean } | undefined;
  return f?.defaultOn ?? true;
};
