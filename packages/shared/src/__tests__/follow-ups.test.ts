import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followUpCurrentMonth, followUpMonthRange, followUpDateBoundary, followUpIstDayEnd, followUpQuerySchema, followUpTomorrowAtTen } from '../follow-ups';

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

test('monthly follow-up filters include the complete IST month across leap years and year boundaries', () => {
  assert.deepEqual(followUpMonthRange('2026-12'), { from: '2026-11-30T18:30:00.000Z', to: '2026-12-31T18:29:59.999Z' });
  assert.deepEqual(followUpMonthRange('2028-02'), { from: '2028-01-31T18:30:00.000Z', to: '2028-02-29T18:29:59.999Z' });
  assert.equal(followUpCurrentMonth(new Date('2026-12-31T19:00:00Z')), '2027-01');
  for (const value of ['2026-00', '2026-13', '2026-2', 'bad', '']) assert.equal(followUpMonthRange(value), null);
});
