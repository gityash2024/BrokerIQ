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
  await page
    .getByRole('button', { name: /^(Lead|Add lead)$/, exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('input').nth(0).fill(lead.name);
  await dialog.locator('input').nth(1).fill(lead.phone);
  await dialog.getByRole('button', { name: 'Save lead' }).click();

  await expect(page).toHaveURL(/\/broker\/leads\/[\w-]+$/, { timeout: 20_000 });
  const leadId = page.url().split('/').pop()!;
  await expect(page.getByText(lead.name).first()).toBeVisible();

  if (process.env.BROKER_FIRST === 'true') {
    await page.getByRole('button', { name: 'Requirement', exact: true }).click();
    await page.getByRole('button', { name: 'Add requirement', exact: true }).click();
    const requirement = page.getByRole('dialog');
    await requirement.locator('input[name=localityNames]').fill('Sector 43');
    await requirement.locator('select[name=purpose]').selectOption('RENT');
    await requirement.getByRole('button', { name: 'Save requirement', exact: true }).click();
    await expect(requirement).toBeHidden();
    await expect(page.getByText('Sector 43', { exact: true }).first()).toBeVisible();
    const saved = await api.get(`broker-requirements?leadId=${leadId}`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await saved.json()).total).toBe(1);
  }

  await page.getByRole('button', { name: 'Contacted', exact: true }).click();
  await expect
    .poll(async () => (await (await api.get(`leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } })).json()).stage, { timeout: 10_000 })
    .toBe('CONTACTED');
});
