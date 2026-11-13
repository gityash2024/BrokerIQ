let mockBinding: any = null;
let mockTask: any;
const mockStart = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockStarted = jest.fn().mockResolvedValue(true);
const mockQueue = jest.fn().mockResolvedValue(true);
jest.mock('expo-task-manager', () => ({ isTaskDefined: () => false, defineTask: (_name: string, callback: any) => { mockTask = callback; } }));
jest.mock('expo-location', () => ({
  hasStartedLocationUpdatesAsync: (...args: any[]) => mockStarted(...args),
  startLocationUpdatesAsync: (...args: any[]) => mockStart(...args),
  stopLocationUpdatesAsync: (...args: any[]) => mockStop(...args),
  getBackgroundPermissionsAsync: async () => ({ granted: true }), Accuracy: { Balanced: 3 },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-event-10min' }));
jest.mock('../api', () => ({ authStore: { get: () => ({ user: { id: 'owner' } }) }, useSession: { getState: () => ({ ready: true }) }, registerSessionReset: jest.fn() }));
jest.mock('../shift-location-outbox', () => ({
  trackingBinding: async () => mockBinding,
  setTrackingBinding: async (value: any) => { mockBinding = value; },
  queueBoundShiftPing: (...args: any[]) => mockQueue(...args), flushShiftPings: jest.fn().mockResolvedValue(0),
}));
const { configureBackgroundShift, SHIFT_LOCATION_INTERVAL } = require('../background-shift-tracking') as typeof import('../background-shift-tracking');
beforeEach(() => { jest.clearAllMocks(); mockBinding = null; mockStarted.mockResolvedValue(true); });
it('upgrades a previous 15-minute native registration and keeps repeat sync idempotent', async () => {
  mockBinding = { ownerId: 'owner', shiftId: 'shift', enabled: true, intervalMs: 900_000 };
  mockStarted.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValue(true);
  await configureBackgroundShift('shift');
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(mockStart).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeInterval: 600_000, deferredUpdatesInterval: 600_000 }));
  await configureBackgroundShift('shift');
  expect(mockStop).toHaveBeenCalledTimes(1); expect(mockStart).toHaveBeenCalledTimes(1);
});
it('records an unchanged coordinate at ten minutes but rejects an early callback', async () => {
  expect(SHIFT_LOCATION_INTERVAL).toBe(600_000);
  const before = Date.now() - 600_000;
  mockBinding = { ownerId: 'owner', shiftId: 'shift', enabled: true, lastCapturedAt: before };
  await mockTask({ data: { locations: [{ timestamp: before + 599_999, coords: { latitude: 28, longitude: 77, accuracy: 10 } }, { timestamp: before + 600_000, coords: { latitude: 28, longitude: 77, accuracy: 10 } }] } });
  expect(mockQueue).toHaveBeenCalledTimes(1);
  expect(mockQueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ capturedAt: new Date(before + 600_000).toISOString() }));
});
it('does not capture after a manual pause', async () => {
  mockBinding = { ownerId: 'owner', shiftId: 'shift', enabled: false, pauseReason: 'MANUAL' };
  await mockTask({ data: { locations: [{ timestamp: Date.now(), coords: { latitude: 28, longitude: 77, accuracy: 10 } }] } });
  expect(mockQueue).not.toHaveBeenCalled(); expect(mockStop).toHaveBeenCalled();
});
