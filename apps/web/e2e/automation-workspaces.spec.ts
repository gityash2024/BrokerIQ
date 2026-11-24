import { expect, test } from '@playwright/test';
import { browserAdminSession, createBrokerFixture } from './fixtures';

test('the four organic workspaces open in Super Admin', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate((session) => localStorage.setItem('biq.auth', JSON.stringify(session)), browserAdminSession());
  for (const [path, title] of [
    ['supply', 'Organic Property Supply'],
    ['demand', 'Organic Buyer & Tenant Leads'],
    ['sources', 'Discovery sources'],
    ['delivery', 'Daily Lead Delivery'],
  ]) {
    await page.goto('/admin/organic/' + path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByText('All new eligible leads', { exact: true })).toBeAttached();
});

test('PDF Inventory has its own upload and filters on desktop and narrow screens', async ({ page, request }) => {
  const { session } = await createBrokerFixture(request);
  await page.goto('/login');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker/inventory/pdf');
  await expect(page.getByRole('heading', { name: 'PDF Inventory', exact: true })).toBeVisible();
  await expect(page.getByLabel('Property PDF')).toHaveAttribute('accept', 'application/pdf,.pdf');
  await expect(page.getByLabel('PDF batch')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByRole('button', { name: 'Import property from PDF' })).toBeVisible();
  await expect(page.getByLabel('PDF batch')).toBeVisible();
});
