import React from 'react';
import { defaultModulePolicies, delegableModules, delegatedGrant } from '@brokeriq/shared';
import { TabBar } from '@/components/tab-bar';

const { act, create } = require('react-test-renderer');
const mockPolicies = defaultModulePolicies();
let mockUser: { role: string; delegatedPermissions?: string[] };
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/lib/config', () => ({ useConfig: () => ({ modules: mockPolicies }) }));
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ c: { bg: '#fff', brand: '#44f' }, isDark: false }) }));
jest.mock('@/ui', () => ({ Txt: require('react-native').Text }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn().mockResolvedValue(undefined), ImpactFeedbackStyle: { Light: 'Light' } }));

it('renders and navigates the granted broker tabs under the delegated role', () => {
  const routes = ['dashboard', 'inventory', 'leads', 'inbox', 'kyc', 'automations'].map((name) => ({ name, key: name }));
  const descriptors = Object.fromEntries(routes.map(({ key }) => [key, { options: { title: key } }]));
  const navigation = { emit: jest.fn().mockReturnValue({}), navigate: jest.fn() };
  const component = <TabBar state={{ routes, index: 0 }} descriptors={descriptors} navigation={navigation} />;
  let tree: ReturnType<typeof create>;
  const tabs = () => tree.root.findAll((node: any) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function' && typeof node.type !== 'string');
  const labels = () => tabs().map((node: { props: { accessibilityLabel: string } }) => node.props.accessibilityLabel);
  mockUser = { role: 'SUB_BROKER_ADMIN', delegatedPermissions: delegableModules(mockPolicies).flatMap(({ key, actions }) => actions.map((a) => delegatedGrant(key, a))) };
  act(() => { tree = create(component); });
  expect(labels()).toEqual(routes.map(({ name }) => name));
  act(() => { tabs()[2].props.onPress(); });
  expect(navigation.navigate).toHaveBeenCalledWith('leads');

  mockUser = { role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['leads:view', 'inventory:edit'] };
  act(() => { tree.update(React.cloneElement(component)); });
  expect(labels()).toEqual(['dashboard', 'leads']);
  mockUser = { role: 'SUB_BROKER_ADMIN', delegatedPermissions: [] };
  act(() => { tree.update(React.cloneElement(component)); });
  expect(labels()).toEqual(['dashboard']);
  act(() => { tree.unmount(); });
});
