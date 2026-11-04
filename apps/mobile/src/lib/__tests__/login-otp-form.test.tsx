import React from 'react';
import { BackHandler } from 'react-native';
import { LoginOtpForm } from '@/components/login-otp-form';
import { api } from '../api';

const { act, create } = require('react-test-renderer');
jest.mock('../api', () => ({
  api: jest.fn(),
  ApiError: class extends Error {},
  errorMessage: (error: Error) => error.message,
}));
jest.mock('@/ui', () => {
  const { View, Text, TextInput, Pressable } = require('react-native');
  return {
    Txt: Text,
    Input: TextInput,
    Button: ({ title, onPress, ...props }: any) => (
      <Pressable accessibilityLabel={title} onPress={onPress} {...props}>
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});

describe('native inline email verification', () => {
  let tree: any;
  const onChange = jest.fn();
  const onDone = jest.fn();
  const challenge = () => ({
    challenge: 'isolated-verification-challenge',
    destination: 'q***@example.test',
    requiredFactors: ['EMAIL' as const],
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    resendAt: new Date(Date.now() + 60000).toISOString(),
  });
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  const render = () => {
    act(() => {
      tree = create(<LoginOtpForm challenge={challenge()} onChange={onChange} onDone={onDone} onSessionLimit={jest.fn()} />);
    });
    return tree.root.findByProps({ accessibilityLabel: 'Email OTP' });
  };
  it('keeps an invalid code on the verification step and completes with a valid response', async () => {
    const input = render();
    act(() => input.props.onChangeText('12x3456'));
    expect(input.props.value).toBe('123456');
    (api as jest.Mock).mockRejectedValueOnce(new Error('Invalid code'));
    await act(async () => tree.root.findByProps({ title: 'Verify and continue' }).props.onPress());
    expect(onDone).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ children: 'Invalid code' })).toBeDefined();
    const response = { user: { id: 'isolated-user' } };
    (api as jest.Mock).mockResolvedValueOnce(response);
    await act(async () => tree.root.findByProps({ title: 'Verify and continue' }).props.onPress());
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onDone).toHaveBeenCalledWith(response);
    expect(api).toHaveBeenLastCalledWith('/auth/login/otp/verify', {
      auth: false,
      body: { challenge: 'isolated-verification-challenge', code: '123456', factor: 'EMAIL' },
    });
  });
  it('keeps resend disabled during cooldown and handles hardware back through sign-in', () => {
    const back = jest.spyOn(BackHandler, 'addEventListener');
    render();
    expect(tree.root.findByProps({ title: 'Resend OTP (60s)' }).props.disabled).toBe(true);
    act(() => jest.advanceTimersByTime(60000));
    expect(tree.root.findByProps({ title: 'Resend OTP' }).props.disabled).toBe(false);
    const handler = back.mock.calls.find(([event]) => event === 'hardwareBackPress')![1];
    act(() => {
      expect(handler({} as Parameters<typeof handler>[0])).toBe(true);
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
