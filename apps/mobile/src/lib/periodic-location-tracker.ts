import { SHIFT_LOCATION_INTERVAL_MS } from '@brokeriq/shared';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { authStore } from '@/lib/api';
import * as Crypto from 'expo-crypto';
import { configureBackgroundShift } from './background-shift-tracking';
import { flushShiftPings, queueShiftPing, pendingShiftPings } from './shift-location-outbox';
import type { useTimeTrackingStore } from './time-tracking-store';

export const RECORDING_INTERVAL_MS = SHIFT_LOCATION_INTERVAL_MS; // 10 minutes
export const HEALTH_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds for rapid GPS loss/restore detection
export const OFFLINE_QUEUE_KEY = 'biq.time_logging.offline_locations';

export interface OfflineLocationPing {
  shiftId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string | null;
  source: string;
  capturedAt: string;
  eventId?: string;
  ownerId?: string;
}

export interface TrackerStatus {
  isRunning: boolean;
  isPaused: boolean;
  pauseReason: string | null;
  lastPingTime: number | null;
  nextPingTime: number | null;
  offlineQueueCount: number;
  gpsEnabled: boolean;
}

export class PeriodicLocationTrackerEngine {
  constructor(private readonly store: Pick<typeof useTimeTrackingStore, 'getState' | 'setState'>) {}

