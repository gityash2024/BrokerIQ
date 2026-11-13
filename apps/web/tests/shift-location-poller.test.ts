import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startShiftLocationPolling } from '../src/lib/shift-location-poller';
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
test('requests a new fix at ten minutes even when coordinates are unchanged; stops on cleanup', async () => {
  let callback: (() => void) | undefined;
  let cancelled = false;
  const fixes: GeolocationPosition[] = [];
  const geolocation = { getCurrentPosition(success: PositionCallback, _failure?: PositionErrorCallback | null, options?: PositionOptions) {
    assert.equal(options?.maximumAge, 0);
    success({ timestamp: Date.now(), coords: { latitude: 28, longitude: 77, accuracy: 5 } } as GeolocationPosition);
  } };
  const polling = startShiftLocationPolling(geolocation, async (position) => { fixes.push(position); }, 600_000,
    ((fn: () => void, ms: number) => { assert.equal(ms, 600_000); callback = fn; return 1; }) as any,
    (() => { cancelled = true; }) as any);
  await tick(); assert.equal(fixes.length, 1);
  callback!(); await tick(); assert.equal(fixes.length, 2);
  polling.stop(); callback!(); await tick(); assert.equal(fixes.length, 2); assert.equal(cancelled, true);
});
test('ignores stale fixes and delayed GPS completion after stop', async () => {
  let success!: PositionCallback;
  let count = 0;
  const polling = startShiftLocationPolling({ getCurrentPosition(fn) { success = fn; } }, async () => { count++; }, 600_000,
    (() => 1) as any, (() => undefined) as any);
  success({ timestamp: Date.now() - 60_000 } as GeolocationPosition); await tick(); assert.equal(count, 0);
  polling.poll(); polling.stop(); success({ timestamp: Date.now() } as GeolocationPosition); await tick(); assert.equal(count, 0);
});
