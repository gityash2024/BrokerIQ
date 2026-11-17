import React from 'react';
import { router } from 'expo-router';
import { NativeInventoryEntryActions } from '../inventory-entry-actions';
const { act, create } = require('react-test-renderer');
let mockUser: any;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/lib/config', () => ({ useConfig: () => ({ modules: undefined }) }));
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ c: { brand: '#44f' } }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('lucide-react-native', () => ({ Camera: () => null, FileArchive: () => null, Plus: () => null }));
jest.mock('@/ui', () => {
  const { Text, Pressable } = require('react-native');
  return {
    Txt: Text,
    Button: ({ title, ...props }: any) => (
      <Pressable {...props}>
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});
let tree: any;
afterEach(() => {
  act(() => tree?.unmount());
  jest.clearAllMocks();
});
const controls = () => tree.root.findAll((node: any) => ['Add property', 'Scan property', 'WhatsApp import'].includes(node.props.title));
it.each(['BROKER_ADMIN', 'BROKER_AGENT'])('shows all inventory entry routes directly for %s', (role) => {
  mockUser = { role };
  act(() => {
    tree = create(<NativeInventoryEntryActions params={{ makeAvailable: '1', directoryMonth: '2026-11' }} />);
  });
  expect(controls()).toHaveLength(3);
  expect(controls().every((button: any) => button.props.disabled === false)).toBe(true);
  controls().forEach((button: any) => act(() => button.props.onPress()));
  expect(router.push).toHaveBeenNthCalledWith(1, { pathname: '/inventory-edit', params: { makeAvailable: '1', directoryMonth: '2026-11' } });
  expect(router.push).toHaveBeenNthCalledWith(2, '/scanner?target=INVENTORY');
  expect(router.push).toHaveBeenNthCalledWith(3, '/capture?target=INVENTORY');
});
it('keeps actions visible with an explanation for a view-only delegated account', () => {
  mockUser = { role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['inventory:view'] };
  act(() => {
    tree = create(<NativeInventoryEntryActions />);
  });
  expect(controls()).toHaveLength(3);
  expect(controls().every((button: any) => button.props.disabled)).toBe(true);
  expect(router.push).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ children: 'Ask your Broker Admin for inventory create and capture access to use these actions.' })).toBeDefined();
});
it('enables the granted delegated create and import routes', () => {
  mockUser = { role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['inventory:create', 'inbox:view', 'inbox:create'] };
  act(() => {
    tree = create(<NativeInventoryEntryActions />);
  });
  expect(controls().every((button: any) => button.props.disabled === false)).toBe(true);
});
