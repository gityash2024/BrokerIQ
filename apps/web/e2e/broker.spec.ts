import { expect, request, test, type APIRequestContext } from '@playwright/test';

import { API, createBrokerFixture } from './fixtures';

const uniq = Date.now().toString(36);
const lead = { name: `PW Lead ${uniq}`, phone: `98${String(Date.now()).slice(-8)}` };
let api: APIRequestContext;
let broker: Awaited<ReturnType<typeof createBrokerFixture>>;
let token: string;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: API + '/' });
  broker = await createBrokerFixture(api);
  token = broker.session.accessToken;
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
  token = await page.evaluate(() => JSON.parse(localStorage.getItem('biq.auth')!).accessToken);

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
  await page.getByRole('link', { name: 'Add lead', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add lead', exact: true })).toBeVisible();
  await page.getByLabel('नाम', { exact: false }).fill(lead.name);
  await page.getByLabel('Mobile', { exact: false }).fill(lead.phone);
  await page.getByRole('button', { name: 'Save lead', exact: true }).click();

  await expect(page.getByRole('heading', { name: lead.name, exact: true })).toBeVisible({ timeout: 20_000 });
  const leadId = new URL(page.url()).pathname.split('/').pop()!;

  if (process.env.BROKER_FIRST === 'true') {
    await page.getByRole('button', { name: 'Requirement', exact: true }).click();
    await page.getByRole('link', { name: 'Add requirement', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New requirement', exact: true })).toBeVisible();
    await page.locator('input[name=localityNames]').fill('Sector 43');
    await page.locator('select[name=purpose]').selectOption('RENT');
    await page.getByRole('button', { name: 'Save requirement', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/broker/leads/' + leadId + '$'));
    await expect(page.getByText('Sector 43', { exact: true }).first()).toBeVisible();
    const saved = await api.get(`broker-requirements?leadId=${leadId}`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await saved.json()).total).toBe(1);
  }

  const stages = page.getByRole('group', { name: 'Lead progress' });
  const contacted = stages.getByRole('button', { name: 'Contacted', exact: true });
  await expect(stages.getByRole('button', { name: 'New', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await contacted.click();
  await expect(contacted).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  await page.reload();
  await expect(contacted).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Edit lead', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit lead' });
  await expect(editor).toBeVisible();
  await page.goBack();
  await expect(editor).toBeHidden();
  await expect(page).toHaveURL(new RegExp('/broker/leads/' + leadId + '$'));
  await page.goForward();
  await expect(editor).toBeVisible();
  await editor.getByLabel('Name', { exact: true }).fill(lead.name + ' corrected');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('heading', { name: lead.name + ' corrected' })).toBeVisible();
  await expect(contacted).toHaveAttribute('aria-pressed', 'true');
});
