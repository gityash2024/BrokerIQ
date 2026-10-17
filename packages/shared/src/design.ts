/** Original BrokerIQ identity. Values are shared by web, marketing and native adapters. */
export const BRAND = { primary: '#4F46E5', accent: '#F59E0B', ink: '#0F172A', paper: '#F7F8FC', surface: '#FFFFFF', line: '#E4E7F0' } as const;
export const DESIGN = {
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80],
  radius: { sm: 10, md: 14, lg: 18, xl: 24 },
  motion: { fast: 140, normal: 220, reveal: 480 },
  touchTarget: 44,
} as const;
export function floorLabel(value: string | null | undefined): string {
  if (value == null || value === '') return 'Floor not recorded';
  if (value === '0' || value === 'GF') return 'Ground floor';
  if (value === 'TF' || value === 'TOP') return 'Top floor';
  if (/^\d+$/.test(value)) return `${value}${value === '1' ? 'st' : value === '2' ? 'nd' : value === '3' ? 'rd' : 'th'} floor`;
  return value.replace(/_/g, ' ');
}
