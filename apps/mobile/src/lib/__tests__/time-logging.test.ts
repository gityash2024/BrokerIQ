import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useTimeTrackingStore } from '../time-tracking-store';
import { periodicLocationTracker, RECORDING_INTERVAL_MS, HEALTH_CHECK_INTERVAL_MS } from '../periodic-location-tracker';
import * as apiModule from '../api';

// Mocks
jest.mock('expo-location', () => ({
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: { Balanced: 3, High: 4 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../api', () => ({
  post: jest.fn(),
  api: jest.fn(),
  authStore: {
    get: jest.fn(() => ({ user: { id: 'agent_1' } })),
  },
  errorMessage: (err: any) => err?.message || 'Error',
}));

describe('Time Logging & Periodic Location Tracking Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    periodicLocationTracker.stop();
    (apiModule.api as jest.Mock).mockResolvedValue({
      activeShift: null,
      status: 'OFF_DUTY',
      todaySummary: { date: '2026-10-31', activeMinutes: 0, pausedMinutes: 0, checkpoints: 0, shiftsCount: 0 },
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
    });
  });

  afterEach(() => {
    periodicLocationTracker.stop();
    jest.useRealTimers();
  });

  // Test 1: Mandatory GPS Gating
  it('rejects punch-in if location services are disabled on device', async () => {
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);

    await expect(useTimeTrackingStore.getState().punchIn()).rejects.toThrow(
      /Location services are disabled|Turn on GPS/i,
    );
    expect(useTimeTrackingStore.getState().isPunchedIn).toBe(false);
    expect(apiModule.post).not.toHaveBeenCalled();
  });

  it('rejects punch-in if foreground location permission is denied', async () => {
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      granted: false,
    });

    await expect(useTimeTrackingStore.getState().punchIn()).rejects.toThrow(
      /Location permission is required|Permission denied/i,
    );
    expect(useTimeTrackingStore.getState().isPunchedIn).toBe(false);
    expect(apiModule.post).not.toHaveBeenCalled();
  });

  // Test 2: Successful Punch-In starts tracker
  it('succeeds punch-in when GPS granted, initializes shift and starts periodic tracker', async () => {
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 28.4595, longitude: 77.0266, accuracy: 12 },
    });
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
      { name: 'DLF Cyber City', street: 'DLF Phase 2', city: 'Gurugram', postalCode: '122002' },
    ]);

    (apiModule.post as jest.Mock).mockResolvedValue({
      success: true,
      shift: {
        id: 'shift_123',
        userId: 'agent_1',
        organizationId: 'org_1',
        punchInAt: new Date().toISOString(),
        status: 'ACTIVE',
        totalMinutes: 0,
      },
      status: 'ACTIVE',
    });
    (apiModule.api as jest.Mock).mockResolvedValue({
      activeShift: {
        id: 'shift_123',
        userId: 'agent_1',
        punchInAt: new Date().toISOString(),
        status: 'ACTIVE',
      },
      status: 'ACTIVE',
      todaySummary: { date: '2026-10-31', activeMinutes: 0, pausedMinutes: 0, checkpoints: 1, shiftsCount: 1 },
      lastKnownLocation: null,
    });

    await useTimeTrackingStore.getState().punchIn();

    expect(useTimeTrackingStore.getState().isPunchedIn).toBe(true);
    expect(useTimeTrackingStore.getState().activeShift?.id).toBe('shift_123');
    expect(periodicLocationTracker.getStatus().isRunning).toBe(true);
  });

  // Test 3: 15-Minute Periodic Location Recording
  it('records location and sends to backend every 15 minutes', async () => {
    // Setup active shift
    useTimeTrackingStore.setState({
      activeShift: { id: 'shift_123', status: 'ACTIVE', punchInAt: new Date().toISOString(), totalMinutes: 0 } as any,
      isPunchedIn: true,
      isPaused: false,
      pauseReason: null,
    });

    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 28.4601, longitude: 77.028, accuracy: 10 },
    });
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
      { name: 'Golf Course Road', street: 'Sector 54', city: 'Gurugram' },
    ]);
    (apiModule.post as jest.Mock).mockResolvedValue({ success: true, status: 'ACTIVE' });

    await periodicLocationTracker.start('shift_123');

    // Advance 15 minutes (900,000 ms)
    await jest.advanceTimersByTimeAsync(RECORDING_INTERVAL_MS);

    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.Balanced,
    });
    expect(apiModule.post).toHaveBeenCalledWith(
      '/time-logging/location',
      expect.objectContaining({
        shiftId: 'shift_123',
        latitude: 28.4601,
        longitude: 77.028,
        source: 'MOBILE',
      }),
    );
  });

  // Test 4: Auto-Pause when GPS is lost
  it('triggers auto-pause when GPS service becomes disabled during health check', async () => {
    useTimeTrackingStore.setState({
      activeShift: { id: 'shift_123', status: 'ACTIVE', punchInAt: new Date().toISOString(), totalMinutes: 0 } as any,
      isPunchedIn: true,
      isPaused: false,
      pauseReason: null,
    });

    (apiModule.post as jest.Mock).mockResolvedValue({
      success: true,
      shiftId: 'shift_123',
      status: 'PAUSED',
      pauseReason: 'GPS_SIGNAL_LOST',
      pausedAt: new Date().toISOString(),
    });

    await periodicLocationTracker.start('shift_123');

    // Simulate GPS service turned off by user
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);

    // Advance by 30 seconds (health check)
    await jest.advanceTimersByTimeAsync(HEALTH_CHECK_INTERVAL_MS);

    expect(apiModule.post).toHaveBeenCalledWith(
      '/time-logging/pause',
      expect.objectContaining({
        shiftId: 'shift_123',
        reason: 'GPS_SIGNAL_LOST',
      }),
    );
    expect(useTimeTrackingStore.getState().isPaused).toBe(true);
    expect(useTimeTrackingStore.getState().pauseReason).toBe('GPS_SIGNAL_LOST');
  });

  // Test 5: Auto-Resume when GPS is restored
  it('triggers auto-resume when GPS service is restored after GPS_SIGNAL_LOST', async () => {
    useTimeTrackingStore.setState({
      activeShift: { id: 'shift_123', status: 'PAUSED', punchInAt: new Date().toISOString(), totalMinutes: 0 } as any,
      isPunchedIn: true,
      isPaused: true,
      pauseReason: 'GPS_SIGNAL_LOST',
    });

    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 28.465, longitude: 77.03, accuracy: 15 },
    });

    (apiModule.post as jest.Mock).mockImplementation((path: string) => {
      if (path === '/time-logging/location') {
        return Promise.resolve({ success: true, status: 'ACTIVE', autoResumed: true });
      }
      if (path === '/time-logging/resume') {
        return Promise.resolve({ success: true, status: 'ACTIVE' });
      }
      return Promise.resolve({ success: true });
    });

    await periodicLocationTracker.start('shift_123');

    // Advance by 30 seconds
    await jest.advanceTimersByTimeAsync(HEALTH_CHECK_INTERVAL_MS);

    expect(useTimeTrackingStore.getState().isPaused).toBe(false);
    expect(useTimeTrackingStore.getState().pauseReason).toBeNull();
  });

  // Test 6: Manual Pause Immunity
  it('does NOT auto-resume if shift was paused manually by user (e.g. LUNCH_BREAK)', async () => {
    useTimeTrackingStore.setState({
      activeShift: { id: 'shift_123', status: 'PAUSED', punchInAt: new Date().toISOString(), totalMinutes: 0 } as any,
      isPunchedIn: true,
      isPaused: true,
      pauseReason: 'LUNCH_BREAK', // Manual pause
    });

    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await periodicLocationTracker.start('shift_123');

    // Advance timers
    await jest.advanceTimersByTimeAsync(HEALTH_CHECK_INTERVAL_MS * 2);

    // Must remain paused
    expect(useTimeTrackingStore.getState().isPaused).toBe(true);
    expect(useTimeTrackingStore.getState().pauseReason).toBe('LUNCH_BREAK');
  });

  // Test 7: Punch-Out stops tracker and cleans up
  it('stops periodic tracker and clears intervals on punch-out', async () => {
    useTimeTrackingStore.setState({
      activeShift: { id: 'shift_123', status: 'ACTIVE', punchInAt: new Date().toISOString(), totalMinutes: 0 } as any,
      isPunchedIn: true,
      isPaused: false,
      pauseReason: null,
    });

    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 28.46, longitude: 77.02, accuracy: 10 },
    });
    (apiModule.post as jest.Mock).mockResolvedValue({
      success: true,
      shift: { id: 'shift_123', status: 'COMPLETED', totalMinutes: 120 },
      status: 'COMPLETED',
      totalMinutes: 120,
    });

    await periodicLocationTracker.start('shift_123');
    expect(periodicLocationTracker.getStatus().isRunning).toBe(true);

    await useTimeTrackingStore.getState().punchOut();

    expect(periodicLocationTracker.getStatus().isRunning).toBe(false);
    expect(useTimeTrackingStore.getState().isPunchedIn).toBe(false);
    expect(useTimeTrackingStore.getState().activeShift).toBeNull();
  });

  // Test 8: Offline Queueing on Network Failure
  it('queues location breadcrumb in SecureStore if network request fails', async () => {
    useTimeTrackingStore.setState({
      activeShift: { id: 'shift_123', status: 'ACTIVE', punchInAt: new Date().toISOString(), totalMinutes: 0 } as any,
      isPunchedIn: true,
      isPaused: false,
      pauseReason: null,
    });

    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 28.46, longitude: 77.02, accuracy: 10 },
    });
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([]);

    // Network throws
    (apiModule.post as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    await periodicLocationTracker.recordPeriodicLocation();

    // Verify it saved to SecureStore
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'biq.time_logging.offline_locations',
      expect.stringContaining('shift_123'),
    );
    // Crucial: shift was NOT auto-paused because GPS was fine, only network dropped!
    expect(useTimeTrackingStore.getState().isPaused).toBe(false);
  });
});
