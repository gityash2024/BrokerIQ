import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

let lastToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

/** Registers the Expo push token with the API (no-op on simulators / when denied). */
export async function registerPush() {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Default', importance: Notifications.AndroidImportance.HIGH, lightColor: '#4F46E5' });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    lastToken = data;
    await api('/me/push-tokens', { method: 'POST', body: { token: data, platform: Platform.OS } });
    return data;
  } catch {
    return null;
  }
}

export async function unregisterPush() {
  if (lastToken) await api(`/me/push-tokens/${encodeURIComponent(lastToken)}`, { method: 'DELETE' });
  lastToken = null;
}

/** Local reminder N minutes before a follow-up/visit (works offline). */
export async function scheduleReminder(title: string, body: string, at: Date, minutesBefore = 15) {
  const when = new Date(at.getTime() - minutesBefore * 60_000);
  if (when.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when } });
}
