import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api, authStore } from '../api';
import { registerPush, unregisterPush, scheduleReminder } from '../push';

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('../api', () => ({ api: jest.fn(), authStore: { get: jest.fn() } }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const session = { user: { id: 'phone-owner' }, accessToken: 'isolated-local-test-token' } as any;
beforeEach(() => {
  jest.clearAllMocks();
  (authStore.get as jest.Mock).mockReturnValue(session);
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
  (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);
  (api as jest.Mock).mockResolvedValue({ ok: true });
});

it('cleans up a persisted registration after process restart and only removes this account reminders', async () => {
  jest.spyOn(SecureStore, 'getItemAsync').mockResolvedValueOnce(JSON.stringify({ userId: session.user.id, token: 'ExponentPushToken[persisted]' }));
  (authStore.get as jest.Mock).mockReturnValue(null);
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
    { identifier: 'own', content: { data: { recipientUserId: session.user.id } } },
    { identifier: 'another', content: { data: { recipientUserId: 'other' } } },
  ]);
  await unregisterPush(session.accessToken, session.user.id);
  expect(api).toHaveBeenCalledWith(
    '/me/push-tokens/ExponentPushToken%5Bpersisted%5D',
    expect.objectContaining({ method: 'DELETE', auth: false, headers: { Authorization: 'Bearer ' + session.accessToken } }),
  );
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('own');
});

it('does not register a late token response under a different logged-in account', async () => {
  let finish!: (value: { data: string }) => void;
  (Notifications.getExpoPushTokenAsync as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = registerPush();
  // Permission lookup precedes the OS token request.
  await Promise.resolve();
  await Promise.resolve();
  (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'different-owner' } });
  finish({ data: 'ExponentPushToken[late]' });
  expect(await pending).toBeNull();
  expect(api).not.toHaveBeenCalled();
});

it('local reminders carry account and lead identity; logged-out scheduling creates nothing', async () => {
  const due = new Date(Date.now() + 3600_000);
  await scheduleReminder('Follow-up', 'Local test', due, 15, 'lead-1');
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({ content: expect.objectContaining({ data: { localReminder: true, recipientUserId: session.user.id, leadId: 'lead-1' } }) }),
  );
  (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
  (authStore.get as jest.Mock).mockReturnValue(null);
  await scheduleReminder('Follow-up', 'Local test', due, 15, 'lead-1');
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
