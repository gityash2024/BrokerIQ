import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { authStore, registerSessionReset, useSession } from './api';
import { flushShiftPings, queueBoundShiftPing, setTrackingBinding, trackingBinding } from './shift-location-outbox';

export const SHIFT_LOCATION_TASK = 'brokeriq.active-shift.location.v1';
export const SHIFT_LOCATION_INTERVAL = 15 * 60_000;

// Registered at module scope and imported by the root layout: headless launches must see this definition.
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(SHIFT_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(SHIFT_LOCATION_TASK, async ({ data, error }) => {
    if (!useSession.getState().ready) await authStore.load();
    const owner = authStore.get()?.user.id;
    const binding = await trackingBinding();
    if (!owner || !binding || binding.ownerId !== owner || !binding.enabled) {
      await stopNativeTracking();
      return;
    }
    if (error) return; // Permission/provider errors never fabricate successful captures.
    for (const location of data?.locations || []) {
      if (authStore.get()?.user.id !== owner) break;
      if (!Number.isFinite(location.timestamp) || (binding.lastCapturedAt && location.timestamp - binding.lastCapturedAt < SHIFT_LOCATION_INTERVAL)) continue;
      const current = await trackingBinding();
      if (!current?.enabled || current.ownerId !== owner || current.shiftId !== binding.shiftId) break;
      await queueBoundShiftPing(current, {
        eventId: Crypto.randomUUID(),
        shiftId: binding.shiftId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        capturedAt: new Date(location.timestamp).toISOString(),
        source: 'NATIVE_BACKGROUND',
      });
      binding.lastCapturedAt = location.timestamp;
    }
    await flushShiftPings();
  });
}

async function stopNativeTracking() {
  if (Platform.OS !== 'web' && (await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK)))
    await Location.stopLocationUpdatesAsync(SHIFT_LOCATION_TASK);
}
let operations = Promise.resolve();
/** Native starts/stops serialize so a delayed start cannot survive pause/logout. */
export function configureBackgroundShift(shiftId: string | null, enabled = true): Promise<void> {
  const owner = authStore.get()?.user.id;
  operations = operations
    .catch(() => undefined)
    .then(async () => {
      if (Platform.OS === 'web') return;
      if (!owner || owner !== authStore.get()?.user.id || !shiftId || !enabled) {
        await stopNativeTracking();
        await setTrackingBinding(null);
        return;
      }
      const previous = await trackingBinding();
      await setTrackingBinding({
        ownerId: owner,
        shiftId,
        enabled: true,
        lastCapturedAt: previous?.ownerId === owner && previous.shiftId === shiftId ? previous.lastCapturedAt : undefined,
      });
      const permission = await Location.getBackgroundPermissionsAsync();
      if (!permission.granted) {
        await stopNativeTracking();
        throw new Error('Background location permission is required during an active shift.');
      }
      if (!(await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK))) {
        await Location.startLocationUpdatesAsync(SHIFT_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: SHIFT_LOCATION_INTERVAL,
          distanceInterval: 0,
          deferredUpdatesInterval: SHIFT_LOCATION_INTERVAL,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: 'BrokerIQ · Active shift',
            notificationBody: 'Location is recorded during your active shift. Pause or punch out to stop.',
            notificationColor: '#4F46E5',
            killServiceOnDestroy: false,
          },
        });
      }
    });
  return operations;
}

// Covers explicit logout, revoked sessions and account switching even when broker screens unmount.
registerSessionReset(() => configureBackgroundShift(null));
