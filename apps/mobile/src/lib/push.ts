import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { api, authStore } from './api';

let lastRegistration: { userId: string; token: string } | null = null;
const TOKEN_KEY = 'biq.push-registration';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

/** Registers the Expo push token with the API (no-op on simulators / when denied). */
export async function registerPush() {
  const session = authStore.get();
  if (!session) return null;
  if (!Device.isDevice && Platform.OS !== 'android') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#4F46E5',
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('brokeriq_notifications', {
      name: 'BrokerIQ Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#4F46E5',
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId ?? 'a92f8cc4-87c0-476c-aaae-513bfa29ad08';
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (authStore.get()?.user.id !== session.user.id) return null;
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
    return data;
  } catch (err) {
    console.warn('Push registration error:', (err as Error)?.message);
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
    });
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

/** Local reminder N minutes before a follow-up/visit (works offline). */
export async function scheduleReminder(title: string, body: string, at: Date, minutesBefore = 15, leadId?: string) {
  const recipientUserId = authStore.get()?.user.id;
  if (!recipientUserId) return null;
  const when = new Date(at.getTime() - minutesBefore * 60_000);
  if (when.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { localReminder: true, recipientUserId, leadId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  });
}
