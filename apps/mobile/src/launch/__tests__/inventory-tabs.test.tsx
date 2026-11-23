import React from 'react';
import { router } from 'expo-router';
import { NativeInventoryTabs } from '../inventory-tabs';
import { toast } from '@/lib/toast';
const { act, create } = require('react-test-renderer');
let mockUser: any;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/lib/config', () => ({ useConfig: () => ({ modules: undefined }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/toast', () => ({ toast: { info: jest.fn() } }));
jest.mock('@/ui', () => ({ Chip: ({ label }: any) => <>{label}</> }));
let tree: any;
afterEach(() => {
  act(() => tree?.unmount());
  jest.clearAllMocks();
});
it.each(['BROKER_ADMIN', 'BROKER_AGENT', 'SUB_BROKER_ADMIN'])('keeps four inventory sections visible and wrapping for %s', (role) => {
  mockUser = { role, delegatedPermissions: ['inventory:view'] };
  act(() => {
    tree = create(<NativeInventoryTabs active="/broker/inventory" />);
  });
  for (const label of ['Available Inventory', 'All Inventory', 'Publication Review', 'Publish Listing']) expect(tree.root.findByProps({ label })).toBeDefined();
  expect(tree.root.findByProps({ accessibilityLabel: 'Inventory sections' }).props.style.flexWrap).toBe('wrap');
  act(() => tree.root.findByProps({ label: 'All Inventory' }).props.onPress());
  expect(router.push).toHaveBeenCalledWith('/(broker)/inventory-ledger');
  jest.clearAllMocks();
  act(() => tree.root.findByProps({ label: 'Publication Review' }).props.onPress());
  if (role === 'BROKER_ADMIN') expect(router.push).toHaveBeenCalledWith('/publication-reviews');
  else {
    expect(router.push).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Publication review requires Broker Admin approval access.');
  }
});
it('opens review for a delegated account with approval access', () => {
  mockUser = { role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['inventory:view', 'inventory:approve'] };
  act(() => {
    tree = create(<NativeInventoryTabs active="/broker/inventory" />);
  });
  act(() => tree.root.findByProps({ label: 'All Inventory' }).props.onPress());
  expect(router.push).toHaveBeenCalledWith('/(broker)/inventory-ledger');
  jest.clearAllMocks();
  act(() => tree.root.findByProps({ label: 'Publication Review' }).props.onPress());
  expect(router.push).toHaveBeenCalledWith('/publication-reviews');
});
