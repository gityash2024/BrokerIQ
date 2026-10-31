import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { AppState, type AppStateStatus } from 'react-native';
import {
  useTimeTrackingStore,
  computeActiveElapsedSeconds,
} from '../time-tracking-store';
import {
  periodicLocationTracker,
  RECORDING_INTERVAL_MS,
  HEALTH_CHECK_INTERVAL_MS,
  OFFLINE_QUEUE_KEY,
  type OfflineLocationPing,
} from '../periodic-location-tracker';
import * as apiModule from '../api';

// Mocks
jest.mock('expo-location', () => ({
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: { Balanced: 3, High: 4 },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
}));

jest.mock('expo-secure-store', () => {
  let store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItemAsync: jest.fn((key: string, val: string) => {
      store[key] = val;
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    __resetStore: () => {
      store = {};
    },
    __getStore: () => store,
  };
});

jest.mock('../api', () => ({
  post: jest.fn(),
  api: jest.fn(),
  authStore: {
    get: jest.fn(() => ({ user: { id: 'agent_adversarial_1' } })),
  },
  errorMessage: (err: any) => err?.message || 'Error',
}));

describe('Milestone 3 Mobile Time Logging — Empirical Adversarial Stress Suite', () => {
  let appStateListener: ((state: AppStateStatus) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (SecureStore as any).__resetStore();

    // Capture AppState listener if registered
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: any, handler: any) => {
      if (event === 'change') {
        appStateListener = handler;
      }
      return { remove: jest.fn() } as any;
    });

    periodicLocationTracker.stop();

    (apiModule.api as jest.Mock).mockResolvedValue({
      activeShift: null,
      status: 'OFF_DUTY',
      todaySummary: {
        date: '2026-10-31',
        activeMinutes: 0,
        pausedMinutes: 0,
        checkpoints: 0,
        shiftsCount: 0,
      },
      lastKnownLocation: null,
    });

    useTimeTrackingStore.setState({
      activeShift: null,
      isPunchedIn: false,
      isPaused: false,
      pauseReason: null,
      lastRecordedLocation: null,
      elapsedSeconds: 0,
      isLoading: false,
      error: null,
      isLocationServicesEnabled: true,
      isLocationPermissionGranted: true,
    });
  });

  afterEach(() => {
    periodicLocationTracker.stop();
    jest.useRealTimers();
  });

  // =========================================================================
  // 1. MANDATORY GPS GATING ADVERSARIAL STRESS
  // =========================================================================
  describe('1. Mandatory GPS Gating', () => {
    it('STRESS-1.1: Rejects punch-in when Location.hasServicesEnabledAsync returns false', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);

      await expect(useTimeTrackingStore.getState().punchIn()).rejects.toThrow(
        /Location services are disabled/i,
      );
      expect(useTimeTrackingStore.getState().isPunchedIn).toBe(false);
      expect(useTimeTrackingStore.getState().isLocationServicesEnabled).toBe(false);
      expect(apiModule.post).not.toHaveBeenCalled();
    });

    it('STRESS-1.2: Rejects punch-in when Location.hasServicesEnabledAsync throws hardware error', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockRejectedValue(
        new Error('Hardware sensor bus failure'),
      );

      await expect(useTimeTrackingStore.getState().punchIn()).rejects.toThrow(
        /Hardware sensor bus failure/i,
      );
      expect(useTimeTrackingStore.getState().isPunchedIn).toBe(false);
      expect(apiModule.post).not.toHaveBeenCalled();
    });

    it('STRESS-1.3: Rejects punch-in when foreground permission is DENIED', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.DENIED,
        granted: false,
      });

      await expect(useTimeTrackingStore.getState().punchIn()).rejects.toThrow(
        /Location permission is required/i,
      );
      expect(useTimeTrackingStore.getState().isPunchedIn).toBe(false);
      expect(useTimeTrackingStore.getState().isLocationPermissionGranted).toBe(false);
      expect(apiModule.post).not.toHaveBeenCalled();
    });

    it('STRESS-1.4: Rejects punch-in when foreground permission is UNDETERMINED and not granted', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.UNDETERMINED,
        granted: false,
      });

      await expect(useTimeTrackingStore.getState().punchIn()).rejects.toThrow(
        /Location permission is required/i,
      );
      expect(useTimeTrackingStore.getState().isPunchedIn).toBe(false);
      expect(apiModule.post).not.toHaveBeenCalled();
    });

    it('STRESS-1.5: Rejects punch-in when getCurrentPositionAsync fails with GPS timeout / null coordinates', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        granted: true,
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
        new Error('Location provider timed out after 10000ms'),
      );

      await expect(useTimeTrackingStore.getState().punchIn()).rejects.toThrow(
        /Unable to acquire GPS coordinates/i,
      );
      expect(useTimeTrackingStore.getState().isPunchedIn).toBe(false);
      expect(apiModule.post).not.toHaveBeenCalled();
    });

    it('STRESS-1.6: Successfully punches in with valid coordinates and initializes state', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        granted: true,
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 28.5355, longitude: 77.391, accuracy: 8.5 },
      });
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        { name: 'Tower B', street: 'Sector 62', city: 'Noida', region: 'UP' },
      ]);

      (apiModule.post as jest.Mock).mockResolvedValue({
        success: true,
        shift: {
          id: 'shift_valid_1',
          userId: 'agent_adversarial_1',
          organizationId: 'org_1',
          punchInAt: new Date().toISOString(),
          status: 'ACTIVE',
          totalMinutes: 0,
        },
        status: 'ACTIVE',
      });

      (apiModule.api as jest.Mock).mockResolvedValue({
        activeShift: {
          id: 'shift_valid_1',
          userId: 'agent_adversarial_1',
          punchInAt: new Date().toISOString(),
          status: 'ACTIVE',
        },
        status: 'ACTIVE',
        todaySummary: {
          date: '2026-10-31',
          activeMinutes: 0,
          pausedMinutes: 0,
          checkpoints: 1,
          shiftsCount: 1,
        },
        lastKnownLocation: null,
      });

      const res = await useTimeTrackingStore.getState().punchIn();
      expect(res.success).toBe(true);
      expect(useTimeTrackingStore.getState().isPunchedIn).toBe(true);
      expect(useTimeTrackingStore.getState().activeShift?.id).toBe('shift_valid_1');
      expect(periodicLocationTracker.getStatus().isRunning).toBe(true);
    });
  });

  // =========================================================================
  // 2. TIMER PRECISION & DRIFT-FREE WALL-CLOCK CALCULATION
  // =========================================================================
  describe('2. Timer Precision and Wall-Clock Calculation', () => {
    it('STRESS-2.1: Returns 0 for null shift or shift without punchInAt', () => {
      expect(computeActiveElapsedSeconds(null)).toBe(0);
      expect(computeActiveElapsedSeconds({ id: 's1' } as any)).toBe(0);
    });

    it('STRESS-2.2: Returns fixed totalMinutes * 60 for COMPLETED shifts', () => {
      const shift = {
        id: 's_completed',
        status: 'COMPLETED',
        punchInAt: '2026-10-31T08:00:00Z',
        totalMinutes: 485, // 8h 5m
      } as any;
      expect(computeActiveElapsedSeconds(shift)).toBe(485 * 60);
    });

    it('STRESS-2.3: Single interval active shift calculates exact wall-clock difference', () => {
      const punchIn = new Date('2026-10-31T09:00:00.000Z');
      const now = new Date('2026-10-31T10:35:12.000Z'); // 1h 35m 12s = 5712s

      const shift = {
        id: 's1',
        status: 'ACTIVE',
        punchInAt: punchIn.toISOString(),
      } as any;

      expect(computeActiveElapsedSeconds(shift, now)).toBe(5712);
    });

    it('STRESS-2.4: Multi-interval shift sums ONLY active intervals and ignores pauses', () => {
      // 09:00 - 11:00: ACTIVE (2 hours = 7200s)
      // 11:00 - 11:45: PAUSED (break, ignored)
      // 11:45 - 13:15: ACTIVE (1.5 hours = 5400s)
      // 13:15 - 13:30: PAUSED (GPS loss, ignored)
      // 13:30 - now (14:00): ACTIVE (30 min = 1800s)
      // Total active = 7200 + 5400 + 1800 = 14400s (4 hours)
      const now = new Date('2026-10-31T14:00:00.000Z');

      const shift = {
        id: 's_multi',
        status: 'ACTIVE',
        punchInAt: '2026-10-31T09:00:00.000Z',
        intervals: [
          {
            id: 'inv_1',
            status: 'ACTIVE',
            startTime: '2026-10-31T09:00:00.000Z',
            endTime: '2026-10-31T11:00:00.000Z',
          },
          {
            id: 'inv_2',
            status: 'PAUSED',
            startTime: '2026-10-31T11:00:00.000Z',
            endTime: '2026-10-31T11:45:00.000Z',
          },
          {
            id: 'inv_3',
            status: 'ACTIVE',
            startTime: '2026-10-31T11:45:00.000Z',
            endTime: '2026-10-31T13:15:00.000Z',
          },
          {
            id: 'inv_4',
            status: 'PAUSED',
            startTime: '2026-10-31T13:15:00.000Z',
            endTime: '2026-10-31T13:30:00.000Z',
          },
          {
            id: 'inv_5',
            status: 'ACTIVE',
            startTime: '2026-10-31T13:30:00.000Z',
            endTime: null, // open interval
          },
        ],
      } as any;

      expect(computeActiveElapsedSeconds(shift, now)).toBe(14400);
    });

    it('STRESS-2.5: Paused shift with pausedAt freezes timer at exact pause timestamp', () => {
      // Punched in at 09:00:00
      // Paused at 10:30:00 (1.5 hours = 5400s)
      // Current time is 18:00:00 (9 hours later!)
      const now = new Date('2026-10-31T18:00:00.000Z');

      const shiftWithIntervals = {
        id: 's_paused_inv',
        status: 'PAUSED',
        punchInAt: '2026-10-31T09:00:00.000Z',
        pausedAt: '2026-10-31T10:30:00.000Z',
        intervals: [
          {
            id: 'inv_1',
            status: 'ACTIVE',
            startTime: '2026-10-31T09:00:00.000Z',
            endTime: null,
          },
        ],
      } as any;

      expect(computeActiveElapsedSeconds(shiftWithIntervals, now)).toBe(5400);

      const shiftWithoutIntervals = {
        id: 's_paused_fallback',
        status: 'PAUSED',
        punchInAt: '2026-10-31T09:00:00.000Z',
        pausedAt: '2026-10-31T10:30:00.000Z',
      } as any;

      expect(computeActiveElapsedSeconds(shiftWithoutIntervals, now)).toBe(5400);
    });

    it('STRESS-2.6: App backgrounding simulation: instant wall-clock catchup without drift', () => {
      const punchInTime = new Date('2026-10-31T09:00:00.000Z');
      const shift = {
        id: 's_bg',
        status: 'ACTIVE',
        punchInAt: punchInTime.toISOString(),
      } as any;

      useTimeTrackingStore.setState({
        activeShift: shift,
        isPunchedIn: true,
        isPaused: false,
        elapsedSeconds: 0,
      });

      // Advance time by 4 hours 15 minutes (15,300 seconds)
      const afterBackgrounding = new Date('2026-10-31T13:15:00.000Z');
      const elapsed = computeActiveElapsedSeconds(shift, afterBackgrounding);
      expect(elapsed).toBe(15300);

      // Verify non-negative clamping on negative clock delta (user changes clock backwards)
      const pastTime = new Date('2026-10-31T08:00:00.000Z');
      expect(computeActiveElapsedSeconds(shift, pastTime)).toBe(0);
    });
  });

  // =========================================================================
  // 3. PERIODIC 15-MINUTE LOCATION RECORDING & REVERSE GEOCODE FALLBACK
  // =========================================================================
  describe('3. Periodic 15-Minute Location Recording & Geocode Fallback', () => {
    it('STRESS-3.1: Verifies exact 15-minute recording cycle (900,000 ms)', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_periodic_1',
          userId: 'agent_adversarial_1',
          status: 'ACTIVE',
          punchInAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: false,
      });

      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 28.6139, longitude: 77.209, accuracy: 15 },
      });
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        { name: 'Connaught Place', city: 'New Delhi' },
      ]);
      (apiModule.post as jest.Mock).mockResolvedValue({ success: true, status: 'ACTIVE' });

      await periodicLocationTracker.start('shift_periodic_1');

      // Advance to 14 minutes 59 seconds -> no periodic ping yet
      await jest.advanceTimersByTimeAsync(14 * 60 * 1000 + 59 * 1000);
      expect(apiModule.post).not.toHaveBeenCalledWith(
        '/time-logging/location',
        expect.anything(),
      );

      // Advance 1 more second to reach 15m (900,000ms)
      await jest.advanceTimersByTimeAsync(1000);

      expect(apiModule.post).toHaveBeenCalledWith(
        '/time-logging/location',
        expect.objectContaining({
          shiftId: 'shift_periodic_1',
          latitude: 28.6139,
          longitude: 77.209,
          accuracy: 15,
          address: 'Connaught Place, New Delhi',
          source: 'MOBILE',
        }),
      );
    });

    it('STRESS-3.2: Reverse geocode fallback: gracefully proceeds when reverseGeocodeAsync returns empty array []', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_periodic_2',
          userId: 'agent_adversarial_1',
          status: 'ACTIVE',
          punchInAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: false,
      });

      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 19.076, longitude: 72.8777, accuracy: 5 },
      });
      // Empty reverse geocode array
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([]);
      (apiModule.post as jest.Mock).mockResolvedValue({ success: true, status: 'ACTIVE' });

      const success = await periodicLocationTracker.recordPeriodicLocation();
      expect(success).toBe(true);

      expect(apiModule.post).toHaveBeenCalledWith(
        '/time-logging/location',
        expect.objectContaining({
          shiftId: 'shift_periodic_2',
          latitude: 19.076,
          longitude: 72.8777,
          accuracy: 5,
          address: null,
          source: 'MOBILE',
        }),
      );
    });

    it('STRESS-3.3: Reverse geocode fallback: gracefully proceeds when reverseGeocodeAsync throws offline error', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_periodic_3',
          userId: 'agent_adversarial_1',
          status: 'ACTIVE',
          punchInAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: false,
      });

      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 20 },
      });
      // Geocode throws network error
      (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValue(
        new Error('Reverse geocoding network unavailable'),
      );
      (apiModule.post as jest.Mock).mockResolvedValue({ success: true, status: 'ACTIVE' });

      const success = await periodicLocationTracker.recordPeriodicLocation();
      expect(success).toBe(true);

      expect(apiModule.post).toHaveBeenCalledWith(
        '/time-logging/location',
        expect.objectContaining({
          shiftId: 'shift_periodic_3',
          latitude: 12.9716,
          longitude: 77.5946,
          accuracy: 20,
          address: null,
          source: 'MOBILE',
        }),
      );
    });
  });

  // =========================================================================
  // 4. AUTO-PAUSE & AUTO-RESUME UPON DYNAMIC GPS LOSS/RESTORATION
  // =========================================================================
  describe('4. Auto-Pause & Auto-Resume on GPS Signal State Transitions', () => {
    it('STRESS-4.1: Auto-pauses shift when GPS service is disabled during 30s health check', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_autopre_1',
          userId: 'agent_adversarial_1',
          status: 'ACTIVE',
          punchInAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: false,
        pauseReason: null,
      });

      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

      (apiModule.post as jest.Mock).mockResolvedValue({
        success: true,
        shiftId: 'shift_autopre_1',
        status: 'PAUSED',
        pauseReason: 'GPS_SIGNAL_LOST',
        pausedAt: new Date().toISOString(),
      });

      await periodicLocationTracker.start('shift_autopre_1');

      // User disables GPS in device settings
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);

      // Advance to 30s health check
      await jest.advanceTimersByTimeAsync(HEALTH_CHECK_INTERVAL_MS);

      expect(apiModule.post).toHaveBeenCalledWith(
        '/time-logging/pause',
        expect.objectContaining({
          shiftId: 'shift_autopre_1',
          reason: 'GPS_SIGNAL_LOST',
        }),
      );
      expect(useTimeTrackingStore.getState().isPaused).toBe(true);
      expect(useTimeTrackingStore.getState().pauseReason).toBe('GPS_SIGNAL_LOST');

      // Idempotency: Subsequent health check while still disabled does NOT re-trigger pause
      (apiModule.post as jest.Mock).mockClear();
      await jest.advanceTimersByTimeAsync(HEALTH_CHECK_INTERVAL_MS);
      expect(apiModule.post).not.toHaveBeenCalledWith(
        '/time-logging/pause',
        expect.anything(),
      );
    });

    it('STRESS-4.2: Auto-resumes shift when GPS signal is restored after GPS_SIGNAL_LOST', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_autores_1',
          userId: 'agent_adversarial_1',
          status: 'PAUSED',
          pauseReason: 'GPS_SIGNAL_LOST',
          punchInAt: new Date().toISOString(),
          pausedAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: true,
        pauseReason: 'GPS_SIGNAL_LOST',
      });

      // GPS restored
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 28.5355, longitude: 77.391, accuracy: 10 },
      });

      (apiModule.post as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === '/time-logging/location') {
          return Promise.resolve({
            success: true,
            status: 'ACTIVE',
            autoResumed: true,
            locationId: 'loc_restored_1',
          });
        }
        if (endpoint === '/time-logging/resume') {
          return Promise.resolve({
            success: true,
            shiftId: 'shift_autores_1',
            status: 'ACTIVE',
          });
        }
        return Promise.resolve({ success: true });
      });

      await periodicLocationTracker.start('shift_autores_1');

      // Advance by 30 seconds
      await jest.advanceTimersByTimeAsync(HEALTH_CHECK_INTERVAL_MS);

      // Verify breadcrumb and resume were dispatched
      expect(apiModule.post).toHaveBeenCalledWith(
        '/time-logging/location',
        expect.objectContaining({
          shiftId: 'shift_autores_1',
          latitude: 28.5355,
          longitude: 77.391,
        }),
      );
      expect(apiModule.post).toHaveBeenCalledWith(
        '/time-logging/resume',
        expect.objectContaining({
          shiftId: 'shift_autores_1',
          latitude: 28.5355,
          longitude: 77.391,
        }),
      );

      // Store must now be ACTIVE
      expect(useTimeTrackingStore.getState().isPaused).toBe(false);
      expect(useTimeTrackingStore.getState().pauseReason).toBeNull();
      expect(useTimeTrackingStore.getState().activeShift?.status).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // 5. MANUAL PAUSE ISOLATION (BREAK / LUNCH PROTECTION)
  // =========================================================================
  describe('5. Manual Pause Isolation', () => {
    it('STRESS-5.1: Agent on MANUAL break is NOT auto-resumed by periodic tracker health checks even if GPS is healthy', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_manual_break_1',
          userId: 'agent_adversarial_1',
          status: 'PAUSED',
          pauseReason: 'LUNCH_BREAK',
          punchInAt: new Date().toISOString(),
          pausedAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: true,
        pauseReason: 'LUNCH_BREAK',
      });

      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 28.45, longitude: 77.02, accuracy: 10 },
      });

      await periodicLocationTracker.start('shift_manual_break_1');

      // Simulate 10 consecutive health check cycles (300 seconds)
      for (let i = 0; i < 10; i++) {
        await jest.advanceTimersByTimeAsync(HEALTH_CHECK_INTERVAL_MS);
      }

      // CRITICAL ASSERTION: No resume or location calls dispatched!
      expect(apiModule.post).not.toHaveBeenCalledWith(
        '/time-logging/resume',
        expect.anything(),
      );
      expect(apiModule.post).not.toHaveBeenCalledWith(
        '/time-logging/location',
        expect.anything(),
      );

      // Shift remains strictly paused
      expect(useTimeTrackingStore.getState().isPaused).toBe(true);
      expect(useTimeTrackingStore.getState().pauseReason).toBe('LUNCH_BREAK');
    });

    it('STRESS-5.2: 15-minute periodic location recording is suppressed while shift is on manual break', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_manual_break_2',
          userId: 'agent_adversarial_1',
          status: 'PAUSED',
          pauseReason: 'PERSONAL_TIME',
          punchInAt: new Date().toISOString(),
          pausedAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: true,
        pauseReason: 'PERSONAL_TIME',
      });

      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

      const recorded = await periodicLocationTracker.recordPeriodicLocation();
      expect(recorded).toBe(false);
      expect(apiModule.post).not.toHaveBeenCalled();
    });

    it('STRESS-5.3: AppState change to active does NOT auto-resume manual break', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_manual_break_3',
          userId: 'agent_adversarial_1',
          status: 'PAUSED',
          pauseReason: 'DOCTOR_APPOINTMENT',
          punchInAt: new Date().toISOString(),
          pausedAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: true,
        pauseReason: 'DOCTOR_APPOINTMENT',
      });

      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

      await periodicLocationTracker.start('shift_manual_break_3');

      // Trigger AppState change to active (user unlocks phone)
      if (appStateListener) {
        await appStateListener('active');
      }

      expect(useTimeTrackingStore.getState().isPaused).toBe(true);
      expect(useTimeTrackingStore.getState().pauseReason).toBe('DOCTOR_APPOINTMENT');
      expect(apiModule.post).not.toHaveBeenCalledWith(
        '/time-logging/resume',
        expect.anything(),
      );
    });
  });

  // =========================================================================
  // 6. OFFLINE QUEUEING & FIFO PRESERVATION IN SECURESTORE
  // =========================================================================
  describe('6. Offline Queueing & FIFO Queue Preservation', () => {
    it('STRESS-6.1: Enqueues location breadcrumb in SecureStore upon network drop without pausing shift', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_offline_1',
          userId: 'agent_adversarial_1',
          status: 'ACTIVE',
          punchInAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: false,
        pauseReason: null,
      });

      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 28.4595, longitude: 77.0266, accuracy: 12 },
      });
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([]);

      // Simulate network request failure
      (apiModule.post as jest.Mock).mockRejectedValue(new Error('Network connection offline (503)'));

      await periodicLocationTracker.recordPeriodicLocation();

      // Verify item enqueued to SecureStore
      const rawQueue = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
      expect(rawQueue).not.toBeNull();
      const queue: OfflineLocationPing[] = JSON.parse(rawQueue!);
      expect(queue.length).toBe(1);
      expect(queue[0].shiftId).toBe('shift_offline_1');
      expect(queue[0].latitude).toBe(28.4595);
      expect(queue[0].longitude).toBe(77.0266);

      // Crucial: Shift remains ACTIVE (working hours accumulation continues!)
      expect(useTimeTrackingStore.getState().isPaused).toBe(false);
    });

    it('STRESS-6.2: Preserves FIFO order across multiple offline breadcrumbs and flushes in sequence', async () => {
      useTimeTrackingStore.setState({
        activeShift: {
          id: 'shift_offline_2',
          userId: 'agent_adversarial_1',
          status: 'ACTIVE',
          punchInAt: new Date().toISOString(),
          totalMinutes: 0,
        } as any,
        isPunchedIn: true,
        isPaused: false,
      });

      // Populate 3 pings captured at T1, T2, T3
      const ping1: OfflineLocationPing = {
        shiftId: 'shift_offline_2',
        latitude: 28.451,
        longitude: 77.021,
        accuracy: 10,
        address: 'Point 1',
        source: 'MOBILE',
        capturedAt: '2026-10-31T10:00:00.000Z',
      };
      const ping2: OfflineLocationPing = {
        shiftId: 'shift_offline_2',
        latitude: 28.452,
        longitude: 77.022,
        accuracy: 11,
        address: 'Point 2',
        source: 'MOBILE',
        capturedAt: '2026-10-31T10:15:00.000Z',
      };
      const ping3: OfflineLocationPing = {
        shiftId: 'shift_offline_2',
        latitude: 28.453,
        longitude: 77.023,
        accuracy: 12,
        address: 'Point 3',
        source: 'MOBILE',
        capturedAt: '2026-10-31T10:30:00.000Z',
      };

      await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify([ping1, ping2, ping3]));

      // Mock network restoration
      const dispatchedPings: OfflineLocationPing[] = [];
      (apiModule.post as jest.Mock).mockImplementation((path: string, payload: any) => {
        if (path === '/time-logging/location') {
          dispatchedPings.push(payload);
          return Promise.resolve({ success: true, status: 'ACTIVE' });
        }
        return Promise.resolve({ success: true });
      });

      const flushedCount = await periodicLocationTracker.flushOfflineQueue();

      expect(flushedCount).toBe(3);
      expect(dispatchedPings.length).toBe(3);

      // Verify Strict FIFO Order
      expect(dispatchedPings[0].address).toBe('Point 1');
      expect(dispatchedPings[1].address).toBe('Point 2');
      expect(dispatchedPings[2].address).toBe('Point 3');

      // Verify SecureStore key is deleted after complete flush
      const remainingRaw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
      expect(remainingRaw).toBeNull();
    });

    it('STRESS-6.3: Partial flush: retains unsent items in SecureStore if network drops mid-flush', async () => {
      const ping1: OfflineLocationPing = {
        shiftId: 'shift_offline_3',
        latitude: 28.461,
        longitude: 77.031,
        source: 'MOBILE',
        capturedAt: '2026-10-31T11:00:00.000Z',
      };
      const ping2: OfflineLocationPing = {
        shiftId: 'shift_offline_3',
        latitude: 28.462,
        longitude: 77.032,
        source: 'MOBILE',
        capturedAt: '2026-10-31T11:15:00.000Z',
      };

      await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify([ping1, ping2]));

      let callIndex = 0;
      (apiModule.post as jest.Mock).mockImplementation((path: string) => {
        if (path === '/time-logging/location') {
          callIndex++;
          if (callIndex === 1) {
            return Promise.resolve({ success: true, status: 'ACTIVE' }); // First succeeds
          }
          return Promise.reject(new Error('Connection dropped')); // Second fails
        }
        return Promise.resolve({ success: true });
      });

      const flushedCount = await periodicLocationTracker.flushOfflineQueue();

      expect(flushedCount).toBe(1);

      // Remaining ping2 MUST be preserved in SecureStore
      const remainingRaw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
      expect(remainingRaw).not.toBeNull();
      const remaining: OfflineLocationPing[] = JSON.parse(remainingRaw!);
      expect(remaining.length).toBe(1);
      expect(remaining[0].latitude).toBe(28.462);
    });
  });
});
