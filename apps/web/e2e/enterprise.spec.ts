import { expect, test } from '@playwright/test';
import { createBrokerFixture } from './fixtures';
let brokerEmail = '';
test.beforeAll(async ({ request }) => {
  brokerEmail = (await createBrokerFixture(request)).email;
});
const API = 'http://localhost:3099/api';
const evidence = '/Users/yashjangid/Library/Caches/BrokerIQ/';
test('consumer discovery, canonical links and signup run without first-party exceptions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().startsWith(API) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A better place/ })).toBeVisible();
  await page.screenshot({ path: evidence + 'enterprise-landing-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Explore properties', exact: true }).click();
  await expect(page).toHaveURL(/\/user$/);
  await expect(page.getByRole('heading', { name: /Find a space/ })).toBeVisible();
  await page.goto('/rent?bedrooms=2');
  await expect(page).toHaveURL(/\/user\/search\?bedrooms=2/);
  await expect(page.getByRole('heading', { name: 'Homes for rent' })).toBeVisible();
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Customer UI fixture');
  await page.getByLabel('Email', { exact: true }).fill(`customer.ui.${Date.now()}@e2e.test`);
  await page.getByLabel('Password', { exact: true }).fill('FixtureCustomer123');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/user\/account$/);
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await expect(page.getByText('Saved rentals', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Reporting period' }).selectOption('7');
  for (const path of ['saved', 'searches', 'enquiries', 'visits', 'messages', 'profile', 'privacy']) {
    await page.goto('/user/account/' + path);
    await expect(page.locator('main').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('dashboards render charts and drilldowns at desktop and narrow widths', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.locator('input[type=email]').fill(brokerEmail);
  await page.locator('input[type=password]').fill('FixtureBroker123');
  await page.locator('input[type=password]').press('Enter');
  await expect(page).toHaveURL(/\/broker$/);
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inventory availability' })).toBeVisible();
  await page.screenshot({ path: evidence + 'enterprise-broker-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: evidence + 'enterprise-broker-mobile.png', fullPage: true });
  await page.goto('/broker/inventory');
  await expect(page.locator('table')).toBeVisible();
  expect(errors).toEqual([]);
});
test('consumer cannot mount private broker pages or bypass future feature guards', async ({ request }) => {
  const user = await request.post(API + '/auth/register', {
    data: { name: 'Access fixture', email: `access.ui.${Date.now()}@e2e.test`, password: 'FixtureCustomer123', accountType: 'USER' },
  });
  expect(user.status()).toBe(201);
  const token = (await user.json()).accessToken;
  expect((await request.get(API + '/inventory', { headers: { Authorization: 'Bearer ' + token } })).status()).toBe(403);
  expect((await request.get(API + '/admin/dashboard/metrics', { headers: { Authorization: 'Bearer ' + token } })).status()).toBe(403);
  expect((await request.get(API + '/me/dashboard', { headers: { Authorization: 'Bearer ' + token } })).status()).toBe(200);
});
test('landing remains usable in dark mode and with reduced motion on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A better place/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: evidence + 'enterprise-landing-mobile-dark.png', fullPage: true });
});
