import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVisitLocalDateTime, parseVisit12HourDateTime, visitInventoryTitle, visitInputSchema, visitUpdateSchema } from '../index';
test('calendar validation rejects rollover, incomplete inputs and invalid 12-hour times', () => {
  for (const input of ['2026-02-29T11:00', '2026-04-31T11:00', '2026-11-01T24:00', '', '2026-1-1T11:00']) assert.equal(parseVisitLocalDateTime(input), null);
  assert.ok(parseVisitLocalDateTime('2028-02-29T00:00'));
  assert.equal(parseVisit12HourDateTime('2026-11-01', '13', '0', 'AM'), null);
  assert.equal(parseVisit12HourDateTime('2026-11-01', '0', '0', 'AM'), null);
  assert.equal(parseVisit12HourDateTime('2026-11-01', '12', '60', 'PM'), null);
  assert.equal(parseVisit12HourDateTime('2026-11-01', '12', '00', 'AM')?.getHours(), 0);
  assert.equal(parseVisit12HourDateTime('2026-11-01', '12', '00', 'PM')?.getHours(), 12);
});
test('visit contract requires a real timezone-aware timestamp and paired bounded coordinates', () => {
  assert.equal(visitInputSchema.safeParse({ leadId: 'lead', scheduledAt: 'yesterday' }).success, false);
  assert.equal(visitInputSchema.safeParse({ leadId: 'lead', scheduledAt: '2026-11-01T11:00:00+05:30' }).success, true);
  assert.equal(visitUpdateSchema.safeParse({ checkInLat: 91, checkInLng: 77 }).success, false);
  assert.equal(visitUpdateSchema.safeParse({ checkInLat: 28 }).success, false);
});
test('same house on separate floors has distinct selection labels', () => {
  assert.notEqual(
    visitInventoryTitle({ houseNo: '1994', sector: 'Sector 38', floor: 'Ground floor' }),
    visitInventoryTitle({ houseNo: '1994', sector: 'Sector 38', floor: '2nd floor' }),
  );
});