  private timer: ReturnType<typeof setInterval> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove?: () => void } | null = null;
  private lastPingTime: number | null = null;
  private isProcessing = false;
  private shiftId: string | null = null;
  private offlineQueueCount = 0;

  /**
   * Start the periodic tracking engine for an active shift.
   */
  async start(shiftId: string) {
    if (this.shiftId === shiftId && this.timer) {
      return;
    }
    if (this.timer || this.healthCheckTimer) {
      this.stop();
    }
    this.shiftId = shiftId;
    this.lastPingTime = Date.now();
    configureBackgroundShift(shiftId).catch((error) => this.store.setState({ error: error.message }));

    // 1. Schedule 10-minute periodic recording
    this.timer = setInterval(() => {
      // Android/iOS capture comes from the native task, not JavaScript timers.
      if (Platform.OS === 'web') this.recordPeriodicLocation();
      else this.flushOfflineQueue().catch((error) => this.store.setState({ error: error.message }));
    }, RECORDING_INTERVAL_MS);

    // 2. Schedule 30-second rapid health check (auto-pause & auto-resume detection)
    this.healthCheckTimer = setInterval(() => {
      this.checkGpsHealth();
    }, HEALTH_CHECK_INTERVAL_MS);

    // 3. Listen to AppState changes (e.g. returning to foreground)
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Flush any pending offline queue items
    this.flushOfflineQueue().catch(() => undefined);
  }

  /**
   * Stop periodic tracking (on punch out or shift end).
   */
  stop(pause?: { shiftId: string; reason: string; at: string }) {
    configureBackgroundShift(pause?.shiftId ?? null, false, pause).catch((error) => this.store.setState({ error: error.message }));
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove?.();
      this.appStateSubscription = null;
    }
    this.shiftId = null;
    this.lastPingTime = null;
    this.isProcessing = false;
  }

  /**
   * Perform GPS health check: handles Auto-Pause when GPS is lost,
   * and Auto-Resume when GPS is restored.
   */
  async checkGpsHealth(): Promise<boolean> {
    const store = this.store.getState();
    if (!store.isPunchedIn || !store.activeShift) return false;

    let servicesEnabled = false;
    let permissionGranted = false;

    try {
      servicesEnabled = Boolean(await Location.hasServicesEnabledAsync());
      const perm = await Location.getForegroundPermissionsAsync();
      permissionGranted = Boolean(perm?.granted || perm?.status === Location.PermissionStatus.GRANTED);
    } catch {
      servicesEnabled = false;
      permissionGranted = false;
    }

    const gpsHealthy = servicesEnabled && permissionGranted;

    // CASE A: GPS LOST -> Trigger Auto-Pause
    if (!gpsHealthy && !store.isPaused) {
      await store.pauseShift('GPS_SIGNAL_LOST');
      return false;
    }

    // CASE B: GPS RESTORED -> Trigger Auto-Resume (only if auto-paused due to GPS loss)
    if (gpsHealthy && store.isPaused && store.pauseReason === 'GPS_SIGNAL_LOST') {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (pos?.coords) {
          // Send location breadcrumb which automatically resumes shift on backend
          await this.recordLocationPayload({
            shiftId: store.activeShift.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
          });
          // Only the acknowledged server state may resume a GPS pause.
          await store.syncStatus();
          this.lastPingTime = Date.now();
          return true;
        }
      } catch {
        // GPS not yet locked
        return false;
      }
    }

    return gpsHealthy;
  }

  /**
   * Record periodic location (called every 10 minutes).
   */
  async recordPeriodicLocation(): Promise<boolean> {
    if (this.isProcessing) return false;
    const store = this.store.getState();
    if (!store.isPunchedIn || !store.activeShift) return false;

    // If shift is paused for any reason, skip normal 15-min breadcrumb
    if (store.isPaused) return false;

    this.isProcessing = true;

    try {
      // 1. Verify GPS service availability
      const isHealthy = await this.checkGpsHealth();
      if (!isHealthy) {
        return false;
      }

      // 2. Acquire current GPS coordinates
      let pos: Location.LocationObject;
      try {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        await store.pauseShift('GPS_SIGNAL_LOST');
        return false;
      }

      if (!pos?.coords) {
        // GPS hardware returned empty -> Auto-pause
        await store.pauseShift('GPS_SIGNAL_LOST');
        return false;
      }

      // 3. Optional reverse geocode for human-readable address
      let address: string | null = null;
      try {
        const geos = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (geos && geos.length > 0) {
          const geo = geos[0];
          address = [geo.name, geo.street, geo.city || geo.subregion, geo.postalCode].filter(Boolean).join(', ');
        }
      } catch {
        // Geocode failure is non-fatal
      }

      // 4. Dispatch location payload
      await this.recordLocationPayload({
        shiftId: store.activeShift.id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        address,
        capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
      });

      this.lastPingTime = Date.now();
      return true;
    } catch (error) {
      // Storage/network failures are not GPS failures and must not change working time.
      this.store.setState({ error: error instanceof Error ? error.message : 'Location could not be saved' });
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send location to backend with offline queue fallback.
   */
  private async recordLocationPayload(payload: {
    shiftId: string;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    address?: string | null;
    capturedAt?: string;
  }) {
    const owner = authStore.get()?.user.id;
    if (!owner) return;
    const store = this.store.getState();
    if (store.activeShift?.id !== payload.shiftId || (store.isPaused && store.pauseReason !== 'GPS_SIGNAL_LOST')) return;
    // Persist before dispatch: a killed process cannot lose a capture between network send and enqueue.
    await queueShiftPing(owner, { ...payload, eventId: Crypto.randomUUID(), source: 'MOBILE', capturedAt: payload.capturedAt || new Date().toISOString() });
    await this.flushOfflineQueue();
  }

  /**
   * Handle AppState transitions (e.g. background to foreground).
   */
  private handleAppStateChange = async (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      const store = this.store.getState();
      if (!store.isPunchedIn || !store.activeShift) return;

      // Check GPS health immediately on return
      await this.checkGpsHealth();

      // If more than 10 minutes have elapsed since last ping, record immediately
      if (this.lastPingTime && Date.now() - this.lastPingTime >= RECORDING_INTERVAL_MS) {
        if (Platform.OS === 'web') await this.recordPeriodicLocation();
      }

      // Flush offline queue
      await this.flushOfflineQueue();
    }
  };

  /** Durable SQLCipher queue. Legacy unowned SecureStore rows are retained, never replayed under another account. */
  async flushOfflineQueue(): Promise<number> {
    const sent = await flushShiftPings();
    const count = await pendingShiftPings();
    this.offlineQueueCount = count.pending + count.blocked;
    const legacy = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
    if (legacy) this.store.setState({ error: 'Older offline location entries have no account owner. They were preserved for review.' });
    return sent;
  }

  /**
   * Get current tracker status snapshot.
   */
  getStatus(): TrackerStatus {
    const store = this.store.getState();
    return {
      isRunning: !!this.timer,
      isPaused: store.isPaused,
      pauseReason: store.pauseReason,
      lastPingTime: this.lastPingTime,
      nextPingTime: this.lastPingTime ? this.lastPingTime + RECORDING_INTERVAL_MS : null,
      offlineQueueCount: this.offlineQueueCount,
      gpsEnabled: !store.isPaused || store.pauseReason !== 'GPS_SIGNAL_LOST',
    };
  }
}
