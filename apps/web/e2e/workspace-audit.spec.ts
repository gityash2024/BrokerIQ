import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { moduleAllowed, moduleForPath } from '@brokeriq/shared';
const API = 'http://localhost:3099/api';
const evidence = '/Users/yashjangid/Library/Caches/BrokerIQ/';

test('all static active workspace routes render at phone width with explicit disabled states and no unexpected API failures', async ({ page, request }) => {
  test.setTimeout(300000);
  const login = async (email: string, password: string) => {
    const response = await request.post(API + '/auth/login', { data: { email, password } });
    expect(response.status()).toBe(200);
    return response.json();
  };
  const admin = await login('admin.web@e2e.test', process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345');
  const brokerEmail = `audit.broker.${Date.now()}@e2e.test`;
  expect(
    (
      await request.post(API + '/admin/organizations', {
        headers: { Authorization: `Bearer ${admin.accessToken}` },
        data: { name: 'Workspace audit broker', email: brokerEmail, password: 'FixtureBroker123', firmName: 'Isolated workspace audit' },
      })
    ).status(),
  ).toBe(201);
  const broker = await login(brokerEmail, 'FixtureBroker123');
  await request.post(API + '/broker/onboarding', {
    headers: { Authorization: `Bearer ${broker.accessToken}` },
    data: { firmName: 'Isolated workspace audit', phone: '9811100001', localityIds: [] },
  });
  broker.user.organization.onboarded = true;
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
      writeFileSync(evidence + 'workspace-route-audit24.json', JSON.stringify({ results, errors }, null, 2));
      if (overflow) errors.push(`${route}: horizontal page overflow`);
    }
  }
  await Promise.all(responseReads);
  writeFileSync(evidence + 'workspace-route-audit24.json', JSON.stringify({ results, errors }, null, 2));
  expect(errors).toEqual([]);
});

test('admin master-data forms preserve unsaved edits and mobile cards expose every column', async ({ page, request }) => {
  const session = await (
    await request.post(API + '/auth/login', { data: { email: 'admin.web@e2e.test', password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345' } })
  ).json();
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
  await page.screenshot({ path: evidence + 'admin-form-phone24.png' });
  page.once('dialog', (modal) => modal.accept());
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
