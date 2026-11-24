import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVisitLocalDateTime,
  parseVisit12HourDateTime,
  visitInventoryDetails,
  visitInventoryTitle,
  visitInputSchema,
  visitUpdateSchema,
  visitShortlistStops,
  inventoryInputSchema,
  inventoryNavigation,
  surveyLocationLink,
  type LedgerItem,
} from '../index';
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
test('only the sharing picker labels accessible gallery photos', () => {
  const record: LedgerItem = {
    id: 'property', organizationId: 'firm', revision: 1, sourceType: 'MANUAL', contacts: [],
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', purpose: 'RENT',
    photoUrls: ['https://example.test/media/property-photo/property/image.jpg'],
  };
  const visit = visitInventoryDetails(record);
  assert.equal(visitInventoryDetails(record, 'photos'), visit + ' · Photos');
  assert.equal(visitInventoryDetails({ ...record, detailAccess: 'APPROVED' }, 'photos'), visit + ' · Photos');
  assert.equal(visitInventoryDetails({ ...record, detailAccess: 'LOCKED' }, 'photos'), visit);
  assert.equal(visitInventoryDetails({ ...record, detailAccess: 'EXPIRED' }, 'photos'), visit);
  assert.equal(visitInventoryDetails({ ...record, photoUrls: [] }, 'photos'), visit);
  assert.equal(visitInventoryDetails({ ...record, photoUrls: ['https://example.test/media/private/scan.jpg'] }, 'photos'), visit);
  assert.equal(visitInventoryDetails({ ...record, agentCoverPhotoUrl: record.photoUrls?.[0], photoUrls: [] }, 'photos'), visit);
});

test('directions links are private inventory fields preserved on single-stop and multiple-stop visits', () => {
  const directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=28.45%2C77.07';
  assert.equal(inventoryInputSchema.parse({ directionsUrl }).directionsUrl, directionsUrl);
  for (const url of ['javascript:alert(1)', 'https://www.google.com/redirect', 'https://maps.app.goo.gl.example.org/code']) {
    assert.equal(inventoryInputSchema.safeParse({ directionsUrl: url }).success, false);
  }
  const first = { id: 'first', title: 'First stop', directionsUrl };
  const second = { id: 'second', title: 'Second stop', directionsUrl: 'https://maps.apple.com/place?coordinate=28.46,77.08' };
  assert.equal(visitShortlistStops(first)[0].directionsUrl, directionsUrl);
  assert.deepEqual(visitShortlistStops({ ...first, stops: [first, second] }), [first, second]);
});

test('property navigation uses the saved entrance link and keeps sector-only records on the sector map', () => {
  const exact = 'https://maps.app.goo.gl/EntranceLink';
  const property = { sector: 'Sector 45', houseNo: '384', directionsUrl: exact };
  assert.equal(inventoryNavigation(property).route, exact);
  assert.equal(inventoryNavigation(property).exact, true);
  const fallback = inventoryNavigation({ sector: 'Sector 45', houseNo: '384' });
  assert.equal(fallback.exact, false);
  assert.equal(new URL(fallback.route!).searchParams.get('destination'), '384, Sector 45, Gurugram');
  assert.equal(fallback.sectorMap, 'https://www.abcbuildcon.in/maps/sector-45');
  assert.equal(inventoryNavigation({ sector: 'Sector 45' }).route, null);
  assert.equal(inventoryNavigation({ directionsUrl: 'javascript:alert(1)' }).route, null);
});

test('survey device fixes become directions links only with valid coordinates and usable accuracy', () => {
  const location = { latitude: 28.45012347, longitude: 77.0704512, accuracy: 12 };
  const link = surveyLocationLink(location);
  assert.equal(new URL(link).searchParams.get('destination'), '28.450123,77.070451');
  assert.equal(inventoryNavigation({ directionsUrl: link }).route, link);
  for (const accuracy of [null, -1, 55, Infinity]) assert.throws(() => surveyLocationLink({ ...location, accuracy }), /approximate/);
  assert.throws(() => surveyLocationLink({ ...location, latitude: 91 }), /valid location/);
  assert.throws(() => surveyLocationLink({ ...location, longitude: NaN }), /valid location/);
});
