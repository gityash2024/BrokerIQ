import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { post } from '@/lib/api';
import { useTimeTrackingStore } from '@/lib/time-tracking-store';

export const RECORDING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes (900,000 ms)
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

class PeriodicLocationTrackerEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove?: () => void } | null = null;
  private lastPingTime: number | null = null;
  private isProcessing = false;
  private shiftId: string | null = null;

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

    // 1. Schedule 15-minute periodic recording
    this.timer = setInterval(() => {
      this.recordPeriodicLocation();
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
  stop() {
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
    const store = useTimeTrackingStore.getState();
    if (!store.isPunchedIn || !store.activeShift) return false;

    let servicesEnabled = false;
    let permissionGranted = false;

    try {
      servicesEnabled = Boolean(await Location.hasServicesEnabledAsync());
      const perm = await Location.getForegroundPermissionsAsync();
      permissionGranted = Boolean(
        perm?.granted ||
        perm?.status === Location.PermissionStatus.GRANTED
      );
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
          // Update store status to active
          await store.resumeShift({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
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
   * Record periodic location (called every 15 minutes).
   */
  async recordPeriodicLocation(): Promise<boolean> {
    if (this.isProcessing) return false;
    const store = useTimeTrackingStore.getState();
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
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

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
          address = [geo.name, geo.street, geo.city || geo.subregion, geo.postalCode]
            .filter(Boolean)
            .join(', ');
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
      });

      this.lastPingTime = Date.now();
      return true;
    } catch {
      // Coordinate acquisition failed -> Auto-pause
      await store.pauseShift('GPS_SIGNAL_LOST');
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
  }) {
    const fullPayload: OfflineLocationPing = {
      ...payload,
      source: 'MOBILE',
      capturedAt: new Date().toISOString(),
    };

    try {
      const res = await post<{ success: boolean; autoResumed?: boolean; status: string }>(
        '/time-logging/location',
        fullPayload,
      );
      // If backend auto-resumed the shift, synchronize local store
      if (res.autoResumed || res.status === 'ACTIVE') {
        const store = useTimeTrackingStore.getState();
        if (store.isPaused && store.pauseReason === 'GPS_SIGNAL_LOST') {
          useTimeTrackingStore.setState({ isPaused: false, pauseReason: null });
        }
      }
      // Successfully communicated with backend -> flush any older offline queue items
      await this.flushOfflineQueue();
    } catch {
      // Network drop: Save to offline queue so breadcrumb is never lost
      await this.enqueueOfflineLocation(fullPayload);
    }
  }

  /**
   * Handle AppState transitions (e.g. background to foreground).
   */
  private handleAppStateChange = async (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      const store = useTimeTrackingStore.getState();
      if (!store.isPunchedIn || !store.activeShift) return;

      // Check GPS health immediately on return
      await this.checkGpsHealth();

      // If more than 15 minutes have elapsed since last ping, record immediately
      if (this.lastPingTime && Date.now() - this.lastPingTime >= RECORDING_INTERVAL_MS) {
        await this.recordPeriodicLocation();
      }

      // Flush offline queue
      await this.flushOfflineQueue();
    }
  };

  /**
   * Offline Queue: Append unsent ping to SecureStore.
   */
  private async enqueueOfflineLocation(item: OfflineLocationPing) {
    try {
      const raw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
      const queue: OfflineLocationPing[] = raw ? JSON.parse(raw) : [];
      queue.push(item);
      // Keep at most 200 items in offline cache to prevent storage bloat
      const trimmed = queue.slice(-200);
      await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore secure store write failure
    }
  }

  /**
   * Offline Queue: Upload cached pings when network is restored.
   */
  async flushOfflineQueue(): Promise<number> {
    try {
      const raw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
      if (!raw) return 0;
      const queue: OfflineLocationPing[] = JSON.parse(raw);
      if (!queue.length) return 0;

      const remaining: OfflineLocationPing[] = [];
      let sentCount = 0;

      for (const item of queue) {
        try {
          await post('/time-logging/location', item);
          sentCount++;
        } catch {
          // Stop flushing if network fails again
          remaining.push(item);
        }
      }

      if (remaining.length) {
        await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      } else {
        await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
      }
      return sentCount;
    } catch {
      return 0;
    }
  }

  /**
   * Get current tracker status snapshot.
   */
  getStatus(): TrackerStatus {
    const store = useTimeTrackingStore.getState();
    return {
      isRunning: !!this.timer,
      isPaused: store.isPaused,
      pauseReason: store.pauseReason,
      lastPingTime: this.lastPingTime,
      nextPingTime: this.lastPingTime ? this.lastPingTime + RECORDING_INTERVAL_MS : null,
      offlineQueueCount: 0,
      gpsEnabled: !store.isPaused || store.pauseReason !== 'GPS_SIGNAL_LOST',
    };
  }
}

export const periodicLocationTracker = new PeriodicLocationTrackerEngine();
