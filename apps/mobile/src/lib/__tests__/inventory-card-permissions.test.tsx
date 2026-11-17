import React from 'react';
import { PropertyCard } from '@/launch/property-card';
import { useAuth } from '@/lib/auth';
import { router } from 'expo-router';
const { act, create } = require('react-test-renderer');
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('lucide-react-native', () => ({
  Building2: () => null,
  Phone: () => null,
  Share2: () => null,
  ChevronRight: () => null,
  BedDouble: () => null,
  Layers3: () => null,
  Ruler: () => null,
  CheckCircle2: () => null,
  User: () => null,
  Flame: () => null,
  AlertTriangle: () => null,
  MessageCircle: () => null,
  Clock: () => null,
  Sparkles: () => null,
}));
jest.mock('@/lib/api', () => ({ errorMessage: (e: Error) => e.message }));
jest.mock('@/lib/theme', () => ({
  useTheme: () => ({ c: { brand: '#4f46e5', fg: '#111111', muted: '#666666', subtle: '#999999', line: '#dddddd', surface: '#ffffff' } }),
}));
jest.mock('@/lib/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/launch/screen', () => ({ NativeCard: ({ children }: any) => children }));
jest.mock('@/ui', () => ({ Txt: require('react-native').Text }));

const item = {
  id: 'owned-inventory',
  sector: 'Sector 45',
  houseNo: '384',
  monthlyRent: 32000,
  availability: 'AVAILABLE',
  revision: 4,
  updatedAt: '2020-01-01T00:00:00Z',
  createdAt: '2020-01-01T00:00:00Z',
  contacts: [],
  photoUrls: [],
  purpose: 'RENT',
};
let tree: any;
afterEach(() => {
  act(() => tree?.unmount());
  jest.clearAllMocks();
});
function render(role: string, delegatedPermissions: string[] = []) {
  (useAuth as jest.Mock).mockReturnValue({ user: { role, delegatedPermissions } });
  act(() => {
    tree = create(<PropertyCard item={item as any} />);
  });
  const label = tree.root.findAllByType('Text').find((node: any) => String(node.props.children).includes('Review availability'));
  let control = label?.parent;
  while (control && typeof control.props.onPress !== 'function') control = control.parent;
  return control;
}
it('keeps stale read-only cards readable without exposing a mutation control', () => {
  expect(render('SUB_BROKER_ADMIN', ['inventory:view'])).toBeUndefined();
  expect(router.push).not.toHaveBeenCalled();
});
it.each(['BROKER_ADMIN', 'BROKER_AGENT', 'SUB_BROKER_ADMIN'])('opens a property review for %s before reconfirming availability', (role) => {
  const control = render(role, ['inventory:view', 'inventory:edit']);
  expect(control).toBeDefined();
  act(() => control.props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/inventory-edit', params: { id: 'owned-inventory', makeAvailable: '1' } });
});
