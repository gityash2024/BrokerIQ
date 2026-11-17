import React from 'react';
import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { PropertyDateField } from '../property-date-field';
const { create, act } = require('react-test-renderer');
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('@/ui', () => ({
  Button: (props: any) => require('react').createElement('button', props),
  Txt: (props: any) => require('react').createElement('text', props),
}));
let tree: any;
const originalPlatform = Platform.OS;
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
});
afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.clearAllMocks();
});
it('opens a real calendar contract and emits a date-only value without timezone shifts', () => {
  const change = jest.fn();
  act(() => {
    tree = create(<PropertyDateField label="Possession date" value="2026/12/1" onChange={change} />);
  });
  const button = tree.root.findAllByType('button')[0];
  expect(button.props.title).toBe('2026-12-01');
  act(() => button.props.onPress());
  const options = (DateTimePickerAndroid.open as jest.Mock).mock.calls[0][0];
  expect(options.mode).toBe('date');
  act(() => options.onChange({ type: 'set' }, new Date(2027, 0, 2, 0, 5)));
  expect(change).toHaveBeenLastCalledWith('2027-01-02');
});
it('does not erase a recorded date when a calendar is cancelled, and supports explicit clearing', () => {
  const change = jest.fn();
  act(() => {
    tree = create(<PropertyDateField label="Available from" value="2026-12-01" onChange={change} />);
  });
  const buttons = tree.root.findAllByType('button');
  act(() => buttons[0].props.onPress());
  const options = (DateTimePickerAndroid.open as jest.Mock).mock.calls[0][0];
  act(() => options.onChange({ type: 'dismissed' }, new Date()));
  expect(change).not.toHaveBeenCalled();
  act(() => buttons[1].props.onPress());
  expect(change).toHaveBeenCalledWith(null);
});
