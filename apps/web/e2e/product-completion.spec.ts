import { expect, test } from '@playwright/test';
const API = 'http://localhost:3099/api';
test('scanner and chat exports are discoverable, private drafts survive reload and imports stay in review', async ({ page, request }) => {
  const admin = await request.post(API + '/auth/login', { data: { email: 'admin.web@e2e.test', password: 'Admin@12345' } });
  expect(admin.status()).toBe(200);
  const token = (await admin.json()).accessToken;
  const email = `capture.ui.${Date.now()}@e2e.test`,
    password = 'FixtureBroker123';
  const org = await request.post(API + '/admin/organizations', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Capture UI fixture', email, password, firmName: 'Isolated capture UI' },
  });
  expect(org.status()).toBe(201);
  const session = await (await request.post(API + '/auth/login', { data: { email, password } })).json();
  await request.post(API + '/broker/onboarding', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { firmName: 'Isolated capture UI', phone: '9811100001', localityIds: [] },
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker/inventory');
  await page.getByRole('link', { name: 'Scan / import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scanner & import', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Camera scan', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /WhatsApp export · TXT/ })).toBeVisible();
  const text = 'Sector 45, 2 BHK requirement, budget 20k. Contact 9899980802';
  await page.getByRole('button', { name: 'Requirements', exact: true }).click();
  await page.getByLabel('Original message', { exact: true }).fill(text);
  await expect(page.getByRole('status').filter({ hasText: 'Encrypted draft saved' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Original message', { exact: true })).toHaveValue(text);
  await expect(page.getByRole('button', { name: 'Requirements', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Persisted data is ciphertext, not the original contact text.
  const serialized = await page.evaluate(
    async () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('brokeriq-private-drafts');
        open.onsuccess = () => {
          const query = open.result.transaction('drafts').objectStore('drafts').getAll();
          query.onsuccess = () => resolve(JSON.stringify(query.result));
          query.onerror = () => reject(query.error);
        };
      }),
  );
  expect(serialized).not.toContain(text);
  await page.getByRole('button', { name: 'Save & extract for review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved sources', exact: true })).toBeVisible();
  expect((await request.get(API + '/inventory', { headers: { Authorization: `Bearer ${session.accessToken}` } })).status()).toBe(200);
  const rows = await (await request.get(API + '/inventory', { headers: { Authorization: `Bearer ${session.accessToken}` } })).json();
  expect(rows.total).toBe(0);
  await expect(page.getByRole('button', { name: 'Save & extract for review', exact: true })).toBeEnabled();
  await page
    .getByLabel('WhatsApp chat export files')
    .setInputFiles({
      name: 'chat-export.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('[18/10/2026, 10:00:00] Fixture: Need 1 BHK in Sector 45, budget 15k, contact 9899980802'),
    });
  await expect(page.getByRole('link', { name: 'chat-export.txt', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Product features & upcoming' }).click();
  await expect(page.getByRole('heading', { name: 'Your product workspace' })).toBeVisible();
  await expect(page.locator('article[aria-disabled=true]').filter({ hasText: 'Deals & invoices' })).toBeVisible();
  await page.screenshot({ path: '/Users/yashjangid/Library/Caches/BrokerIQ/capture-catalog-desktop24.png', fullPage: true });
  const customer = await (
    await request.post(API + '/auth/register', {
      data: { name: 'Catalog access fixture', email: `catalog.${Date.now()}@e2e.test`, password, accountType: 'USER' },
    })
  ).json();
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), customer);
  await page.goto('/user/account');
  await page.getByRole('button', { name: 'Product features & upcoming' }).click();
  await expect(page.locator('article[aria-disabled=true]').filter({ hasText: 'Deals & invoices' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Scanner · Inventory/ })).toHaveCount(0);
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), {
    ...(await (await request.post(API + '/auth/login', { data: { email: 'admin.web@e2e.test', password: 'Admin@12345' } })).json()),
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Product features & upcoming' }).click();
  await expect(page.locator('article[aria-disabled=true]').filter({ hasText: 'Deals & invoices' })).toBeVisible();
  expect(errors).toEqual([]);
});
