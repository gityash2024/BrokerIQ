import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { inventoryEditorPatch, inventoryInputSchema, prepareInventoryEditorInput } from '../inventory';

const imported = {
  id: 'private-record', organizationId: 'firm', revision: 4, clientMutationId: null,
  sourceType: 'PDF_REGISTER', deletedAt: null, publishedListingId: null,
  sector: 'Sector 38', houseNo: '1994', purpose: 'RENT', monthlyRent: 13000, rent: 13000,
  area: 900, areaUnit: 'SQ_FT', notes: 'Original source note',
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
    details: { securityMonths: 2 }, expectedRevision: 4,
  });
  assert.equal(inventoryInputSchema.safeParse(inventoryEditorPatch({ ...imported, area: '950' }, imported)).success, true);
});

test('explicit clearing sends null or an empty collection and keeps meaningful zero/false', () => {
  const patch = inventoryEditorPatch({ ...imported, monthlyRent: '', contacts: [], details: { ...imported.details, projectName: '', securityMonths: 0, petFriendly: false } }, imported);
  assert.deepEqual(patch, { monthlyRent: null, contacts: [], details: { projectName: null, securityMonths: 0, petFriendly: false }, expectedRevision: 4 });
  assert.equal(inventoryInputSchema.safeParse(patch).success, true);
});

test('unchanged imported records and absent numeric fields never acquire destructive nulls', () => {
  assert.deepEqual(inventoryEditorPatch(imported, imported), { expectedRevision: 4 });
  assert.deepEqual(prepareInventoryEditorInput({ notes: 'Only this field' }), { notes: 'Only this field' });
});
