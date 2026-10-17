import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { dashboardPeriod, dashboardQuerySchema } from '../dashboard';
import { inventoryPublishSchema } from '../publishing';
test('IST reporting days cross UTC midnight correctly', () => {
  const p = dashboardPeriod(dashboardQuerySchema.parse({ days: 7 }), new Date('2026-10-16T19:00:00Z'));
  assert.equal(p.to, '2026-10-17');
  assert.equal(p.from, '2026-10-11');
  assert.equal(p.start.toISOString(), '2026-10-10T18:30:00.000Z');
  assert.equal(p.end.toISOString(), '2026-10-17T18:30:00.000Z');
});
test('reporting rejects invalid calendars, inverted and unbounded ranges', () => {
  for (const q of [
    { from: '2026-02-30', to: '2026-03-02' },
    { from: '2026-10-17', to: '2026-10-16' },
    { from: '2024-01-01', to: '2026-01-01' },
    { from: '2026-01-01' },
  ])
    assert.equal(dashboardQuerySchema.safeParse(q).success, false);
});
test('publish rejects raw private ledger fields and missing preview confirmation', () => {
  const base = {
    title: 'Two bedroom rental',
    propertyType: 'APARTMENT',
    price: 20000,
    localityId: 'real-locality',
    contactPhone: '+919876543210',
    confirmedAvailable: true,
    publicPreviewAccepted: true,
    expectedRevision: 1,
  };
  assert.equal(inventoryPublishSchema.safeParse(base).success, true);
  assert.equal(inventoryPublishSchema.safeParse({ ...base, ownerPhone: '+919876543210', notes: 'private register' }).success, false);
  assert.equal(inventoryPublishSchema.safeParse({ ...base, publicPreviewAccepted: false }).success, false);
});
import { errorOrigin } from '../design';
test('M_ID extension stack is attributed externally while mixed/app failures remain visible', () => {
  const ext =
    "TypeError: Cannot read properties of undefined (reading 'M_ID')\n    at Y (chrome-extension://extension/executors/200.js:1:761)\n    at E (chrome-extension://extension/executors/200.js:1:1442)";
  assert.equal(errorOrigin(ext), 'BROWSER_EXTENSION');
  assert.equal(errorOrigin(ext + '\n at render (https://brokeriq.example/_next/a.js:1:2)'), 'FIRST_PARTY');
  assert.equal(errorOrigin('TypeError: M_ID'), 'FIRST_PARTY');
});
