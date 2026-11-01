import { create } from './store';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { alert } from './i18n';
import { api, post, authStore, errorMessage } from './api';
import type { AgentShiftDto, ShiftIntervalDto, ShiftLocationDto, ShiftStatus } from '@brokeriq/shared';
import { tr } from './i18n';

const STORAGE_KEY = 'biq.time_tracking';

async function safeSecureStoreSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Ignore storage failure
  }
}

async function safeSecureStoreDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore storage failure
  }
}

import { trackingBinding } from './shift-location-outbox';
import { configureBackgroundShift } from './background-shift-tracking';
import { periodicLocationTracker } from './periodic-location-tracker';

interface PersistedState {
  userId: string;
  activeShift: AgentShiftDto | null;
  isPunchedIn: boolean;
  isPaused: boolean;
  pauseReason: string | null;
  lastRecordedLocation?: ShiftLocationDto | null;
  lastSyncAt: string;
}

export interface TodaySummary {
  date: string;
  activeMinutes: number;
  pausedMinutes: number;
  checkpoints: number;
  shiftsCount: number;
}

export interface TimeTrackingState {
  // Core Shift State
  activeShift: AgentShiftDto | null;
  isPunchedIn: boolean;
  isPaused: boolean;
  pauseReason: string | null;
  currentInterval?: ShiftIntervalDto | null;
  lastRecordedLocation?: ShiftLocationDto | null;
  elapsedSeconds: number;

  // UI & Network State
  isLoading: boolean;
  error: string | null;
  lastSyncAt?: string;

  // Shift & Day Summary
  todaySummary?: TodaySummary;

  // Pre-flight & Hardware Checks
  isLocationServicesEnabled: boolean;
  isLocationPermissionGranted: boolean;

  // Actions
  punchIn: (notes?: string) => Promise<{ success: boolean; shift?: AgentShiftDto; error?: string }>;
  punchOut: (notes?: string) => Promise<{ success: boolean; totalMinutes?: number; error?: string }>;
  recordLocation: (
    latitude: number,
    longitude: number,
    accuracy?: number,
    address?: string,
    source?: string,
  ) => Promise<{ success: boolean; autoResumed?: boolean; error?: string }>;
  pauseShift: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  resumeShift: (reasonOrCoords?: string | { latitude?: number; longitude?: number; accuracy?: number }) => Promise<{ success: boolean; error?: string }>;
  syncStatus: () => Promise<void>;
  checkLocationPermissions: () => Promise<{ servicesEnabled: boolean; permissionGranted: boolean; error?: string }>;
  tickElapsed: () => void;
  resetError: () => void;
  loadPersistedState: () => Promise<void>;
  clearLocalShift: () => Promise<void>;
}

/**
 * Computes drift-free active elapsed seconds based on shift intervals and wall clock.
 */
export function computeActiveElapsedSeconds(shift: AgentShiftDto | null, now: Date = new Date()): number {
  if (!shift || !shift.punchInAt) return 0;
  if (shift.status === 'COMPLETED') return (shift.totalMinutes || 0) * 60;

  if (shift.intervals && shift.intervals.length > 0) {
    let totalMs = 0;
    for (const inv of shift.intervals) {
      if (inv.status === 'ACTIVE') {
        const start = new Date(inv.startTime).getTime();
        let endMs: number;
        if (inv.endTime) {
          endMs = new Date(inv.endTime).getTime();
        } else if (shift.status === 'PAUSED' && shift.pausedAt) {
          endMs = new Date(shift.pausedAt).getTime();
        } else {
          endMs = now.getTime();
        }
        totalMs += Math.max(0, endMs - start);
      }
    }
    return Math.max(0, Math.floor(totalMs / 1000));
  }

  // Fallback calculation when intervals array is not populated
  const punchInMs = new Date(shift.punchInAt).getTime();
  let endMs = now.getTime();
  if (shift.status === 'PAUSED' && shift.pausedAt) {
    endMs = new Date(shift.pausedAt).getTime();
  }
  return Math.max(0, Math.floor((endMs - punchInMs) / 1000));
}

