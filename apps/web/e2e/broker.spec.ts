import { expect, request, test, type APIRequestContext } from '@playwright/test';

/**
 * Broker CRM flow on the real stack: a fresh broker logs in on the website, adds a lead and moves it along the pipeline.
 * The test admin (SUPER_ADMIN_EMAIL in playwright.config.ts) only switches on broker signup + password login.
 */
const API = `${process.env.E2E_API_URL ?? 'http://localhost:3099'}/api/`;
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? 'admin.web@e2e.test', password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin@12345' };
const uniq = Date.now().toString(36);
const digits = (n: number) => String(Date.now()).slice(-n).padStart(n, '7');
const broker = { email: `pw.broker.${uniq}@e2e.test`, password: 'Passw0rd!', firm: `PW Realty ${uniq}` };
const lead = { name: `PW Lead ${uniq}`, phone: `98${digits(8)}` };

let api: APIRequestContext;
let token: string;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: API });
  const admin = await api.post('auth/login', { data: ADMIN });
  expect(admin.status(), 'test admin login').toBe(200);
  const adminToken = (await admin.json()).accessToken;
  await api.patch('admin/app-config', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { auth: { allowBrokerSignup: true, allowPasswordLogin: true } },
  });
  const reg = await api.post('auth/register', {
    data: { name: 'PW Broker', email: broker.email, password: broker.password, accountType: 'BROKER', firmName: broker.firm },
  });
  expect(reg.status(), await reg.text()).toBe(201);
  const ob = await api.post('broker/onboarding', {
    headers: { Authorization: `Bearer ${(await reg.json()).accessToken}` },
    data: { firmName: broker.firm, phone: `97${digits(8)}` },
  });
  expect(ob.status(), await ob.text()).toBe(201);
  token = (await ob.json()).accessToken;
});

test.afterAll(async () => api?.dispose());

test('broker logs in, adds a lead and moves it to Contacted', async ({ page }) => {
  await page.goto('/login');
  const passwordTab = page.getByRole('button', { name: /Password/ }).first();
  if (await passwordTab.isVisible().catch(() => false)) await passwordTab.click();
  await page.locator('input[type="email"]').first().fill(broker.email);
  await page.locator('input[type="password"]').fill(broker.password);
  await page.locator('input[type="password"]').press('Enter');
  await expect(page).toHaveURL(/\/broker/, { timeout: 20_000 });

  await page.goto('/broker/leads');
  // First visit shows the one-time location-consent card; a user can close it.
  const consent = page.getByRole('dialog').filter({ hasText: 'आपकी जानकारी' });
  if (
    await consent.waitFor({ timeout: 8_000 }).then(
      () => true,
      () => false,
    )
  ) {
    await page.keyboard.press('Escape');
    await expect(consent).toBeHidden();
  }
  await page.getByRole('button', { name: 'Lead', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('input').nth(0).fill(lead.name);
  await dialog.locator('input').nth(1).fill(lead.phone);
  await dialog.getByRole('button', { name: 'Save lead' }).click();

  await expect(page).toHaveURL(/\/broker\/leads\/[\w-]+$/, { timeout: 20_000 });
  const leadId = page.url().split('/').pop()!;
  await expect(page.getByText(lead.name).first()).toBeVisible();

  await page.getByRole('button', { name: 'Contacted', exact: true }).click();
  await expect
    .poll(async () => (await (await api.get(`leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } })).json()).stage, { timeout: 10_000 })
    .toBe('CONTACTED');
});
