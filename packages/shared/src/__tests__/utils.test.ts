import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatINR, formatPriceShort, normalizeIndianPhone, slugify, renderTemplate, calculateEmi } from '../utils';
import { INTEGRATIONS } from '../integrations/registry';
import { DEFAULT_APP_CONFIG } from '../app-config';

test('formatINR uses Indian grouping', () => {
  assert.equal(formatINR(1234567), '₹12,34,567');
  assert.equal(formatINR(999), '₹999');
});
test('formatPriceShort', () => {
  assert.equal(formatPriceShort(12500000), '₹1.25 Cr');
  assert.equal(formatPriceShort(4500000), '₹45 L');
  assert.equal(formatPriceShort(35000), '₹35,000');
});
test('normalizeIndianPhone', () => {
  assert.equal(normalizeIndianPhone('98765 43210'), '+919876543210');
  assert.equal(normalizeIndianPhone('+91-98765-43210'), '+919876543210');
  assert.equal(normalizeIndianPhone('09876543210'), '+919876543210');
  assert.equal(normalizeIndianPhone('919876543210'), '+919876543210');
  assert.equal(normalizeIndianPhone('12345'), null);
});
test('slugify', () => assert.equal(slugify('Sector 65, Golf Course Ext. Road'), 'sector-65-golf-course-ext-road'));
test('renderTemplate', () => assert.equal(renderTemplate('Hi {{name}}, {{org.name}}!', { name: 'Ravi', org: { name: 'ABC' } }), 'Hi Ravi, ABC!'));
test('emi', () => assert.equal(Math.round(calculateEmi(5000000, 8.5, 20)), 43391));
test('registry keys are unique and have steps', () => {
  const keys = new Set(INTEGRATIONS.map((i) => i.key));
  assert.equal(keys.size, INTEGRATIONS.length);
  for (const i of INTEGRATIONS) assert.ok(i.steps.length >= 2, i.key);
});
test('default app config parses', () => assert.equal(DEFAULT_APP_CONFIG.city, 'Gurgaon'));
