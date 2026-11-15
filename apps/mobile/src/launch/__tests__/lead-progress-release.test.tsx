import React from 'react';
import { router } from 'expo-router';
import LeadDetail from '../../../app/lead/[id]';
import { defaultModulePolicies } from '@brokeriq/shared';

const { act, create } = require('react-test-renderer');
const mockPolicies = defaultModulePolicies();
let mockLead: any;
let mockUser: any;
const mockMutate = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({ id: 'lead-id' }) }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockLead, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ user: mockUser, isBrokerAdmin: mockUser.role === 'BROKER_ADMIN' }) }));
jest.mock('@/lib/config', () => ({ useConfig: () => ({ modules: mockPolicies }), useFlag: () => false }));
jest.mock('@/lib/hooks', () => ({ useApiMutation: () => ({ mutate: mockMutate, isPending: false }), showError: jest.fn() }));
jest.mock('@/lib/api', () => ({ api: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() }));
jest.mock('@/lib/inbox-composer', () => ({ openLeadInbox: jest.fn() }));
jest.mock('@/lib/push', () => ({ reconcileLocalReminders: jest.fn() }));
jest.mock('@/lib/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/theme', () => ({ useTheme: () => ({ c: { bg: '#fff', fg: '#000', brand: '#44f' } }) }));
jest.mock('@/launch/drafts', () => ({ submitTask: jest.fn() }));
jest.mock('@/components/crm', () => ({
  SourceBadge: () => null,
  TempBadge: () => null,
  StageBadge: () => null,
  useAssignees: () => ({ data: { members: [] } }),
}));
jest.mock('@/components/visit-properties', () => ({ VisitItinerary: () => null }));
jest.mock('@/components/date-time-field', () => ({ DateTimeField: () => null }));
jest.mock('@/components/notification-bell', () => ({ NotificationBell: () => null }));
jest.mock('@/components/listing', () => ({ ListingRow: () => null }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  FadeIn: {},
  FadeInDown: { delay: () => ({}) },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/ui', () => {
  const { View, Text, Pressable, TextInput } = require('react-native');
  return {
    Txt: Text,
    Row: View,
    Card: View,
    Avatar: () => null,
    Badge: () => null,
    Chip: () => null,
    ErrorView: () => null,
    Loader: () => null,
    Input: TextInput,
    IconBtn: Pressable,
    PressableScale: Pressable,
    Segmented: () => null,
    Sheet: ({ open, children, title }: any) => (open ? <View accessibilityLabel={title}>{children}</View> : null),
    Button: ({ title, children, ...props }: any) => (
      <Pressable {...props} accessibilityLabel={title || props.accessibilityLabel}>
        <Text>{title}</Text>
        {children}
      </Pressable>
    ),
  };
});

let tree: any;
const allButtons = () => tree.root.findAll((node: any) => typeof node.props.onPress === 'function' && typeof node.type !== 'string');
const button = (name: string) => allButtons().find((node: any) => node.props.accessibilityLabel === name);
const render = () =>
  act(() => {
    tree = create(<LeadDetail />);
  });
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'broker-id', role: 'BROKER_ADMIN', organization: { id: 'org-id' } };
  mockLead = { id: 'lead-id', name: 'Lead', phone: '+919999999999', stage: 'CONTACTED', visits: [], followUps: [], activities: [] };
});
afterEach(() => act(() => tree?.unmount()));

it('places actions in stage order and opens follow-up and the correct photo page without changing stage', () => {
  render();
  const labels = [
    ...new Set(
      allButtons()
        .map((node: any) => node.props.accessibilityLabel)
        .filter(Boolean),
    ),
  ];
  expect(labels.slice(labels.indexOf('Contacted'), labels.indexOf('Site visit') + 1)).toEqual([
    'Contacted',
    'Follow-up',
    'Interested',
    'Not interested',
    'Share photos',
    'Site visit',
  ]);
  expect(button('Shortlisted')).toBeUndefined();
  act(() => button('Share photos').props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/lead-share-photos', params: { id: 'lead-id' } });
  act(() => button('Follow-up').props.onPress());
  expect(tree.root.findAll((node: any) => node.props.open === true).length).toBeGreaterThan(0);
  expect(mockMutate).not.toHaveBeenCalled();
});

it('enables Shortlisted only after a completed visit and submits the existing stage mutation', () => {
  mockLead.visits = [{ status: 'SCHEDULED' }];
  render();
  expect(button('Shortlisted')).toBeUndefined();
  mockLead = { ...mockLead, visits: [{ status: 'COMPLETED' }] };
  act(() => tree.update(<LeadDetail />));
  expect(button('Share photos')).toBeUndefined();
  act(() => button('Shortlisted').props.onPress());
  expect(mockMutate).toHaveBeenCalledWith({ stage: 'SHORTLISTED' });
});

it('retains legacy Shortlisted selection and applies delegated create and inbox permissions', () => {
  mockLead.stage = 'SHORTLISTED';
  render();
  expect(button('Shortlisted')).toBeDefined();
  act(() => tree.unmount());
  mockLead.stage = 'CONTACTED';
  mockUser = { ...mockUser, role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['leads:view', 'leads:edit'] };
  render();
  expect(button('Share photos')).toBeUndefined();
  expect(
    allButtons()
      .filter((node: any) => node.props.accessibilityLabel === 'Follow-up')
      .every((node: any) => node.props.disabled),
  ).toBe(true);
});
