import { expect, test, type APIRequestContext } from '@playwright/test';
import { API, createBrokerFixture } from './fixtures';
import { delegatedGrant, delegableModules } from '@brokeriq/shared';

async function inviteDelegate(request: APIRequestContext, token: string, permissions: string[]) {
  const identity = { name: 'Delegated workspace test', email: `role.${crypto.randomUUID()}@e2e.test` };
  const created = await request.post(API + '/broker/team/invite', {
    headers: { Authorization: 'Bearer ' + token },
    data: { ...identity, role: 'SUB_BROKER_ADMIN', delegatedPermissions: permissions },
  });
  expect(created.status(), await created.text()).toBe(201);
  const code = new URL((await created.json()).link).pathname.split('/').pop();
  const account = await request.post(API + '/auth/register', {
    data: { ...identity, password: 'TestingBroker123!', accountType: 'USER' },
  });
  expect(account.status()).toBe(201);
  const accepted = await request.post(API + '/invites/' + code + '/accept', {
    headers: { Authorization: 'Bearer ' + (await account.json()).accessToken },
  });
  expect(accepted.status()).toBe(201);
  return accepted.json();
}

test('assigned workspace opens with no permission errors and lead assignment is usable', async ({ page, request }) => {
  const broker = await createBrokerFixture(request);
  const config = await (await request.get(API + '/public/config')).json();
  const grants = delegableModules(config.modules).flatMap(({ key, actions }) => actions.map((action) => delegatedGrant(key, action)));
  const session = await inviteDelegate(request, broker.session.accessToken, grants);
  const lead = await request.post(API + '/leads', {
    headers: { Authorization: 'Bearer ' + broker.session.accessToken },
    data: { name: 'Delegation assignment check', phone: '9811122054', source: 'MANUAL' },
  });
  expect(lead.status(), await lead.text()).toBe(201);
  const id = (await lead.json()).id;
  const denied: string[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith(API) && response.status() === 403) denied.push(new URL(response.url()).pathname);
  });
  await page.goto('/login');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker');
  await expect(page.getByText('Inventory records', { exact: true })).toBeVisible();
  await page.goto('/broker/team/leaderboard');
  await expect(page.getByText('Browser regression fixture', { exact: true })).toBeVisible();
  await page.goto('/broker/leads/' + id);
  const picker = page.locator('select').filter({ has: page.getByRole('option', { name: 'Unassigned', exact: true }) });
  await expect(picker.getByRole('option', { name: 'Browser regression fixture' })).toBeAttached();
  const assigned = page.waitForResponse((res) => res.url().endsWith('/assign') && res.request().method() === 'PATCH');
  await picker.selectOption(broker.session.user.id);
  expect((await assigned).status()).toBe(200);
  await page.goto('/broker/team/time-logging');
  await expect(page.getByRole('heading', { name: 'Time Logging & Location History' })).toBeVisible();
  expect(denied).toEqual([]);
});

test('lead view only does not request the assignee list or blocked modules', async ({ page, request }) => {
  const broker = await createBrokerFixture(request);
  const session = await inviteDelegate(request, broker.session.accessToken, ['leads:view']);
  const requests: string[] = [];
  page.on('request', (req) => { if (req.url().startsWith(API)) requests.push(new URL(req.url()).pathname); });
  await page.goto('/login');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker/leads');
  await expect(page.getByRole('heading', { name: 'Lead inbox', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add lead', exact: true })).toHaveCount(0);
  await page.goto('/broker/inventory');
  await expect(page.getByText('Access restricted', { exact: true })).toBeVisible();
  expect(requests).not.toContain('/api/leads/assignees');
  expect(requests.some((path) => /^\/api\/(inventory|time-logging|broker\/dashboard|broker\/team)(\/|$)/.test(path))).toBe(false);
});
