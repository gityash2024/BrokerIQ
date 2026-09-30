import { expect, test, type Page } from '@playwright/test';

/** Errors in the browser console (ignoring noisy third-party/network ones). */
function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR|ResizeObserver/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test('home page renders without errors', async ({ page }) => {
  const errors = watchConsole(page);
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.getByText('कुछ गड़बड़ हो गई')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('rent search page shows filters', async ({ page }) => {
  await page.goto('/rent');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/BHK/).first()).toBeVisible();
});

test('for-brokers shows the free launch offer, not prices', async ({ page }) => {
  await page.goto('/for-brokers');
  await expect(page.getByText('अभी सब कुछ free है')).toBeVisible();
  await expect(page.getByText('Simple pricing')).toHaveCount(0);
});

test('sale pages redirect to rent while sale listings are off', async ({ page }) => {
  await page.goto('/buy');
  await expect(page).toHaveURL(/\/rent/);
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/rent/);
});

test('account deletion page is public', async ({ page }) => {
  await page.goto('/account-deletion');
  await expect(page.getByRole('heading', { name: 'Account delete करें' })).toBeVisible();
});

test('login page has email sign-in', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
});

test('unknown page shows the not-found screen', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist');
  expect(res?.status()).toBe(404);
});
