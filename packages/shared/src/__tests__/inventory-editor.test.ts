import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { clientPropertyShare } from '../inventory-presentation';
import { inventoryDate, inventoryMonth } from '../inventory-folders';
import { inventoryEditorPatch, inventoryInputSchema, prepareInventoryEditorInput, propertyPhotoDraft, shareablePropertyPhotoUrls } from '../inventory';

const imported = {
  id: 'private-record',
  organizationId: 'firm',
  revision: 4,
  clientMutationId: null,
  sourceType: 'PDF_REGISTER',
  deletedAt: null,
  publishedListingId: null,
  sector: 'Sector 38',
  houseNo: '1994',
  purpose: 'RENT',
  monthlyRent: 13000,
  rent: 13000,
  area: 900,
  areaUnit: 'SQ_FT',
  notes: 'Original source note',
  details: { securityMonths: 1, advanceMonths: 1, projectName: 'Recorded project' },
  contacts: [{ id: 'private-contact', inventoryId: 'private-record', name: null, phone: '+919999999999', role: 'UNKNOWN', note: 'Original contact note' }],
};

test('real imported-record shape omits null mutation metadata and read-only fields', () => {
  const input = prepareInventoryEditorInput(imported);
  assert.equal(inventoryInputSchema.safeParse(input).success, true);
  for (const field of ['id', 'revision', 'sourceType', 'deletedAt', 'publishedListingId', 'clientMutationId', 'rent']) assert.equal(field in input, false);
});

test('single-field edits leave contacts, source, pricing, arrays and detail siblings out of PATCH', () => {
  assert.deepEqual(inventoryEditorPatch({ ...imported, houseNo: '1994 A' }, imported), { houseNo: '1994 A', expectedRevision: 4 });
  assert.deepEqual(inventoryEditorPatch({ ...imported, monthlyRent: '14000' }, imported), { monthlyRent: 14000, expectedRevision: 4 });
  assert.deepEqual(inventoryEditorPatch({ ...imported, details: { ...imported.details, securityMonths: '2' } }, imported), {
    details: { securityMonths: 2 },
    expectedRevision: 4,
  });
  assert.equal(inventoryInputSchema.safeParse(inventoryEditorPatch({ ...imported, area: '950' }, imported)).success, true);
});

test('explicit clearing sends null or an empty collection and keeps meaningful zero/false', () => {
  const patch = inventoryEditorPatch(
    { ...imported, monthlyRent: '', contacts: [], details: { ...imported.details, projectName: '', securityMonths: 0, petFriendly: false } },
    imported,
  );
  assert.deepEqual(patch, { monthlyRent: null, contacts: [], details: { projectName: null, securityMonths: 0, petFriendly: false }, expectedRevision: 4 });
  assert.equal(inventoryInputSchema.safeParse(patch).success, true);
});

test('unchanged imported records and absent numeric fields never acquire destructive nulls', () => {
  assert.deepEqual(inventoryEditorPatch(imported, imported), { expectedRevision: 4 });
  assert.deepEqual(prepareInventoryEditorInput({ notes: 'Only this field' }), { notes: 'Only this field' });
});

test('inventory advances to the next month at midnight in India without rewriting availability dates', () => {
  assert.equal(inventoryMonth(new Date('2026-11-30T18:29:59Z')), '2026-11');
  assert.equal(inventoryMonth(new Date('2026-11-30T18:30:00Z')), '2026-12');
  assert.equal(inventoryDate(new Date('2026-12-31T18:30:00Z')), '2027-01-01');
  const existing = { ...imported, directoryMonth: '2026-11', availableSince: '2026-10-01' };
  assert.deepEqual(inventoryEditorPatch({ ...existing, directoryMonth: '2026-12' }, existing), { directoryMonth: '2026-12', expectedRevision: 4 });
  assert.equal(inventoryInputSchema.safeParse({ availableSince: '2026-11-31' }).success, false);
});

test('property photo drafts exclude private source links and keep whole public links within the message limit', () => {
  const publicPhoto = 'https://brokeriq.example/api/media/f/listing/org/photo.jpg';
  const privatePhoto = 'https://brokeriq.example/api/media/f/scan/org/private.jpg';
  const alternate = 'https://brokeriq.example/api/media/f/listing/org/second.jpg';
  const message = 'Property for rent';
  const expected = `${message}\n\nProperty photos:\n${publicPhoto}`;
  assert.equal(propertyPhotoDraft(message, [privatePhoto, publicPhoto, publicPhoto, alternate], expected.length), expected);
  assert.equal(propertyPhotoDraft(message, [privatePhoto, publicPhoto], expected.length - 1), message);
});

test('photo attachments keep the full ordered set of public images and exclude private media', () => {
  const photos = Array.from({ length: 50 }, (_, index) => `https://brokeriq.example/api/media/f/listing/org/${index}.jpg`);
  const unrelated = [
    'http://brokeriq.example/photo.jpg',
    'https://brokeriq.example/api/media/f/%73can/org/id.jpg',
    'https://brokeriq.example/api/media/f/chat/org/message.jpg',
    'https://brokeriq.example/api/media/download/private.jpg',
    'https://res.cloudinary.com/org/image/authenticated/v1/id.jpg',
  ];
  assert.deepEqual(shareablePropertyPhotoUrls([photos[0] + '#preview', ...photos, ...unrelated]), photos);
  assert.ok(propertyPhotoDraft('', photos).length <= 2000);
});

test('client-facing property messages leave private identifiers and floor area in the inventory record', () => {
  const item = {
    ...imported,
    purpose: 'RENT' as const,
    propertyType: 'BUILDER_FLOOR',
    houseNo: '340',
    sector: 'Sector 43, House 340',
    unitLabel: 'Unit 340 · 2.5BHK',
    address: 'House 340, Sector 43',
    notes: 'Show 1000 SQ_FT only on request',
    area: 1000,
    bhk: 2,
    roomKind: 'BHK',
    floor: '1',
    furnishing: 'FULLY_FURNISHED',
    monthlyRent: 40000,
  } as const;
  const message = clientPropertyShare(item, 'Broker Agent');
  assert.match(message, /Builder Floor\n📍 Location: Sector 43/);
  assert.match(message, /Config: 2 BHK/);
  assert.match(message, /Floor: 1st floor/);
  assert.match(message, /₹40,000\/month/);
  assert.doesNotMatch(message, /340|2\.5BHK|SQ_FT|1000|Property photos:/);
  assert.doesNotMatch(clientPropertyShare({ ...item, sector: 'Plot 340', floor: 'Floor 1 at House 340' }), /340|Location:|Floor:/);
});

test('client-facing messages omit per-area price and keep valid locality and configuration', () => {
  const item = { propertyType: 'APARTMENT', houseNo: '37', sector: 'Sushant Lok Phase 1', roomKind: 'STUDIO', purpose: 'SALE', ratePerArea: 4500 } as const;
  const message = clientPropertyShare(item);
  assert.match(message, /Location: Sushant Lok Phase 1/);
  assert.match(message, /Config: Studio/);
  assert.match(message, /Price not recorded/);
  assert.doesNotMatch(message, /4,500|37/);
});
