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
