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
  await expect(page).toHaveURL(/\/user\/search$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/BHK/).first()).toBeVisible();
});

test('the old for-brokers route opens workspace sign-in', async ({ page }) => {
  await page.goto('/for-brokers');
  await expect(page).toHaveURL(/\/login/);
});

test('ordinary Sale is discoverable while New Projects stays parked', async ({ page }) => {
  await page.goto('/buy');
  await expect(page).toHaveURL(/\/buy$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login$/);
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

test('landing shows all product surfaces, four guides and legal navigation at phone width', async ({ page, request }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const title of ['Customer portal', 'Broker workspace', 'Android app', 'Super Admin']) {
    const gallery = page.getByRole('region', { name: title, exact: true });
    await expect(gallery.getByRole('img').first()).toBeVisible();
    for (const image of await gallery.getByRole('img').all()) {
      const source = await image.getAttribute('src');
      expect(source).toMatch(/^\/product\//);
      expect((await request.get(source!)).ok()).toBe(true);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole('link', { name: 'Open user guides →' }).click();
  await expect(page.getByRole('heading', { name: 'BrokerIQ user guides' })).toBeVisible();
  const downloads = await page.locator('a[download][href$=".pdf"]').all();
  expect(downloads).toHaveLength(4);
  for (const link of downloads) {
    const response = await request.get((await link.getAttribute('href'))!);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }
  for (const [path, canonical] of [
    ['/privacy', '/p/privacy'],
    ['/terms', '/p/terms'],
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(canonical);
  }
});
