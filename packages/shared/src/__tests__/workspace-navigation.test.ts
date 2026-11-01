import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { brokerWorkspaceGroups, brokerUpcomingModules, workspaceHrefAllowed, nativeDashboardPath } from '../workspace-navigation';
import { defaultModulePolicies } from '../modules';

test('Agent discovery excludes firm administration and includes own active workflows', () => {
  const p = defaultModulePolicies();
  const links = brokerWorkspaceGroups(p, 'BROKER_AGENT').flatMap((g) => g.links);
  for (const path of ['/broker/inventory', '/broker/leads/requirements', '/broker/imports', '/broker/team/time-logging', '/broker/kyc'])
    assert.ok(links.some((l) => l.href === path));
  for (const path of ['/broker/team', '/broker/publications', '/broker/connectors', '/broker/team/leaderboard']) assert.ok(!links.some((l) => l.href === path));
  assert.ok(!brokerUpcomingModules(p, 'BROKER_AGENT').some((m) => m.key === 'billing'));
});
test('Hidden and disabled modules disappear from active navigation without changing policies', () => {
  const p = defaultModulePolicies();
  p.inventory.state = 'HIDDEN';
  p.inbox.state = 'COMING_SOON';
  const before = JSON.stringify(p);
  const links = brokerWorkspaceGroups(p, 'BROKER_ADMIN').flatMap((g) => g.links);
  assert.ok(!links.some((l) => ['inventory', 'inbox'].includes(l.module)));
  assert.ok(brokerUpcomingModules(p, 'BROKER_ADMIN').some((m) => m.key === 'inbox'));
  assert.equal(JSON.stringify(p), before);
});
test('Enabled invoice module remains discoverable while future modules stay disabled', () => {
  const p = defaultModulePolicies();
  p.deals.state = 'ACTIVE';
  assert.ok(
    brokerWorkspaceGroups(p, 'BROKER_ADMIN')
      .flatMap((g) => g.links)
      .some((l) => l.href === '/broker/invoices'),
  );
  assert.ok(
    !brokerWorkspaceGroups(p, 'BROKER_AGENT')
      .flatMap((g) => g.links)
      .some((l) => l.href === '/broker/invoices'),
  );
  assert.deepEqual(brokerWorkspaceGroups(p, 'USER'), []);
});
test('Dashboard drill-downs deny Admin routes and disabled modules; unknown native routes never redirect elsewhere', () => {
  const p = defaultModulePolicies();
  assert.equal(workspaceHrefAllowed(p, 'BROKER_AGENT', '/admin/users'), false);
  assert.equal(workspaceHrefAllowed(p, 'BROKER_AGENT', '/broker/publications'), false);
  assert.equal(workspaceHrefAllowed(p, 'BROKER_AGENT', '/broker/team/time-logging'), true);
  assert.equal(workspaceHrefAllowed(p, 'BROKER_AGENT', '/broker/deals'), false);
  assert.equal(workspaceHrefAllowed(p, 'USER', '/broker/leads'), false);
  assert.equal(nativeDashboardPath('/unexpected/report'), null);
  assert.equal(nativeDashboardPath('/broker/inventory?availability=AVAILABLE'), '/(broker)/inventory?availability=AVAILABLE');
});
