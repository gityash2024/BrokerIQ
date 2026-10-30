import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { defaultModulePolicies, moduleAllowed, moduleForPath, catalogModules } from '../modules';

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

test('sub-agents have active firm workspaces without team-admin or integration privileges', () => {
  const p = defaultModulePolicies();
  assert.equal(p.team.state, 'ACTIVE');
  for (const key of ['today', 'leads', 'inbox']) assert.equal(moduleAllowed(p, key, 'BROKER_AGENT'), true);
  for (const key of ['inventory', 'automation', 'billing', 'deals']) assert.equal(moduleAllowed(p, key, 'BROKER_AGENT'), false);
  assert.equal(moduleAllowed(p, 'team', 'USER'), false);
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
  assert.equal(moduleForPath('/requirements/mine', 'api'), 'tenant_requirements');
  assert.equal(moduleForPath('/requirements', 'api'), 'tenant_requirements');
  assert.equal(moduleAllowed(p, 'tenant_requirements', 'USER'), true);
  assert.equal(moduleAllowed(p, 'marketplace', 'USER'), false);
  p.consumer.state = 'HIDDEN';
  assert.equal(moduleAllowed(p, 'consumer', 'PUBLIC'), false);
});

test('roadmap visibility never grants customer access to private modules', () => {
  const policies = defaultModulePolicies();
  const roadmap = catalogModules(policies, 'USER');
  assert.ok(roadmap.some((m) => m.key === 'deals' && m.state === 'COMING_SOON'));
  assert.ok(!roadmap.some((m) => m.key === 'inventory'));
  assert.equal(moduleAllowed(policies, 'deals', 'USER'), false);
  policies.deals.state = 'HIDDEN';
  assert.ok(!catalogModules(policies, 'USER').some((m) => m.key === 'deals'));
});
