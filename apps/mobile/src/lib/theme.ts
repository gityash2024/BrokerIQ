import { useColorScheme } from 'react-native';
import { create } from './store';

export const palette = {
  brand: { 50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC', 400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA', 800: '#3730A3', 900: '#312E81', 950: '#1E1B4B' },
  saffron: { 300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706' },
  emerald: '#10B981',
  rose: '#F43F5E',
  sky: '#0EA5E9',
  amber: '#F59E0B',
  whatsapp: '#25D366',
};

const light = {
  bg: '#F7F8FC',
  surface: '#FFFFFF',
  surface2: '#F1F3F9',
  line: '#E4E7EF',
  fg: '#0F172A',
  muted: '#475569',
  subtle: '#94A3B8',
  brand: palette.brand[600],
  brandSoft: palette.brand[50],
  accent: palette.saffron[500],
  success: palette.emerald,
  danger: palette.rose,
  warning: palette.amber,
  info: palette.sky,
  overlay: 'rgba(15,23,42,0.5)',
};
const dark: typeof light = {
  bg: '#0B0D17',
  surface: '#131626',
  surface2: '#1C2033',
  line: '#272C44',
  fg: '#F1F5F9',
  muted: '#A7B0C4',
  subtle: '#6B7490',
  brand: palette.brand[400],
  brandSoft: 'rgba(99,102,241,0.16)',
  accent: palette.saffron[400],
  success: '#34D399',
  danger: '#FB7185',
  warning: '#FBBF24',
  info: '#38BDF8',
  overlay: 'rgba(0,0,0,0.6)',
};
export type Colors = typeof light;

export const fonts = {
  display: 'PlusJakartaSans_800ExtraBold',
  displayBold: 'PlusJakartaSans_700Bold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, full: 999 };
export const space = (n: number) => n * 4;

type Mode = 'system' | 'light' | 'dark';
export const useThemeMode = create<{ mode: Mode; setMode: (m: Mode) => void }>((set) => ({ mode: 'system', setMode: (mode) => set({ mode }) }));

export function useTheme() {
  const scheme = useColorScheme();
  const mode = useThemeMode((s) => s.mode);
  const isDark = mode === 'dark' || (mode === 'system' && scheme === 'dark');
  return { c: isDark ? dark : light, isDark };
}
