import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryFactGroups, inventoryPrice } from '../inventory-presentation';
import { directoryProfile, type DirectoryRecord } from '../directory-profile';
import type { LedgerItem } from '../inventory';

test('recorded zero and false facts survive; unknown values are not invented', () => {
  const item = { purpose: 'RENT', monthlyRent: 0, floor: '0', details: { securityMonths: 0, gatedSociety: false }, contacts: [] } as unknown as LedgerItem;
  const facts = inventoryFactGroups(item).flatMap((group) => group.facts);
  assert.match(inventoryPrice(item), /₹0\/month/);
  assert.ok(facts.some((fact) => fact.value === '0'));
  assert.ok(facts.some((fact) => fact.label === 'Gated society' && fact.value === 'No'));
  assert.ok(facts.some((fact) => /ground/i.test(fact.value)));
  assert.ok(!facts.some((fact) => fact.value.includes('undefined')));
  assert.equal(inventoryPrice({ ratePerArea: 150 } as LedgerItem), '₹150 · Area unit not recorded');
  assert.equal(inventoryPrice({ purpose: 'RENT', rent: 12000 } as LedgerItem), '₹12,000/month');
});

const record: DirectoryRecord = {
  id: 'record',
  name: 'Project',
  provider: 'HARERA',
  sourceUrl: 'https://haryanarera.gov.in/view_project/searchprojectDetail/1',
  sourceFetchedAt: '2026-10-18T00:00:00Z',
};
test('directory consumes allowlisted project facts and suppresses unsafe media links', () => {
  const profile = directoryProfile({
    ...record,
    metadata: {
      enrichment: {
        version: 1,
        sourceUrl: 'https://haryanarera.gov.in/view_project/project_preview_open/1',
        fetchedAt: '2026-10-18T00:00:00Z',
        facts: { landArea: '2 acres', ownerPan: 'sensitive value' },
        tables: [{ key: 'unitMix', rows: [['Heading'], ['2 BHK', '20']] }],
        photos: [
          {
            url: 'javascript:alert(1)',
            sourceUrl: 'https://example.org',
            caption: 'Unsafe',
            author: 'Author',
            license: 'Licence',
            licenseUrl: 'https://example.org',
          },
        ],
      },
    },
  });
  assert.deepEqual(
    profile.facts.map((f) => f.key),
    ['landArea'],
  );
  assert.deepEqual(profile.tables[0].rows, [['2 BHK', '20']]);
  assert.equal(profile.photos.length, 0);
  assert.equal(directoryProfile({ ...record, sourceUrl: 'javascript:alert(1)', metadata: { enrichment: { version: 99 } } }).sourceUrl, null);
  assert.deepEqual(directoryProfile(record).photos, []);
});
