import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { defaultModulePolicies, moduleAllowed, moduleForPath } from '../modules';

test('nested routes and workers resolve to the same core module', () => {
  assert.equal(moduleForPath('/broker/inventory/123'), 'inventory');
  assert.equal(moduleForPath('/inventory/123', 'api'), 'inventory');
  assert.equal(moduleForPath('import.pdf', 'job'), 'inventory');
  assert.equal(moduleForPath('/ai/scan/import', 'api'), 'inventory');
  assert.equal(moduleForPath('/ai/other', 'api'), 'assistant');
  assert.equal(moduleForPath('connector.housing.poll', 'job'), 'automation');
  assert.equal(moduleForPath('/public/config', 'api'), null);
  assert.equal(moduleForPath('/public/listings', 'api'), 'marketplace');
  assert.equal(moduleForPath('/unknown', 'api'), 'legacy');
});
test('coming soon, hidden and disallowed roles cannot enter active modules', () => {
  const policies = defaultModulePolicies();
  assert.equal(moduleAllowed(policies, 'inventory', 'BROKER_ADMIN'), true);
  assert.equal(moduleAllowed(policies, 'inventory', 'USER'), false);
  assert.equal(moduleAllowed(policies, 'billing', 'SUPER_ADMIN'), false);
  policies.inventory.state = 'HIDDEN';
  assert.equal(moduleAllowed(policies, 'inventory', 'BROKER_ADMIN'), false);
  policies.inventory.state = 'COMING_SOON';
  assert.equal(moduleAllowed(policies, 'inventory', 'BROKER_ADMIN'), false);
});

test('consumer access is explicit and does not reopen private or future modules', () => {
  const p = defaultModulePolicies();
  assert.equal(moduleForPath('/user/search'), 'consumer');
  assert.equal(moduleAllowed(p, 'consumer', 'PUBLIC'), true);
  assert.equal(moduleAllowed(p, 'consumer', 'USER'), true);
  assert.equal(moduleForPath('/user/account/flatmates'), 'flatmates');
  assert.equal(moduleAllowed(p, 'flatmates', 'USER'), false);
  assert.equal(moduleAllowed(p, 'inventory', 'USER'), false);
  assert.equal(moduleForPath('/listings/123/book-visit', 'api'), 'slot_booking');
  p.consumer.state = 'HIDDEN';
  assert.equal(moduleAllowed(p, 'consumer', 'PUBLIC'), false);
});
