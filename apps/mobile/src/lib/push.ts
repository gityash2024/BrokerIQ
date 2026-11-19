import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { api, authStore } from './api';
import { create } from './store';
import { reportAppError } from './report-error';

let lastRegistration: { userId: string; token: string } | null = null;
const TOKEN_KEY = 'biq.push-registration';
type PushStatus = 'permission' | 'channel' | 'device' | 'expo' | 'server' | 'ready';
export const usePushRegistration = create<{ userId: string | null; status: PushStatus | null }>(() => ({ userId: null, status: null }));

async function waitForProvider<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Push registration timed out')), 20_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

/** Registers the Expo push token with the API (no-op on simulators / when denied). */
export async function registerPush(requestPermission = true, refreshedToken?: Notifications.DevicePushToken) {
  const session = authStore.get();
  if (!session) return null;
  if (!Device.isDevice && Platform.OS !== 'android') return null;
  const setStatus = (status: PushStatus) => {
    if (authStore.get()?.user.id === session.user.id) usePushRegistration.setState({ userId: session.user.id, status });
  };
  let stage: PushStatus = 'permission';
  try {
    let channel: Notifications.NotificationChannel | null = null;
    if (Platform.OS === 'android') {
      // Expo uses the system sound when omitted. A string here names a bundled audio file.
      channel = await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#4F46E5',
        vibrationPattern: [0, 250, 250, 250],
      });
      await Notifications.setNotificationChannelAsync('brokeriq_notifications', {
        name: 'BrokerIQ Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#4F46E5',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted' && requestPermission && permission.canAskAgain !== false) permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      setStatus('permission');
      return null;
    }
    if (channel && channel.importance === Notifications.AndroidImportance.NONE) {
      setStatus('channel');
      return null;
    }
    stage = 'device';
    const devicePushToken = refreshedToken ?? (await waitForProvider(Notifications.getDevicePushTokenAsync()));
    if (authStore.get()?.user.id !== session.user.id) return null;
    stage = 'expo';
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? 'a92f8cc4-87c0-476c-aaae-513bfa29ad08';
    const { data } = await waitForProvider(Notifications.getExpoPushTokenAsync({ projectId, devicePushToken }));
    if (authStore.get()?.user.id !== session.user.id) return null;
    stage = 'server';
    await api('/me/push-tokens', { method: 'POST', body: { token: data, platform: Platform.OS }, ownerId: session.user.id });
    if (authStore.get()?.user.id !== session.user.id) {
      await api(`/me/push-tokens/${encodeURIComponent(data)}`, {
        method: 'DELETE',
        auth: false,
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).catch(() => undefined);
      return null;
    }
    const registration = { userId: session.user.id, token: data };
    await SecureStore.setItemAsync(TOKEN_KEY + '.' + session.user.id, JSON.stringify(registration));
    if (authStore.get()?.user.id !== session.user.id) {
      await SecureStore.deleteItemAsync(TOKEN_KEY + '.' + session.user.id);
      await api(`/me/push-tokens/${encodeURIComponent(data)}`, {
        method: 'DELETE',
        auth: false,
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).catch(() => undefined);
      return null;
    }
    lastRegistration = registration;
    setStatus('ready');
    return data;
  } catch {
    setStatus(stage);
    // Provider errors can include tokens or response bodies. Report only the failed step.
    reportAppError(new Error('Device push setup failed at ' + stage), '/notifications');
    return null;
  }
}

export async function unregisterPush(accessToken?: string, ownerId?: string) {
  if (!ownerId) return;
  const key = TOKEN_KEY + '.' + ownerId;
  const persisted = await SecureStore.getItemAsync(key)
    .then((value) => (value ? (JSON.parse(value) as { token: string }) : null))
    .catch(() => null);
  const token = lastRegistration?.userId === ownerId ? lastRegistration.token : persisted?.token;
  if (lastRegistration?.userId === ownerId) lastRegistration = null;
  await SecureStore.deleteItemAsync(key);
  if (token)
    await api(`/me/push-tokens/${encodeURIComponent(token)}`, {
      method: 'DELETE',
      ...(accessToken ? { auth: false, headers: { Authorization: `Bearer ${accessToken}` } } : {}),
    }).catch(() => undefined);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.content.data?.recipientUserId === ownerId).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  const displayed = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    displayed.filter((n) => n.request.content.data?.recipientUserId === ownerId).map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
  );
  await Notifications.setBadgeCountAsync(0);
}

export { scheduleReminder, reconcileLocalReminders } from './local-reminders';
