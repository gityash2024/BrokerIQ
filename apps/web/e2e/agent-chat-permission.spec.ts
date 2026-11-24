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
  } finally {
    await agentContext.close();
  }
});
