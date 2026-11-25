import { expect, test } from '@playwright/test';
import { API, createBrokerFixture } from './fixtures';

test('WhatsApp draft opens directly and preserves text with no API connection', async ({ page, request }) => {
  const { session } = await createBrokerFixture(request);
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const lead = await request.post(API + '/leads', { headers, data: { name: 'WhatsApp composer regression', phone: '+919700000301' } });
  expect(lead.status()).toBe(201);
  await page.goto('/login');
  await page.evaluate((auth) => localStorage.setItem('biq.auth', JSON.stringify(auth)), session);
  await page.goto('/broker/inbox?channel=WHATSAPP&lead=' + (await lead.json()).id);
  await expect(page).toHaveURL(/channel=WHATSAPP&c=/);
  const open = page.getByRole('link', { name: 'Open WhatsApp', exact: true });
  const draft = page.getByPlaceholder('Write a message…', { exact: true });
  await expect(open).toHaveAttribute('href', 'https://wa.me/919700000301');
  await expect(open).toHaveAttribute('target', '_blank');
  const text = 'Property update\nRent ₹42,000';
  await draft.fill(text);
  await expect(open).toHaveAttribute('href', 'https://wa.me/919700000301?text=' + encodeURIComponent(text));
  await page.reload();
  await expect(draft).toHaveValue(text);
  await expect(open).toHaveAttribute('href', 'https://wa.me/919700000301?text=' + encodeURIComponent(text));
});

test('Agent and Sub-Broker Admin with Inbox grants can open the same WhatsApp draft flow', async ({ browser, request }) => {
  const { session: admin } = await createBrokerFixture(request);
  const headers = { Authorization: 'Bearer ' + admin.accessToken };
  for (const role of ['BROKER_AGENT', 'SUB_BROKER_ADMIN'] as const) {
    const identity = { name: role + ' Inbox verification', email: `draft.${crypto.randomUUID()}@e2e.test` };
    const invite = await request.post(API + '/broker/team/invite', { headers, data: {
      ...identity, role, ...(role === 'SUB_BROKER_ADMIN' ? { delegatedPermissions: ['inbox:view', 'inbox:edit', 'inbox:send', 'leads:view'] } : {}),
    } });
    expect(invite.status()).toBe(201);
    const registered = await request.post(API + '/auth/register', {
      data: { ...identity, password: 'FixtureInbox123', accountType: 'USER' },
    });
    expect(registered.status()).toBe(201);
    const invited = (await invite.json()).link.split('/').pop();
    const accepted = await request.post(API + '/invites/' + invited + '/accept', {
      headers: { Authorization: 'Bearer ' + (await registered.json()).accessToken }, data: {},
    });
    expect(accepted.status()).toBe(201);
    const session = await accepted.json();
    expect(session.user.role).toBe(role);
    const phone = role === 'BROKER_AGENT' ? '+919700000302' : '+919700000303';
    const lead = await request.post(API + '/leads', { headers, data: {
      name: 'WhatsApp role regression', phone, ...(role === 'BROKER_AGENT' ? { assignedToId: session.user.id } : {}),
    } });
    expect(lead.status()).toBe(201);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto('/login');
      await page.evaluate((auth) => localStorage.setItem('biq.auth', JSON.stringify(auth)), session);
      await page.goto('/broker/inbox?channel=WHATSAPP&lead=' + (await lead.json()).id);
      await expect(page.getByRole('link', { name: 'Open WhatsApp', exact: true })).toHaveAttribute('href', 'https://wa.me/' + phone.slice(1));
      await expect(page.getByPlaceholder('Write a message…', { exact: true })).toBeEditable();
    } finally {
      await context.close();
    }
  }
});
