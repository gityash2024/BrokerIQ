/** Actual SQLite SQL semantics via Node's SQLite adapter; native SQLCipher/device durability is a separate acceptance gate. */
jest.mock('@/launch/drafts', () => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as any;
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE local_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  return {
    privateDraftDatabase: async () => ({
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, ...params: any[]) => db.prepare(sql).run(...params),
      getFirstAsync: async (sql: string, ...params: any[]) => db.prepare(sql).get(...params) || null,
      getAllAsync: async (sql: string, ...params: any[]) => db.prepare(sql).all(...params),
    }),
  };
});
jest.mock('../api', () => {
  class ApiError extends Error {
    status: number;
    body: any;
    constructor(code: number, payload: any) {
      super(payload.message);
      this.status = code;
      this.body = payload;
    }
  }
  return { ApiError, api: jest.fn(), authStore: { get: jest.fn(() => ({ user: { id: 'owner-a' } })) } };
});
import { privateDraftDatabase } from '@/launch/drafts';
import { api, ApiError, authStore } from '../api';
import { flushShiftPings, pendingShiftPings, queueShiftPing, queueBoundShiftPing, setTrackingBinding, trackingBinding } from '../shift-location-outbox';
const ping = (id: string, time = '2026-11-01T06:00:00Z') => ({
  eventId: id,
  shiftId: 'shift-a',
  latitude: 28.45,
  longitude: 77.02,
  source: 'NATIVE_BACKGROUND',
  capturedAt: time,
});
beforeEach(async () => {
  jest.clearAllMocks();
  (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'owner-a' } });
  await pendingShiftPings();
  const db = await privateDraftDatabase();
  await db.execAsync('DELETE FROM shift_location_outbox; DELETE FROM local_settings;');
  (api as jest.Mock).mockResolvedValue({ acknowledged: true });
});
it('keeps original timestamps, deduplicates event IDs and sends only the current account in capture order', async () => {
  await queueShiftPing('owner-b', ping('other-owner'));
  await queueShiftPing('owner-a', ping('second', '2026-11-01T06:15:00Z'));
  await queueShiftPing('owner-a', ping('first'));
  await queueShiftPing('owner-a', ping('first'));
  expect((await pendingShiftPings()).pending).toBe(2);
  expect(await flushShiftPings()).toBe(2);
  expect((api as jest.Mock).mock.calls.map((c) => c[1].body.eventId)).toEqual(['first', 'second']);
  expect((api as jest.Mock).mock.calls[0][1]).toMatchObject({ ownerId: 'owner-a', body: { capturedAt: '2026-11-01T06:00:00Z' } });
  (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'owner-b' } });
  expect((await pendingShiftPings()).pending).toBe(1);
});
it('retains the failed and later FIFO events after a network interruption', async () => {
  for (const id of ['a', 'b', 'c']) await queueShiftPing('owner-a', ping(id));
  (api as jest.Mock).mockResolvedValueOnce({ acknowledged: true }).mockRejectedValueOnce(new Error('offline'));
  expect(await flushShiftPings()).toBe(1);
  expect((await pendingShiftPings()).pending).toBe(2);
  expect(api).toHaveBeenCalledTimes(2);
});
it('does not acknowledge an event when the server response omits the acknowledgement', async () => {
  await queueShiftPing('owner-a', ping('no-ack'));
  (api as jest.Mock).mockResolvedValue({ success: true });
  expect(await flushShiftPings()).toBe(0);
  expect((await pendingShiftPings()).pending).toBe(1);
});
it('preserves permanent rejections for review and continues valid later events', async () => {
  await queueShiftPing('owner-a', ping('a'));
  await queueShiftPing('owner-a', ping('b'));
  (api as jest.Mock).mockRejectedValueOnce(new ApiError(409, { statusCode: 409, code: 'CONFLICT', message: 'event conflict' }));
  expect(await flushShiftPings()).toBe(1);
  expect(await pendingShiftPings()).toEqual({ pending: 0, blocked: 1 });
});
it('stops dispatch immediately after an account changes', async () => {
  await queueShiftPing('owner-a', ping('a'));
  await queueShiftPing('owner-a', ping('b'));
  (api as jest.Mock).mockImplementationOnce(async () => {
    (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'owner-b' } });
    return { acknowledged: true };
  });
  expect(await flushShiftPings()).toBe(1);
  expect(api).toHaveBeenCalledTimes(1);
  (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'owner-a' } });
  expect((await pendingShiftPings()).pending).toBe(1);
});
it('stores the active owner/shift binding independently from cached UI state', async () => {
  await setTrackingBinding({ ownerId: 'owner-a', shiftId: 'shift-a', enabled: true });
  expect(await trackingBinding()).toEqual({ ownerId: 'owner-a', shiftId: 'shift-a', enabled: true });
  await setTrackingBinding(null);
  expect(await trackingBinding()).toBeNull();
});

it('a delayed native callback cannot resurrect a paused tracking binding', async () => {
  const binding = { ownerId: 'owner-a', shiftId: 'shift-a', enabled: true };
  await setTrackingBinding(binding);
  await setTrackingBinding(null);
  expect(await queueBoundShiftPing(binding, ping('late'))).toBe(false);
  expect((await pendingShiftPings()).pending).toBe(0);
  expect(await trackingBinding()).toBeNull();
});
it('preserves the original capture on a local event ID conflict', async () => {
  await queueShiftPing('owner-a', ping('same-id'));
  await expect(queueShiftPing('owner-a', { ...ping('same-id'), latitude: 29 })).rejects.toThrow('conflict');
  expect((await pendingShiftPings()).pending).toBe(1);
});
