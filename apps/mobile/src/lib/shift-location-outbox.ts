import { privateDraftDatabase } from '@/launch/drafts';
import { api, ApiError, authStore } from './api';

export interface ShiftPing {
  eventId: string;
  shiftId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string | null;
  capturedAt: string;
  source: string;
}
export interface TrackingBinding {
  ownerId: string;
  shiftId: string;
  enabled: boolean;
  lastCapturedAt?: number;
  intervalMs?: number;
  pauseReason?: string;
  pausedAt?: string;
}
async function database() {
  const db = await privateDraftDatabase();
  await db.execAsync(`CREATE TABLE IF NOT EXISTS shift_location_outbox (
    event_id TEXT NOT NULL, owner_id TEXT NOT NULL, shift_id TEXT NOT NULL, captured_at TEXT NOT NULL,
    payload TEXT NOT NULL, error TEXT, blocked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,event_id)
  ); CREATE INDEX IF NOT EXISTS shift_outbox_owner ON shift_location_outbox(owner_id,blocked,captured_at);`);
  return db;
}
export async function trackingBinding(): Promise<TrackingBinding | null> {
  const row = await (await database()).getFirstAsync<{ value: string }>('SELECT value FROM local_settings WHERE key=?', 'shift.tracking.v1');
  return row ? JSON.parse(row.value) : null;
}
export async function setTrackingBinding(binding: TrackingBinding | null) {
  const db = await database();
  if (binding) await db.runAsync('INSERT OR REPLACE INTO local_settings(key,value) VALUES(?,?)', 'shift.tracking.v1', JSON.stringify(binding));
  else await db.runAsync('DELETE FROM local_settings WHERE key=?', 'shift.tracking.v1');
}
export async function queueShiftPing(ownerId: string, ping: ShiftPing) {
  // Ownership is stored with each event, independently of the currently signed-in account.
  const db = await database();
  const result = await db.runAsync(
    'INSERT OR IGNORE INTO shift_location_outbox(event_id,owner_id,shift_id,captured_at,payload) VALUES(?,?,?,?,?)',
    ping.eventId,
    ownerId,
    ping.shiftId,
    ping.capturedAt,
    JSON.stringify(ping),
  );
  if (!result.changes) {
    const existing = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM shift_location_outbox WHERE owner_id=? AND event_id=?',
      ownerId,
      ping.eventId,
    );
    if (existing?.payload !== JSON.stringify(ping)) throw new Error('Location event ID conflict; the original capture was preserved.');
  }
}

/** Conditional writes prevent a delayed callback from restoring a binding cleared by pause/logout. */
export async function queueBoundShiftPing(binding: TrackingBinding, ping: ShiftPing) {
  const db = await database();
  const expected = JSON.stringify(binding);
  const result = await db.runAsync(
    'INSERT OR IGNORE INTO shift_location_outbox(event_id,owner_id,shift_id,captured_at,payload) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM local_settings WHERE key=? AND value=?)',
    ping.eventId,
    binding.ownerId,
    ping.shiftId,
    ping.capturedAt,
    JSON.stringify(ping),
    'shift.tracking.v1',
    expected,
  );
  if (!result.changes) return false;
  await db.runAsync(
    'UPDATE local_settings SET value=? WHERE key=? AND value=?',
    JSON.stringify({ ...binding, lastCapturedAt: Date.parse(ping.capturedAt) }),
    'shift.tracking.v1',
    expected,
  );
  return true;
}
let flushing: Promise<number> | null = null;
export function flushShiftPings(): Promise<number> {
  flushing ??= flush().finally(() => {
    flushing = null;
  });
  return flushing;
}
async function flush() {
  const owner = authStore.get()?.user.id;
  if (!owner) return 0;
  const db = await database();
  const rows = await db.getAllAsync<{ event_id: string; payload: string }>(
    'SELECT event_id,payload FROM shift_location_outbox WHERE owner_id=? AND blocked=0 ORDER BY captured_at,event_id',
    owner,
  );
  let sent = 0;
  for (const row of rows) {
    if (authStore.get()?.user.id !== owner) break;
    try {
      const result = await api<{ acknowledged?: boolean }>('/time-logging/location', { body: JSON.parse(row.payload), ownerId: owner });
      if (!result.acknowledged) throw new Error('Server did not acknowledge location event');
      await db.runAsync('DELETE FROM shift_location_outbox WHERE event_id=? AND owner_id=?', row.event_id, owner);
      sent++;
    } catch (error) {
      // Permanent rejections remain recoverable for review; network/auth outages retain FIFO pending rows.
      if (error instanceof ApiError && [400, 403, 404, 409].includes(error.status)) {
        await db.runAsync('UPDATE shift_location_outbox SET blocked=1,error=? WHERE event_id=? AND owner_id=?', error.message, row.event_id, owner);
        continue;
      }
      break;
    }
  }
  return sent;
}
export async function pendingShiftPings() {
  const owner = authStore.get()?.user.id;
  if (!owner) return { pending: 0, blocked: 0 };
  const rows = await (
    await database()
  ).getAllAsync<{ blocked: number; n: number }>('SELECT blocked,COUNT(*) AS n FROM shift_location_outbox WHERE owner_id=? GROUP BY blocked', owner);
  return { pending: rows.find((r) => !r.blocked)?.n || 0, blocked: rows.find((r) => r.blocked)?.n || 0 };
}
