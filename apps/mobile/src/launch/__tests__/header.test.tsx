import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { BrokerScreen } from '../screen';

const { act, create } = require('react-test-renderer');
const mockMode = jest.fn();
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  return { ChevronLeft: View, Languages: View, Moon: View, MoreHorizontal: View, Sun: View, UserRound: View };
});
let mockPath = '/leads';
let mockBroker = true;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  usePathname: () => mockPath,
}));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ isBroker: mockBroker }) }));
jest.mock('@/lib/theme', () => ({
  useTheme: () => ({ c: { bg: '#fff', surface: '#fff', surface2: '#eee', line: '#ddd', fg: '#111', muted: '#555', brand: '#44f' }, isDark: false }),
  useThemeMode: (selector: any) => selector({ setMode: mockMode }),
}));
jest.mock('@/components/notification-bell', () => {
  const { View } = require('react-native');
  return { NotificationBell: () => <View accessibilityLabel="Notifications" style={{ width: 44, height: 44 }} /> };
});
jest.mock('@/components/language', () => {
  const { Text } = require('react-native');
  return { LanguageSheet: ({ open }: any) => (open ? <Text>Language choices</Text> : null) };
});
jest.mock('@/ui', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Txt: Text,
    Card: View,
    IconBtn: ({ children, ...props }: any) => <Pressable {...props}>{children}</Pressable>,
    Button: ({ title, onPress }: any) => (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    ),
    Sheet: ({ open, children }: any) => (open ? <View accessibilityLabel="Quick settings">{children}</View> : null),
  };
});

describe('shared native header', () => {
  let tree: any;
  beforeEach(() => {
    jest.clearAllMocks();
    mockPath = '/leads';
    mockBroker = true;
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.restoreAllMocks();
  });

  it.each([
    [320, 1],
    [360, 1],
    [412, 1],
    [600, 2],
  ])('keeps actions beside bounded title at width %s and font scale %s', (width, fontScale) => {
    jest.mocked(jest.spyOn(require('react-native'), 'useWindowDimensions')).mockReturnValue({ width, height: 800, scale: 1, fontScale });
    act(() => {
      tree = create(
        <BrokerScreen title="Leads & Requirements" subtitle="240 contacts" back>
          <Text>Content</Text>
        </BrokerScreen>,
      );
    });
    const header = tree.root.findAllByType(View).find((node: any) => node.props.style?.borderBottomWidth === 1);
    expect(header.props.style.flexWrap).toBe('nowrap');
    const title = header.findByProps({ children: 'Leads & Requirements' });
    expect(title.props.numberOfLines).toBe(2);
    expect(title.parent.props.style.minWidth).toBe(0);
    expect(header.findByProps({ children: '240 contacts' }).props.numberOfLines).toBe(1);
    const more = header.findByProps({ accessibilityLabel: 'More options' });
    expect(more).toBeDefined();
    expect(more.parent.props.style.width).toBeUndefined();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Quick settings' })).toHaveLength(0);
    act(() => more.props.onPress());
    const sheet = tree.root.findByProps({ accessibilityLabel: 'Quick settings' });
    const theme = sheet.findByProps({ title: 'Dark theme' });
    act(() => theme.props.onPress());
    expect(mockMode).toHaveBeenCalledWith('dark');
    const language = sheet.findByProps({ title: 'Select Language' });
    act(() => language.props.onPress());
    expect(tree.root.findByProps({ children: 'Language choices' })).toBeDefined();
  });

  it('keeps a module action and role-correct profile reachable from the compact menu', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 360, height: 800, scale: 1, fontScale: 1 });
    act(() => {
      tree = create(
        <BrokerScreen title="Inventory" action={<Text>Add property</Text>}>
          <Text>Content</Text>
        </BrokerScreen>,
      );
    });
    act(() => tree.root.findByProps({ accessibilityLabel: 'More options' }).props.onPress());
    const sheet = tree.root.findByProps({ accessibilityLabel: 'Quick settings' });
    expect(sheet.findByProps({ children: 'Add property' })).toBeDefined();
    act(() => sheet.findByProps({ title: 'Profile & settings' }).props.onPress());
    expect(router.push).toHaveBeenCalledWith('/broker-settings');
  });
});
