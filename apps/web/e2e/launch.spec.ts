import { expect, test } from '@playwright/test';
const API = 'http://localhost:3099/api';
async function login(page: any, email = 'broker.web@e2e.test', password = 'FixtureBroker123') {
  await page.goto('/login');
  const tab = page.getByRole('button', { name: /Password/ }).first();
  if (await tab.isVisible()) await tab.click();
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('input[type=password]').press('Enter');
  await expect(page).toHaveURL(email.startsWith('admin') ? /\/admin/ : /\/broker/);
}
test('focused landing and consumer redirects', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Less chasing/ })).toBeVisible();
  await page.getByRole('link', { name: 'Open BrokerIQ ↗' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/buy');
  await expect(page).toHaveURL(/\/login/);
});
test('broker imports a requirement, reviews it and uses ledger filters', async ({ page, request }) => {
  await login(page);
  await page.goto('/broker/imports');
  await expect(page.getByRole('heading', { name: /Capture|Inbox|Import/ }).first()).toBeVisible();
  const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('biq.auth')!));
  const response = await request.post(`${API}/imports`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    data: { sourceType: 'TEXT', rawText: `Requirement 2 BHK, rent, Sector 45, budget 45k to 55k. Isolated UI validation ${Date.now()}.` },
  });
  expect(response.status()).toBe(201);
  const captured = await response.json();
  await page.goto(`/broker/imports/${captured.id}`);
  await page.getByRole('button', { name: 'Review source & fields' }).first().click({ timeout: 20000 });
  await page.getByRole('button', { name: 'Save reviewed fields' }).click();
  await page.getByRole('button', { name: 'Approve saved records' }).click();
  await expect(page.getByText('APPROVED', { exact: true })).toBeVisible();
  await page.goto('/broker/inventory');
  await page
    .getByRole('button', { name: /Filters/ })
    .first()
    .click();
  await expect(page.getByRole('combobox').filter({ has: page.locator('option[value=UNKNOWN]') })).toBeVisible();
  await page.getByRole('button', { name: /Show results/ }).click();
  await expect(page.locator('table')).toBeVisible();
  await page.goto('/broker/deals');
  await expect(page.getByRole('heading', { name: 'यह सुविधा अभी उपलब्ध नहीं है' })).toBeVisible();
});
test('admin module toggle blocks direct route and restores navigation', async ({ page, request }) => {
  await login(page, 'admin.web@e2e.test', 'FixtureAdmin123');
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('biq.auth')!));
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  try {
    expect(
      (await request.patch(`${API}/admin/modules/inventory`, { headers, data: { state: 'COMING_SOON', roles: ['BROKER_ADMIN', 'SUPER_ADMIN'] } })).ok(),
    ).toBeTruthy();
    const broker = await request.post(`${API}/auth/login`, { data: { email: 'broker.web@e2e.test', password: 'FixtureBroker123' } });
    expect((await request.get(`${API}/inventory`, { headers: { Authorization: `Bearer ${(await broker.json()).accessToken}` } })).status()).toBe(403);
  } finally {
    await request.patch(`${API}/admin/modules/inventory`, { headers, data: { state: 'ACTIVE', roles: ['BROKER_ADMIN', 'SUPER_ADMIN'] } });
  }
  await page.goto('/admin/modules');
  await expect(page.getByRole('heading', { name: 'Modules & permissions', exact: true })).toBeVisible();
});

test('Area Directory lists source-backed projects and opens the map without inventing coordinates', async ({ page }) => {
  await login(page);
  await page.goto('/broker/inventory/directory');
  await expect(page.getByRole('heading', { name: 'Area Directory', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search directory' }).fill('EDEN');
  await expect(page.getByRole('button', { name: /102 EDEN ESTATE/ }).first()).toBeVisible();
  await page
    .getByRole('button', { name: /102 EDEN ESTATE/ })
    .first()
    .click();
  await expect(page.getByRole('link', { name: 'Open official source ↗' })).toHaveAttribute('href', /haryanarera.gov.in/);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search directory' }).fill('');
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.getByRole('button', { name: 'Show map' }).click();
  await expect(page.getByTitle('Gurugram project map')).toBeVisible();
  await expect(page.frameLocator('iframe[title="Gurugram project map"]').locator('.leaflet-container')).toBeVisible();
});
