import React from 'react';
import type { LedgerItem } from '@brokeriq/shared';
import { VisitPropertyPicker } from '@/components/visit-property-picker';

const { act, create } = require('react-test-renderer');
const base = { organizationId: 'firm', sourceType: 'MANUAL', revision: 1, contacts: [], createdAt: '', updatedAt: '' };
const mockItems: LedgerItem[] = [
  { ...base, id: 'has-photos', houseNo: '30', availability: 'AVAILABLE', photoUrls: ['https://example.test/house-photo.jpg'] },
  { ...base, id: 'no-photos', houseNo: '31', availability: 'AVAILABLE', photoUrls: [] },
];

jest.mock('@tanstack/react-query', () => ({ useInfiniteQuery: () => ({ data: { pages: [{ items: mockItems, total: 2 }] } }) }));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'broker' } }) }));
jest.mock('@/lib/api', () => ({ api: jest.fn(), qs: jest.fn() }));
jest.mock('@/lib/hooks', () => ({ useDebounced: (value: string) => value }));
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ c: { line: '#ddd' } }) }));
jest.mock('@/components/request-loader', () => ({ InlineLoader: () => null }));
jest.mock('@/components/keyboard-scroll-view', () => ({ ScrollView: require('react-native').ScrollView }));
jest.mock('@/ui', () => {
  const { View, Text, TextInput, Pressable } = require('react-native');
  return { Input: TextInput, Txt: Text, Button: View, ErrorView: View, PressableScale: Pressable };
});

it('marks photos in sharing results and the selected preview while leaving visit captions unchanged', () => {
  const onChange = jest.fn();
  let tree: any;
  const labels = () => tree.root.findAll((node: any) => typeof node.props.children === 'string' && node.props.children.endsWith('· Photos'));
  try {
    act(() => { tree = create(<VisitPropertyPicker open value={null} onChange={onChange} purpose="photos" />); });
    expect(new Set(labels().map((node: any) => node.props.children)).size).toBe(1);
    let eligible = labels()[0].parent;
    while (eligible && typeof eligible.props.onPress !== 'function') eligible = eligible.parent;
    expect(eligible).toBeDefined();
    act(() => eligible.props.onPress());
    expect(onChange).toHaveBeenCalledWith(mockItems[0]);
    act(() => tree.update(<VisitPropertyPicker open value={mockItems[0]} onChange={onChange} purpose="photos" />));
    expect(labels().length).toBeGreaterThan(0);
    act(() => tree.update(<VisitPropertyPicker open value={null} onChange={onChange} />));
    expect(labels()).toHaveLength(0);
  } finally {
    act(() => tree?.unmount());
  }
});
