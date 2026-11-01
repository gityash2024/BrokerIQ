import * as storage from 'expo-secure-store';
import { authStore } from '../api';
import { queryClient } from '../query';

it('keeps same-account refresh data but clears private queries before switching accounts', async () => {
  const session = (id: string) => ({ accessToken: 'test-token', refreshToken: 'test-refresh', user: { id, role: 'USER' } }) as any;
  await authStore.set(session('first'));
  queryClient.setQueryData(['private-enquiries'], [{ id: 'first-account-record' }]);
  await authStore.set(session('first'));
  expect(queryClient.getQueryData(['private-enquiries'])).toHaveLength(1);
  await authStore.set(session('second'));
  expect(queryClient.getQueryData(['private-enquiries'])).toBeUndefined();
  queryClient.setQueryData(['private-enquiries'], [{ id: 'second-account-record' }]);
  await authStore.set(null);
  expect(queryClient.getQueryData(['private-enquiries'])).toBeUndefined();
});

it('an in-flight startup read cannot restore credentials after logout', async () => {
  let release!: (value: string) => void;
  const pending = new Promise<string>((resolve) => {
    release = resolve;
  });
  const spy = jest.spyOn(storage, 'getItemAsync').mockReturnValueOnce(pending);
  const load = authStore.load();
  await authStore.set(null);
  release(JSON.stringify({ accessToken: 'old', refreshToken: 'old', user: { id: 'previous' } }));
  await load;
  expect(authStore.get()).toBeNull();
  spy.mockRestore();
});

it('credential persistence finishes logout after an older asynchronous write', async () => {
  let started!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const write = jest.spyOn(storage, 'setItemAsync').mockImplementationOnce(async () => {
    started();
    await pending;
  });
  const remove = jest.spyOn(storage, 'deleteItemAsync');
  const login = authStore.set({ accessToken: 'isolated', refreshToken: 'isolated', user: { id: 'race-owner', role: 'USER' } } as any);
  await entered;
  const logout = authStore.set(null);
  expect(authStore.get()).toBeNull();
  release();
  await Promise.all([login, logout]);
  expect(remove).toHaveBeenLastCalledWith('biq.session');
  expect(remove.mock.invocationCallOrder.at(-1)!).toBeGreaterThan(write.mock.invocationCallOrder.at(-1)!);
  write.mockRestore();
  remove.mockRestore();
});
