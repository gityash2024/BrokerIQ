import { expect, type APIRequestContext } from '@playwright/test';
/** Real API fixtures in the explicitly isolated Playwright database, never production seeds. */
export async function createBrokerFixture(request: APIRequestContext) {
  const password = 'FixtureBroker123';
  const email = `browser.broker.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@e2e.test`;
  const admin = await request.post('http://localhost:3099/api/auth/login', {
    data: { email: 'admin.web@e2e.test', password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345' },
  });
  expect(admin.status()).toBe(200);
  const headers = { Authorization: `Bearer ${(await admin.json()).accessToken}` };
  expect(
    (
      await request.post('http://localhost:3099/api/admin/organizations', {
        headers,
        data: { name: 'Browser regression fixture', firmName: 'Isolated browser workspace', email, password },
      })
    ).status(),
  ).toBe(201);
  const login = await request.post('http://localhost:3099/api/auth/login', { data: { email, password } });
  expect(login.status()).toBe(200);
  const session = await login.json();
  expect(
    (
      await request.post('http://localhost:3099/api/broker/onboarding', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        data: { firmName: 'Isolated browser workspace', phone: '9811100001', localityIds: [] },
      })
    ).status(),
  ).toBe(201);
  return { email, password, session };
}
