import { expect, test } from '@playwright/test';
import { API, createBrokerFixture } from './fixtures';

test('team renders real stats after assignee screens, creates and lists an invite', async ({ page, request }) => {
  const broker = await createBrokerFixture(request);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.locator('input[type=email]').fill(broker.email);
  await page.locator('input[type=password]').fill(broker.password);
  await page.locator('input[type=password]').press('Enter');
  await expect(page).toHaveURL(/\/broker$/);
  // Populate the assignee query before opening Team, catching cache-shape collisions too.
  await page.goto('/broker/leads');
  await expect(page.getByRole('heading', { name: 'Lead inbox', exact: true })).toBeVisible();
  await page.goto('/broker/team');
  await expect(page.getByRole('heading', { name: 'Team & Agents', exact: true })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: broker.email });
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell').nth(6)).toHaveText('0');
  await page.getByRole('button', { name: 'Member invite करें', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input').nth(0).fill('UI invite regression');
  const invitedEmail = `ui.agent.${Date.now()}@e2e.test`;
  await dialog.locator('input[type=email]').fill(invitedEmail);
  await dialog.getByRole('button', { name: 'Invite भेजें', exact: true }).click();
  await expect(dialog.getByText('Invite link', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText(invitedEmail, { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText(invitedEmail, { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Team & Agents', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});


test('Broker Admin invites a Sub-Broker Admin with one action and the browser uses the restricted session', async ({ page, request }) => {
  const broker = await createBrokerFixture(request);
  await page.goto('/login');
  await page.evaluate((session) => localStorage.setItem('biq.auth', JSON.stringify(session)), broker.session);
  await page.goto('/broker/team');
  await page.getByRole('button', { name: 'Member invite करें', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const identity = { name: 'Delegation regression', email: `delegate.${Date.now()}@e2e.test` };
  await dialog.locator('input').first().fill(identity.name);
  await dialog.locator('input[type=email]').fill(identity.email);
  await dialog.locator('select').selectOption('SUB_BROKER_ADMIN');
  await dialog.getByRole('group', { name: /Inventory/ }).getByRole('checkbox', { name: 'view', exact: true }).check();
  const created = page.waitForResponse((res) => res.url().endsWith('/broker/team/invite') && res.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Invite भेजें', exact: true }).click();
  const inviteResponse = await created;
  expect(inviteResponse.status()).toBe(201);
  const token = new URL((await inviteResponse.json()).link).pathname.split('/').pop();
  const accountResponse = await request.post(API + '/auth/register', {
    data: { ...identity, password: 'FixtureDelegate123', accountType: 'USER' },
  });
  expect(accountResponse.status()).toBe(201);
  const account = await accountResponse.json();
  const joined = await request.post(API + '/invites/' + token + '/accept', {
    headers: { Authorization: 'Bearer ' + account.accessToken },
    data: {},
  });
  expect(joined.status()).toBe(201);
  const session = await joined.json();
  expect(session.user.delegatedPermissions).toEqual(['inventory:view']);
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker');
  await expect(page.getByRole('heading', { name: 'Sub-Broker Admin', exact: true })).toBeVisible();
  await page.goto('/broker/inventory');
  await expect.poll(async () => (await request.get(API + '/inventory', { headers: { Authorization: 'Bearer ' + session.accessToken } })).status()).toBe(200);
  await page.goto('/broker/team');
  await expect(page.getByRole('button', { name: 'Member invite करें', exact: true })).toHaveCount(0);
});
