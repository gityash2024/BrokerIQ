import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followUpDateBoundary, followUpIstDayEnd, followUpQuerySchema, followUpTomorrowAtTen } from '../follow-ups';

test('follow-up calendar boundaries are explicitly IST across UTC midnight/year/leap day', () => {
  assert.equal(followUpIstDayEnd(new Date('2026-12-31T20:00:00Z')).toISOString(), '2027-01-01T18:29:59.999Z');
  assert.equal(followUpIstDayEnd(new Date('2026-11-02T18:29:59.999Z')).toISOString(), '2026-11-02T18:29:59.999Z');
  assert.equal(followUpIstDayEnd(new Date('2026-11-02T18:30:00Z')).toISOString(), '2026-11-03T18:29:59.999Z');
  assert.equal(followUpDateBoundary('2028-02-29'), '2028-02-28T18:30:00.000Z');
  assert.equal(followUpDateBoundary('2028-02-29', true), '2028-02-29T18:29:59.999Z');
  assert.equal(followUpTomorrowAtTen(new Date('2026-12-31T20:00:00Z')).toISOString(), '2027-01-02T04:30:00.000Z');
  for (const invalid of ['2026-02-29', '2026-02-31', '2026-13-01', '2026-11-2', '']) assert.equal(followUpDateBoundary(invalid), null);
});

test('follow-up queries reject malformed dates, status and unbounded pagination', () => {
  for (const invalid of [
    { status: 'anything' },
    { view: 'anything' },
    { from: '2026-02-31T10:00:00Z' },
    { from: '2026-11-02T10:00:00' },
    { from: '2026-11-03T00:00:00Z', to: '2026-11-02T00:00:00Z' },
    { page: '0' },
    { pageSize: '101' },
    { page: 'Infinity' },
    { page: 1e12 },
    { assignedToId: ['a', 'b'] },
  ])
    assert.equal(followUpQuerySchema.safeParse(invalid).success, false);
  assert.equal(followUpQuerySchema.parse({ from: '2026-11-02T10:00:00+05:30' }).pageSize, 30);
});
