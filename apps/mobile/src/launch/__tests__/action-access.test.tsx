import React from 'react';
import { Button, IconBtn, Chip } from '@/ui';
import { ChoiceField } from '../form';
import { toast } from '@/lib/toast';
const { act, create } = require('react-test-renderer');
jest.mock('lucide-react-native', () => ({ Check: () => null, ChevronDown: () => null }));
jest.mock('@/lib/theme', () => ({
  fonts: { display: 'system', displayBold: 'system', body: 'system', medium: 'system', semibold: 'system', bold: 'system' },
  palette: {},
  radius: {},
  useTheme: () => ({ c: { brand: '#4f20ff', fg: '#111', surface: '#fff', muted: '#555', line: '#ddd' } }),
}));
jest.mock('@/lib/i18n', () => ({ useT: () => (s: string) => s, useTextDir: () => ({}), translateChildren: (_: unknown, s: unknown) => s }));
jest.mock('@/lib/api', () => ({ ApiError: class extends Error {}, useSession: () => null }));
jest.mock('@/lib/toast', () => ({ toast: { info: jest.fn() }, useToasts: () => ({ items: [] }) }));
jest.mock('@/components/request-loader', () => ({ InlineLoader: () => null, LoadingArtwork: () => null }));
jest.mock('@/components/notification-bell', () => ({ NotificationBell: () => null }));
jest.mock('@/components/keyboard-scroll-view', () => ({ ScrollView: require('react-native').ScrollView }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('expo-router', () => ({ router: {} }));
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView } = require('react-native');
  return { __esModule: true, default: { View, ScrollView }, useSharedValue: () => ({ value: 1 }), useAnimatedStyle: () => ({}), withSpring: (v: number) => v };
});
let tree: any;
afterEach(() => {
  act(() => tree?.unmount());
  jest.clearAllMocks();
});
const press = () => tree.root.findAll((n: any) => typeof n.props.onPress === 'function' && n.type !== Button && n.type !== IconBtn && n.type !== Chip)[0];
it.each(['button', 'icon', 'chip', 'choice'])('shows a restricted %s and explains access without calling its action', (kind) => {
  const action = jest.fn();
  act(() => {
    tree = create(
      kind === 'button' ? (
        <Button title="Save" access={false} onPress={action} />
      ) : kind === 'icon' ? (
        <IconBtn access={false} onPress={action}>
          +
        </IconBtn>
      ) : kind === 'chip' ? (
        <Chip label="Assign" access={false} onPress={action} />
      ) : (
        <ChoiceField label="Assignee" choices={[]} access={false} onChange={action} />
      ),
    );
  });
  act(() => press().props.onPress({}));
  expect(action).not.toHaveBeenCalled();
  expect(toast.info).toHaveBeenCalledWith('Ask your Broker Admin for permission to use this action.');
});
it('preserves the normal button handler when access is granted', () => {
  const action = jest.fn();
  act(() => {
    tree = create(<Button title="Save" access onPress={action} />);
  });
  act(() => press().props.onPress({}));
  expect(action).toHaveBeenCalledTimes(1);
});
