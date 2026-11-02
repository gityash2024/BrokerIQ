import * as storage from 'expo-secure-store';
import { authStore, api, AccountScopeChangedError, captureAccountContext } from '../api';
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

it('clears privileged queries when the same account changes role or firm', async () => {
  const session = {
    accessToken: 'isolated',
    refreshToken: 'isolated',
    user: { id: 'membership-change', role: 'BROKER_ADMIN', organization: { id: 'firm-a' } },
  } as any;
  await authStore.set(session);
  queryClient.setQueryData(['team-private'], ['admin-only']);
  await authStore.set({ ...session, user: { ...session.user, role: 'BROKER_AGENT' } });
  expect(queryClient.getQueryData(['team-private'])).toBeUndefined();
  queryClient.setQueryData(['inventory-private'], ['firm-a']);
  await authStore.set({ ...session, user: { ...session.user, role: 'BROKER_AGENT', organization: { id: 'firm-b' } } });
  expect(queryClient.getQueryData(['inventory-private'])).toBeUndefined();
});

it.each(['role', 'firm'])('rejects a late privileged response after the same user changes %s', async (change) => {
  const original = { accessToken: 'fixture', refreshToken: 'fixture', user: { id: 'same-user', role: 'BROKER_ADMIN', organization: { id: 'firm-a' } } } as any;
  await authStore.set(original);
  let release!: (response: any) => void;
  const fetch = jest.spyOn(globalThis, 'fetch').mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  try {
    const pending = api('/broker/team');
    const rejected = expect(pending).rejects.toBeInstanceOf(AccountScopeChangedError);
    await authStore.set({ ...original, user: { ...original.user, ...(change === 'role' ? { role: 'BROKER_AGENT' } : { organization: { id: 'firm-b' } }) } });
    release({ status: 200, ok: true, text: async () => JSON.stringify({ privateAdminData: true }) });
    await rejected;
  } finally {
    fetch.mockRestore();
  }
});

it('preserves existing guest access for public listing requests', async () => {
  await authStore.set(null);
  const request = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ status: 200, ok: true, text: async () => '{"id":"public-listing"}' } as Response);
  try {
    await expect(api('/listings/public-slug')).resolves.toEqual({ id: 'public-listing' });
  } finally {
    request.mockRestore();
  }
});

it('returns authenticated report bytes and rejects a late download after role change', async () => {
  const original = {
    accessToken: 'fixture',
    refreshToken: 'fixture',
    user: { id: 'report-owner', role: 'BROKER_ADMIN', organization: { id: 'firm-a' } },
  } as any;
  await authStore.set(original);
  let release!: (bytes: ArrayBuffer) => void;
  const pendingBytes = new Promise<ArrayBuffer>((resolve) => {
    release = resolve;
  });
  const request = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce({ status: 200, ok: true, headers: { get: () => '3' }, arrayBuffer: async () => Uint8Array.from([80, 75, 3]).buffer } as any);
  try {
    await expect(api('/broker/team/export?format=xlsx', { responseType: 'bytes' })).resolves.toEqual(Uint8Array.from([80, 75, 3]));
    request.mockResolvedValueOnce({ status: 200, ok: true, headers: { get: () => '3' }, arrayBuffer: () => pendingBytes } as any);
    const download = api('/broker/team/export?format=xlsx', { responseType: 'bytes' });
    const rejected = expect(download).rejects.toBeInstanceOf(AccountScopeChangedError);
    await Promise.resolve();
    await authStore.set({ ...original, user: { ...original.user, role: 'BROKER_AGENT' } });
    release(Uint8Array.from([80, 75, 3]).buffer);
    await rejected;
  } finally {
    request.mockRestore();
  }
});

it('rejects both an old callback and an old response after A to B to A', async () => {
  const a = { accessToken: 'a', refreshToken: 'a', user: { id: 'same', role: 'BROKER_ADMIN', organization: { id: 'a' } } } as any;
  await authStore.set(a);
  const context = captureAccountContext();
  let release!: (response: any) => void;
  const request = jest.spyOn(globalThis, 'fetch').mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  try {
    const pending = api('/inventory');
    const rejected = expect(pending).rejects.toBeInstanceOf(AccountScopeChangedError);
    await authStore.set({ ...a, user: { ...a.user, organization: { id: 'b' } } });
    await authStore.set(a);
    await expect(api('/inventory', { body: { private: true }, ownerContext: context })).rejects.toBeInstanceOf(AccountScopeChangedError);
    expect(request).toHaveBeenCalledTimes(1);
    release({ status: 401, ok: false });
    await rejected;
    expect(request).toHaveBeenCalledTimes(1); // A stale 401 must not trigger a refresh in the current session.
  } finally {
    request.mockRestore();
  }
});
it('keeps an explicit operation context valid across transparent token rotation', async () => {
  const user = { id: 'refresh-owner', role: 'BROKER_AGENT', organization: { id: 'a' } };
  await authStore.set({ user, accessToken: 'old-access', refreshToken: 'old-refresh' } as any);
  const ownerContext = captureAccountContext();
  const request = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce({ status: 401, ok: false } as any)
    .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ user, accessToken: 'new-access', refreshToken: 'new-refresh' }) } as any)
    .mockResolvedValueOnce({ status: 200, ok: true, text: async () => '{"id":"rotated"}' } as any);
  try {
    await expect(api('/inventory', { ownerContext })).resolves.toEqual({ id: 'rotated' });
    expect(captureAccountContext()).toEqual(ownerContext);
    expect(request.mock.calls[2][1]?.headers).toMatchObject({ Authorization: 'Bearer new-access' });
  } finally {
    request.mockRestore();
  }
});

it('allows a new workspace refresh while an old refresh is still pending', async () => {
  const user = (firm: string) => ({ id: 'refresh-switch', role: 'BROKER_ADMIN', organization: { id: firm } });
  await authStore.set({ user: user('a'), accessToken: 'a', refreshToken: 'refresh-a' } as any);
  let oldRefresh!: (response: any) => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  const request = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce({ status: 401, ok: false } as any)
    .mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        oldRefresh = resolve;
      });
    })
    .mockResolvedValueOnce({ status: 401, ok: false } as any)
    .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ user: user('b'), accessToken: 'b-new', refreshToken: 'refresh-b-new' }) } as any)
    .mockResolvedValueOnce({ status: 200, ok: true, text: async () => '{"firm":"b"}' } as any);
  try {
    const pending = api('/inventory');
    const rejected = expect(pending).rejects.toBeInstanceOf(AccountScopeChangedError);
    await waiting;
    await authStore.set({ user: user('b'), accessToken: 'b', refreshToken: 'refresh-b' } as any);
    await expect(api('/inventory')).resolves.toEqual({ firm: 'b' });
    oldRefresh({ status: 200, ok: true, json: async () => ({ user: user('a'), accessToken: 'a-late', refreshToken: 'refresh-a-late' }) });
    await rejected;
    expect(authStore.get()?.user.organization?.id).toBe('b');
    expect(authStore.get()?.accessToken).toBe('b-new');
  } finally {
    request.mockRestore();
  }
});
