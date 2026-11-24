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

test('inventory sections preserve separate folder and full-data entry points and remove the retired directory', () => {
  const group = brokerWorkspaceGroups(defaultModulePolicies(), 'BROKER_ADMIN').find((entry) => entry.key === 'inventory');
  assert.deepEqual(
    group?.links.map((link) => link.label),
    ['Available Inventory', 'Survey', 'All Inventory', 'PDF Inventory', 'Publication Review', 'Publish Listing', 'Scan / WhatsApp Import'],
  );
  assert.equal(group?.links.find((link) => link.label === 'All Inventory')?.nativeHref, '/inventory?view=ledger');
  assert.equal(group?.links.find((link) => link.label === 'PDF Inventory')?.nativeHref, '/pdf-inventory');
  assert.ok(
    !brokerWorkspaceGroups(defaultModulePolicies(), 'BROKER_ADMIN')
      .flatMap((entry) => entry.links)
      .some((link) => link.module === 'directory'),
  );
});

test('workspace discovery shows existing role-restricted tools while access remains explicit', async () => {
  const { workspaceLinkAccess } = await import('../workspace-navigation');
  const policies = defaultModulePolicies();
  for (const role of ['BROKER_ADMIN', 'BROKER_AGENT'] as const) {
    const links = brokerWorkspaceGroups(policies, role, true).flatMap((group) => group.links);
    for (const href of ['/broker/team', '/broker/publications', '/broker/connectors', '/broker/automations']) {
      const link = links.find((item) => item.href === href);
      assert.ok(link, href);
      if (role === 'BROKER_AGENT') assert.ok(workspaceLinkAccess({ role }, policies, link));
      else assert.equal(workspaceLinkAccess({ role }, policies, link), undefined);
    }
  }
  const links = brokerWorkspaceGroups(policies, 'BROKER_ADMIN', true).flatMap((group) => group.links);
  const delegated = { role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['leads:view', 'leads:create'] };
  assert.equal(
    workspaceLinkAccess(
      delegated,
      policies,
      links.find((link) => link.href === '/broker/leads')!,
    ),
    undefined,
  );
  assert.ok(
    workspaceLinkAccess(
      delegated,
      policies,
      links.find((link) => link.href === '/broker/team')!,
    ),
  );
  assert.equal(
    workspaceLinkAccess(
      delegated,
      policies,
      links.find((link) => link.href === '/broker/kyc')!,
    ),
    undefined,
  );
});
