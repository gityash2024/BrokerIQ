import { expect, test } from '@playwright/test';
import { API, createBrokerFixture } from './fixtures';

test('a firm admin can remove and restore Chat on an active broker agent session', async ({ page, request, browser }) => {
  const { session: admin } = await createBrokerFixture(request);
  const headers = { Authorization: 'Bearer ' + admin.accessToken };
  const identity = { name: 'Chat test agent', email: `chat.${crypto.randomUUID()}@e2e.test` };
  const invitation = await request.post(API + '/broker/team/invite', { headers, data: { ...identity, role: 'BROKER_AGENT' } });
  expect(invitation.status()).toBe(201);
  const invite = (await invitation.json()).link.split('/').pop();
  const registration = await request.post(API + '/auth/register', {
    data: { ...identity, password: 'FixtureAgent123', accountType: 'USER' },
  });
  expect(registration.status()).toBe(201);
  const account = await registration.json();
  const membership = await request.post(API + '/invites/' + invite + '/accept', {
    headers: { Authorization: 'Bearer ' + account.accessToken }, data: {},
  });
  expect(membership.status()).toBe(201);
  const agent = await membership.json();

  const agentContext = await browser.newContext();
  try {
    const agentPage = await agentContext.newPage();
    await agentPage.goto('/login');
    await agentPage.evaluate((session) => localStorage.setItem('biq.auth', JSON.stringify(session)), agent);
    const ready = agentPage.waitForResponse((r) => r.url().endsWith('/api/auth/me') && r.status() === 200);
    await agentPage.goto('/broker/inbox');
    const nav = agentPage.getByRole('navigation', { name: 'Workspace navigation' });
    await expect(nav.getByRole('link', { name: 'Inbox', exact: true })).toBeVisible();
    await ready;

    await page.goto('/login');
    await page.evaluate((session) => localStorage.setItem('biq.auth', JSON.stringify(session)), admin);
    await page.goto('/broker/team/' + agent.user.id);
    await page.getByRole('button', { name: 'Remove Chat access' }).click();
    await expect(page.getByRole('button', { name: 'Allow Chat access' })).toBeVisible();
    await expect(agentPage).toHaveURL(/\/broker$/);
    await expect(nav.getByRole('link', { name: 'Inbox', exact: true })).toHaveCount(0);
    await agentPage.goto('/broker/inbox?channel=CHAT');
    await expect(agentPage).toHaveURL(/\/broker$/);

    await page.getByRole('button', { name: 'Allow Chat access' }).click();
    await expect(nav.getByRole('link', { name: 'Inbox', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Edit module permissions', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit module permissions', exact: true })).toBeVisible();
    const leadsView = page.getByRole('group', { name: /Leads & Requirements/ }).getByRole('checkbox', { name: 'view', exact: true });
    await expect(leadsView).toBeChecked();
    await leadsView.uncheck();
    await page.getByRole('button', { name: 'Save permissions', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/broker/team/' + agent.user.id + '$'));
    await expect(nav.getByRole('link', { name: 'Leads', exact: true })).toHaveCount(0);
    expect((await request.get(API + '/leads', { headers: { Authorization: 'Bearer ' + agent.accessToken } })).status()).toBe(403);

    await page.goto('/broker/team');
    const roles = page.locator('select').filter({ has: page.locator('option[value="BROKER_AGENT"]') });
    const search = page.getByPlaceholder('मेंबर खोजें — नाम, ईमेल, फ़ोन...');
    await roles.selectOption('BROKER_AGENT');
    await search.fill(identity.email);
    const row = page.getByRole('row').filter({ hasText: identity.email });
    await row.getByRole('button', { name: 'Details & Target' }).click();
    await expect(page.getByRole('heading', { name: identity.name })).toBeVisible();
    await page.goBack();
    await expect(roles).toHaveValue('BROKER_AGENT');
    await expect(search).toHaveValue(identity.email);

    await row.getByRole('button', { name: 'Details & Target' }).click();
    await page.getByRole('button', { name: 'Team से हटाएँ' }).click();
    const confirmation = page.getByRole('dialog', { name: 'Team action की पुष्टि' });
    await confirmation.getByRole('button', { name: 'पुष्टि करें' }).click();
    await expect(page).toHaveURL(/\/broker\/team$/);
    await expect(roles).toHaveValue('BROKER_AGENT');
    await expect(search).toHaveValue(identity.email);
    await expect(row).toHaveCount(0);
  } finally {
    await agentContext.close();
  }
});
