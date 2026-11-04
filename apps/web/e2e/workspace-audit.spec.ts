import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { moduleAllowed, moduleForPath } from '@brokeriq/shared';
import { API, browserAdminSession, createBrokerFixture } from './fixtures';

test('all static active workspace routes render at phone width with explicit disabled states and no unexpected API failures', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(300000);
  const admin = browserAdminSession();
  const { session: broker } = await createBrokerFixture(request);
  const userResponse = await request.post(API + '/auth/register', {
    data: { name: 'Workspace audit fixture', email: `audit.${Date.now()}@e2e.test`, password: 'FixtureCustomer123', accountType: 'USER' },
  });
  const customer = await userResponse.json();
  const config = await (await request.get(API + '/public/config')).json();
  const routes: { surface: string; route: string }[] = JSON.parse(readFileSync(resolve('../../docs/evidence/product-route-inventory.json'), 'utf8'));
  const results: any[] = [],
    errors: string[] = [],
    responseReads: Promise<void>[] = [];
  let current = '';
  page.on('pageerror', (error) => errors.push(`${current}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|cannot be a descendant|cannot contain/i.test(message.text())) errors.push(`${current}: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (!response.url().startsWith(API) || response.status() < 400) return;
    const route = current;
    responseReads.push(
      response
        .json()
        .then((body) => {
          if (body?.error?.code === 'INTEGRATION_NOT_CONFIGURED' || body?.code === 'INTEGRATION_NOT_CONFIGURED') return;
          errors.push(`${route}: ${response.status()} ${response.url()} ${body?.code || body?.error?.code || ''}`);
        })
        .catch(() => {
          errors.push(`${route}: ${response.status()} ${response.url()}`);
        }),
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const [prefix, session] of [
    ['/admin', admin],
    ['/broker', broker],
    ['/user/account', customer],
  ] as const) {
    await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
    const selected = routes.filter(
      (item) => item.surface === 'web' && !item.route.includes('[') && (item.route === prefix || item.route.startsWith(prefix + '/')),
    );
    for (const { route } of selected) {
      // Legacy aliases are checked through their canonical destinations separately.
      current = route;
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      const module = moduleForPath(route);
      const expectedDisabled = !!module && !moduleAllowed(config.modules, module, session.user.role);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      const headings = await page.locator('h1').allTextContents();
      results.push({ route, finalUrl: page.url(), role: session.user.role, headings, expectedDisabled, overflow });
      writeFileSync(testInfo.outputPath('workspace-route-audit24.json'), JSON.stringify({ results, errors }, null, 2));
      if (overflow) errors.push(`${route}: horizontal page overflow`);
    }
  }
  await Promise.all(responseReads);
  writeFileSync(testInfo.outputPath('workspace-route-audit24.json'), JSON.stringify({ results, errors }, null, 2));
  expect(errors).toEqual([]);
});

test('admin master-data forms preserve unsaved edits and mobile cards expose every column', async ({ page }, testInfo) => {
  const session = browserAdminSession();
  await page.goto('/');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/system');
  await page.getByLabel('Search administrative tools').fill('scanner');
  await page.getByLabel('Search administrative tools').fill('source review');
  await expect(page.getByRole('link', { name: /Private inventory & source review/ })).toBeVisible();
  await page.goto('/admin/modules');
  await page.getByLabel('Search modules').fill('User marketplace');
  await expect(page.getByLabel('Customer', { exact: true })).toBeVisible();
  await page.goto('/admin/amenities');
  await page.getByRole('button', { name: 'नया जोड़ें', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('Unsaved isolated check');
  await expect(dialog.getByText('Unsaved changes', { exact: true })).toBeVisible();
  page.once('dialog', (modal) => modal.dismiss());
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('Unsaved isolated check');
  await page.screenshot({ path: testInfo.outputPath('admin-form-phone24.png') });
  page.once('dialog', (modal) => modal.accept());
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('Super Admin sidebar opens the selected record and keeps upcoming tools disabled', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), browserAdminSession());
  await page.goto('/admin/business?resource=leads');
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  await expect(nav.getByRole('link', { name: 'Leads', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Product features & upcoming' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Requirements', exact: true }).click();
  await expect(page).toHaveURL(/resource=requirements$/);
  await expect(nav.getByRole('link', { name: 'Requirements', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Leads', exact: true })).not.toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /^Requirements/ })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await nav.getByRole('textbox', { name: 'Find a module or tool' }).fill('campaign');
  await expect(nav.getByText('Campaigns', { exact: true }).locator('..')).toHaveAttribute('aria-disabled', 'true');
  await expect(nav.getByRole('link', { name: 'Campaigns', exact: true })).toHaveCount(0);
});

test('Broker Agent sees assigned leads and personal settings, with admin routes protected', async ({ page, request }) => {
  const { session: owner } = await createBrokerFixture(request);
  const ownerHeaders = { Authorization: 'Bearer ' + owner.accessToken };
  const email = `agent.workspace.${Date.now()}@e2e.test`;
  const identity = { name: 'Workspace test agent', email };
  const inviteResponse = await request.post(API + '/broker/team/invite', {
    headers: ownerHeaders,
    data: { ...identity, role: 'BROKER_AGENT' },
  });
  expect(inviteResponse.status()).toBe(201);
  const invite = (await inviteResponse.json()).link.split('/').pop();
  const accountResponse = await request.post(API + '/auth/register', {
    data: { ...identity, password: 'FixtureAgent123', accountType: 'USER' },
  });
  expect(accountResponse.status()).toBe(201);
  const account = await accountResponse.json();
  const acceptResponse = await request.post(API + '/invites/' + invite + '/accept', {
    headers: { Authorization: 'Bearer ' + account.accessToken },
    data: {},
  });
  expect(acceptResponse.status()).toBe(201);
  const agent = await acceptResponse.json();
  expect(agent.user.role).toBe('BROKER_AGENT');

  async function lead(name: string, phone: string) {
    const response = await request.post(API + '/leads', { headers: ownerHeaders, data: { name, phone } });
    expect(response.status()).toBe(201);
    return response.json();
  }
  const visible = await lead('Assigned workspace lead', '9811100011');
  const hidden = await lead('Private workspace lead', '9811100012');
  expect(
    (
      await request.patch(API + '/leads/' + visible.id + '/assign', {
        headers: ownerHeaders,
        data: { assignedToId: agent.user.id },
      })
    ).status(),
  ).toBe(200);

  const headers = { Authorization: 'Bearer ' + agent.accessToken };
  const exported = await request.get(API + '/leads/export', { headers });
  expect(exported.status()).toBe(200);
  const csv = await exported.text();
  expect(csv).toContain(visible.name);
  expect(csv).not.toContain(hidden.name);

  await page.goto('/');
  await page.evaluate((session) => localStorage.setItem('biq.auth', JSON.stringify(session)), agent);
  await page.goto('/broker/leads');
  await expect(page.getByText(visible.name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(hidden.name, { exact: true })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  await expect(nav.getByRole('button', { name: 'Team & Agents' })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Automation' })).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/broker/settings');
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Firm profile', exact: true })).toHaveCount(0);
  for (const route of ['/broker/team', '/broker/connectors', '/broker/automations']) {
    await page.goto(route);
    await expect(page.getByText('Access restricted', { exact: true })).toBeVisible();
  }
  await page.goto('/admin/business');
  await expect(page).toHaveURL(/\/broker$/);
  await expect(page.getByRole('heading', { name: 'Business records' })).toHaveCount(0);
});