export const useTimeTrackingStore = create<TimeTrackingState>((set, get) => ({
  activeShift: null,
  isPunchedIn: false,
  isPaused: false,
  pauseReason: null,
  currentInterval: null,
  lastRecordedLocation: null,
  elapsedSeconds: 0,
  isLoading: false,
  error: null,
  todaySummary: undefined,
  lastSyncAt: undefined,
  isLocationServicesEnabled: true,
  isLocationPermissionGranted: true,

  resetError: () => set({ error: null }),

  tickElapsed: () => {
    const { activeShift, isPunchedIn, isPaused } = get();
    if (!isPunchedIn || !activeShift || isPaused) return;
    set({ elapsedSeconds: computeActiveElapsedSeconds(activeShift) });
  },

  checkLocationPermissions: async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      const perm = await Location.getForegroundPermissionsAsync();
      const granted = perm.status === Location.PermissionStatus.GRANTED || perm.granted === true;
      set({
        isLocationServicesEnabled: servicesEnabled,
        isLocationPermissionGranted: granted,
      });
      return { servicesEnabled, permissionGranted: granted };
    } catch {
      return { servicesEnabled: false, permissionGranted: false, error: 'Failed to inspect location services' };
    }
  },

  loadPersistedState: async () => {
    const ownerId = authStore.get()?.user.id;
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (authStore.get()?.user.id !== ownerId) return;
      if (!raw) return;
      const parsed: PersistedState = JSON.parse(raw);
      const currentUser = authStore.get()?.user;

      if (!currentUser || parsed.userId !== currentUser.id) {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
        return;
      }

      const binding = await trackingBinding();
      if (authStore.get()?.user.id !== ownerId) return;
      if (binding?.ownerId === currentUser.id && binding.shiftId === parsed.activeShift?.id && !binding.enabled) {
        parsed.isPaused = true;
        parsed.pauseReason = binding.pauseReason || 'MANUAL';
        parsed.activeShift = {
          ...parsed.activeShift,
          status: 'PAUSED',
          pauseReason: parsed.pauseReason,
          pausedAt: binding.pausedAt || parsed.activeShift.pausedAt,
        };
      }
      set({
        activeShift: parsed.activeShift,
        isPunchedIn: parsed.isPunchedIn,
        isPaused: parsed.isPaused,
        pauseReason: parsed.pauseReason,
        lastRecordedLocation: parsed.lastRecordedLocation,
        elapsedSeconds: computeActiveElapsedSeconds(parsed.activeShift),
        lastSyncAt: parsed.lastSyncAt,
      });

      if (parsed.isPunchedIn && parsed.activeShift && (!parsed.isPaused || parsed.pauseReason === 'GPS_SIGNAL_LOST')) {
        periodicLocationTracker.start(parsed.activeShift.id);
      }

      // Synchronize with server to ensure freshness
      await get().syncStatus();
    } catch {
      await safeSecureStoreDelete(STORAGE_KEY);
    }
  },

  clearLocalShift: async () => {
    periodicLocationTracker.stop();
    set({
      activeShift: null,
      isPunchedIn: false,
      isPaused: false,
      pauseReason: null,
      currentInterval: null,
      lastRecordedLocation: null,
      elapsedSeconds: 0,
      isLoading: false,
      error: null,
    });
    await safeSecureStoreDelete(STORAGE_KEY);
  },

  punchIn: async (notes?: string) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Mandatory Location Services Check
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        const msg = tr('Location services are disabled. Please turn on GPS in device settings to punch in.');
        set({ isLoading: false, error: msg, isLocationServicesEnabled: false });
        throw new Error(msg);
      }

      // 2. Mandatory Location Permission Check
      const permRes = await Location.requestForegroundPermissionsAsync();
      const granted = permRes.status === Location.PermissionStatus.GRANTED || permRes.granted === true;
      if (!granted) {
        const msg = tr('Location permission is required to punch in. Please grant location access in settings.');
        set({ isLoading: false, error: msg, isLocationPermissionGranted: false });
        throw new Error(msg);
      }

      // Explain Android's Settings permission screen before opening it. No background permission prompts on app launch.
      if (Platform.OS !== 'web' && !(await Location.getBackgroundPermissionsAsync()).granted) {
        const consent = await new Promise<boolean>((resolve) =>
          alert(
            'Active shift location',
            'During an active shift, BrokerIQ records your location about every 15 minutes, including when the app is in the background. Your firm admin can view it. Manual pause, punch-out and logout stop tracking. Allow background location in Settings to continue.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Continue', onPress: () => resolve(true) },
            ],
            { cancelable: false },
          ),
        );
        if (!consent || !(await Location.requestBackgroundPermissionsAsync()).granted)
          throw new Error('Background location permission is required during an active shift.');
      }

      // 3. Acquire Coordinates
      let locationObj: Location.LocationObject;
      try {
        locationObj = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch {
        const msg = tr('Unable to acquire GPS coordinates. Please ensure you have a clear location signal.');
        set({ isLoading: false, error: msg });
        throw new Error(msg);
      }

      const { latitude, longitude, accuracy } = locationObj.coords;

      // 4. Reverse Geocode (Best Effort)
      let address: string | undefined;
      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo) {
          address = [geo.name, geo.street, geo.city || geo.subregion, geo.region].filter(Boolean).join(', ');
        }
      } catch {
        // Non-fatal if reverse geocode fails offline
      }

      // 5. Call Backend API
      const res = await post<{
        success: boolean;
        shift: AgentShiftDto;
        status: ShiftStatus;
      }>('/time-logging/punch-in', {
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        address: address ?? null,
        notes,
      });

      const shift = res.shift;
      const lastLoc: ShiftLocationDto = shift.locations?.[0] ?? {
        id: `loc_${Date.now()}`,
        shiftId: shift.id,
        userId: shift.userId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        address: address ?? null,
        source: 'MOBILE',
        capturedAt: new Date().toISOString(),
      };

      const curInterval = shift.intervals?.find((i) => !i.endTime && i.status === 'ACTIVE');

      set({
        activeShift: shift,
        isPunchedIn: true,
        isPaused: false,
        pauseReason: null,
        currentInterval: curInterval ?? null,
        lastRecordedLocation: lastLoc,
        elapsedSeconds: 0,
        isLoading: false,
        error: null,
        lastSyncAt: new Date().toISOString(),
      });

      // Persist to SecureStore
      const currentUser = authStore.get()?.user;
      if (currentUser) {
        const persistedData: PersistedState = {
          userId: currentUser.id,
          activeShift: shift,
          isPunchedIn: true,
          isPaused: false,
          pauseReason: null,
          lastRecordedLocation: lastLoc,
          lastSyncAt: new Date().toISOString(),
        };
        await safeSecureStoreSet(STORAGE_KEY, JSON.stringify(persistedData));
      }

      // Start periodic tracker
      periodicLocationTracker.start(shift.id);

      // Refresh today summary counts
      try {
        await get().syncStatus();
      } catch {
        // Ignore background sync error
      }
      return { success: true, shift };
    } catch (err) {
      const msg = errorMessage(err);
      set({ isLoading: false, error: msg });
      throw err instanceof Error ? err : new Error(msg);
    }
  },

  punchOut: async (notes?: string) => {
    const { activeShift } = get();
    if (!activeShift) {
      const msg = tr('No active shift found to punch out');
      set({ error: msg });
      throw new Error(msg);
    }

    set({ isLoading: true, error: null });
    try {
      // Best-effort coordinates on punch-out
      let lat: number | undefined;
      let lng: number | undefined;
      let acc: number | undefined;
      let address: string | undefined;

      try {
        const isEnabled = await Location.hasServicesEnabledAsync();
        if (isEnabled) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          acc = loc.coords.accuracy ?? undefined;
          const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (geo) address = [geo.name, geo.street, geo.city || geo.subregion, geo.region].filter(Boolean).join(', ');
        }
      } catch {
        // Non-blocking for punch out
      }

      const res = await post<{
        success: boolean;
        shift: AgentShiftDto;
        status: ShiftStatus;
        totalMinutes: number;
      }>('/time-logging/punch-out', {
        shiftId: activeShift.id,
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        address,
        notes,
      });

      // Stop periodic tracker
      periodicLocationTracker.stop();

      set({
        activeShift: null,
        isPunchedIn: false,
        isPaused: false,
        pauseReason: null,
        currentInterval: null,
        lastRecordedLocation: null,
        elapsedSeconds: 0,
        isLoading: false,
        error: null,
        lastSyncAt: new Date().toISOString(),
      });

      await safeSecureStoreDelete(STORAGE_KEY);
      try {
        await get().syncStatus();
      } catch {
        // Ignore background sync error
      }

      return { success: true, totalMinutes: res.totalMinutes };
    } catch (err) {
      const msg = errorMessage(err);
      set({ isLoading: false, error: msg });
      throw err instanceof Error ? err : new Error(msg);
    }
  },

  recordLocation: async (latitude: number, longitude: number, accuracy?: number, address?: string, source = 'MOBILE') => {
    const { activeShift } = get();
    if (!activeShift) return { success: false, error: 'No active shift' };

    try {
      const res = await post<{
        success: boolean;
        locationId: string;
        status: ShiftStatus;
        autoResumed: boolean;
      }>('/time-logging/location', {
        shiftId: activeShift.id,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        address: address ?? null,
        source,
      });

      const updatedLoc: ShiftLocationDto = {
        id: res.locationId,
        shiftId: activeShift.id,
        userId: activeShift.userId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        address: address ?? null,
        source,
        capturedAt: new Date().toISOString(),
      };

      const isResumed = res.autoResumed || res.status === 'ACTIVE';

      set((state) => ({
        lastRecordedLocation: updatedLoc,
        isPaused: isResumed ? false : state.isPaused,
        pauseReason: isResumed ? null : state.pauseReason,
        activeShift: state.activeShift
          ? {
              ...state.activeShift,
              status: res.status,
              pauseReason: isResumed ? null : state.activeShift.pauseReason,
            }
          : null,
        lastSyncAt: new Date().toISOString(),
      }));

      return { success: true, autoResumed: res.autoResumed };
    } catch (err) {
      return { success: false, error: errorMessage(err) };
    }
  },

  pauseShift: async (reason = 'MANUAL') => {
    const { activeShift } = get();
    if (!activeShift) return { success: false, error: 'No active shift' };

    set({ isLoading: true, error: null });
    try {
      const res = await post<{
        success: boolean;
        shiftId: string;
        status: 'PAUSED';
        pauseReason: string;
        pausedAt: string;
        shift?: AgentShiftDto;
      }>('/time-logging/pause', {
        shiftId: activeShift.id,
        reason,
      });

      set((state) => ({
        isLoading: false,
        isPaused: true,
        pauseReason: res.pauseReason,
        activeShift:
          res.shift ??
          (state.activeShift
            ? {
                ...state.activeShift,
                status: 'PAUSED',
                pauseReason: res.pauseReason,
                pausedAt: res.pausedAt,
              }
            : null),
      }));

      if (res.pauseReason !== 'GPS_SIGNAL_LOST') {
        periodicLocationTracker.stop({ shiftId: activeShift.id, reason: res.pauseReason, at: res.pausedAt });
        await configureBackgroundShift(activeShift.id, false, { reason: res.pauseReason, at: res.pausedAt });
      }
      return { success: true };
    } catch (err) {
      const msg = errorMessage(err);
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  resumeShift: async (reasonOrCoords?: string | { latitude?: number; longitude?: number; accuracy?: number }) => {
    const { activeShift } = get();
    if (!activeShift) return { success: false, error: 'No active shift' };

    set({ isLoading: true, error: null });
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      let acc: number | undefined;

      if (typeof reasonOrCoords === 'object' && reasonOrCoords !== null) {
        lat = reasonOrCoords.latitude;
        lng = reasonOrCoords.longitude;
        acc = reasonOrCoords.accuracy;
      } else {
        try {
          const isEnabled = await Location.hasServicesEnabledAsync();
          if (isEnabled) {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
            acc = loc.coords.accuracy ?? undefined;
          }
        } catch {
          // Non-fatal
        }
      }

      const res = await post<{
        success: boolean;
        shiftId: string;
        status: 'ACTIVE';
        shift?: AgentShiftDto;
      }>('/time-logging/resume', {
        shiftId: activeShift.id,
        latitude: lat,
        longitude: lng,
        accuracy: acc,
      });

      set((state) => ({
        isLoading: false,
        isPaused: false,
        pauseReason: null,
        activeShift:
          res.shift ??
          (state.activeShift
            ? {
                ...state.activeShift,
                status: 'ACTIVE',
                pauseReason: null,
                pausedAt: null,
              }
            : null),
      }));

      periodicLocationTracker.start(activeShift.id);
      return { success: true };
    } catch (err) {
      const msg = errorMessage(err);
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  syncStatus: async () => {
    const ownerId = authStore.get()?.user.id;
    try {
      const res = await api<{
        activeShift: (AgentShiftDto & { currentMinutes: number }) | null;
        status: 'ACTIVE' | 'PAUSED' | 'OFF_DUTY';
        todaySummary: TodaySummary;
        lastKnownLocation: ShiftLocationDto | null;
      }>('/time-logging/status');
      if (authStore.get()?.user.id !== ownerId) return;

      if (res.activeShift) {
        const isPaused = res.activeShift.status === 'PAUSED';
        const curInterval = res.activeShift.intervals?.find((i) => !i.endTime);

        set({
          activeShift: res.activeShift,
          isPunchedIn: true,
          isPaused,
          pauseReason: isPaused ? (res.activeShift.pauseReason ?? 'MANUAL') : null,
          currentInterval: curInterval ?? null,
          lastRecordedLocation: res.lastKnownLocation ?? null,
          elapsedSeconds: computeActiveElapsedSeconds(res.activeShift),
          todaySummary: res.todaySummary,
          lastSyncAt: new Date().toISOString(),
        });

        if (!isPaused || res.activeShift.pauseReason === 'GPS_SIGNAL_LOST') {
          periodicLocationTracker.start(res.activeShift.id);
        } else
          periodicLocationTracker.stop({
            shiftId: res.activeShift.id,
            reason: res.activeShift.pauseReason || 'MANUAL',
            at: res.activeShift.pausedAt || new Date().toISOString(),
          });

        // Update local secure storage with confirmed backend shift
        const currentUser = authStore.get()?.user;
        if (currentUser) {
          const persisted: PersistedState = {
            userId: currentUser.id,
            activeShift: res.activeShift,
            isPunchedIn: true,
            isPaused,
            pauseReason: isPaused ? (res.activeShift.pauseReason ?? 'MANUAL') : null,
            lastRecordedLocation: res.lastKnownLocation ?? null,
            lastSyncAt: new Date().toISOString(),
          };
          await safeSecureStoreSet(STORAGE_KEY, JSON.stringify(persisted));
        }
      } else {
        const hadActive = get().isPunchedIn;
        periodicLocationTracker.stop();
        set({
          activeShift: null,
          isPunchedIn: false,
          isPaused: false,
          pauseReason: null,
          currentInterval: null,
          elapsedSeconds: 0,
          todaySummary: res.todaySummary,
          lastSyncAt: new Date().toISOString(),
        });
        if (hadActive) {
          await safeSecureStoreDelete(STORAGE_KEY);
        }
      }
    } catch {
      // Soft failure on background sync
    }
  },
}));
