import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { messageLinks } from '../message-links';
import { leadEnquiryOverview } from '../lead-presentation';
import { clientPropertyShare, inventoryAvailabilityDate } from '../inventory-presentation';
import { propertyGalleryDraft } from '../inventory';

test('lead list shows sector and furnishing for older explicit portal messages and keeps reviewed values', () => {
  const old = { notes: 'Interested in 3 BHK fully furnished in Sector 43', sourceDetail: 'Housing listing #19392637' };
  assert.deepEqual(leadEnquiryOverview(old), { location: 'Sector 43', summary: '3 BHK · Fully Furnished' });
  assert.deepEqual(leadEnquiryOverview({ ...old, requirement: { bedrooms: [2], furnishing: 'SEMI_FURNISHED', localityNames: ['Sector 54'] } }), {
    location: 'Sector 54',
    summary: '2 BHK · Semi Furnished',
  });
  assert.equal(leadEnquiryOverview({ notes: 'Please call me on 9876543210' }).summary, '');
});

test('Housing and BrokerIQ gallery links remain clickable without turning other schemes into actions', () => {
  const message = 'View (https://hsng.co/HOUSNG/6h5rAJV). Or https://brokeriq.example/photos/' + 'a'.repeat(48);
  const parts = messageLinks(message);
  assert.equal(parts.map((part) => part.text).join(''), message);
  assert.equal(parts.filter((part) => part.url).length, 2);
  assert.equal(parts.find((part) => part.url)?.url, 'https://hsng.co/HOUSNG/6h5rAJV');
  assert.equal(messageLinks('javascript:alert(1) https://user:password@example.test').filter((part) => part.url).length, 0);
});

test('one gallery link keeps the new broker message order with no operational metadata', () => {
  const text = clientPropertyShare({
    sector: 'Sector 43',
    bhk: 2,
    roomKind: 'BHK',
    propertyType: 'BUILDER_FLOOR',
    floor: 'FF',
    purpose: 'RENT',
    monthlyRent: 40000,
  });
  assert.match(text, /^📍 Location: Sector 43\n/);
  assert.match(text, /1st floor/);
  assert.doesNotMatch(text, /Managed by|Transaction|reconfirm/);
  const url = 'https://brokeriq.example/photos/' + 'a'.repeat(48);
  const message = propertyGalleryDraft(text, url);
  assert.equal(message.match(/https?:\/\//g)?.length, 1);
  assert.match(message, /View all property photos · Ref AAAAAAAA/);
  assert.match(propertyGalleryDraft(text, url.replace(/a{8}$/, 'b'.repeat(8))), /Ref BBBBBBBB/);
  assert.throws(() => propertyGalleryDraft(text, 'https://res.cloudinary.com/photo.jpg'));
  assert.equal(inventoryAvailabilityDate({ availableSince: '2026-11-18', details: { availableFrom: '2027-01-01' } }), '2027-01-01');
});
