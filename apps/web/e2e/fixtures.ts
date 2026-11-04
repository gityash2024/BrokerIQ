import { expect, type APIRequestContext } from '@playwright/test';
import type { AuthResponse } from '@brokeriq/shared';
import { randomUUID } from 'node:crypto';

export const API = 'http://127.0.0.1:3099/api';
export function browserAdminSession(): AuthResponse {
  const raw = process.env.BIQ_E2E_ADMIN_SESSION;
  if (!raw) throw new Error('Browser test setup did not create the isolated Admin session.');
  return JSON.parse(raw);
}

/** Real API fixtures in the explicitly isolated Playwright database, never production seeds. */
export async function createBrokerFixture(request: APIRequestContext) {
  const password = 'FixtureBroker123';
  const email = `browser.broker.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@e2e.test`;
  const headers = { Authorization: `Bearer ${browserAdminSession().accessToken}` };
  expect(
    (
      await request.post(API + '/admin/organizations', {
        headers,
        data: { name: 'Browser regression fixture', firmName: 'Isolated browser workspace', email, password },
      })
    ).status(),
  ).toBe(201);
  // The loopback-only test API trusts its immediate proxy. Give programmatic fixture
  // setup its own source address so it does not consume the browser login budget.
  const fixtureIp = '2001:db8::' + randomUUID().slice(0, 8).match(/.{4}/g)!.join(':');
  const login = await request.post(API + '/auth/login', {
    data: { email, password },
    headers: { 'X-Forwarded-For': fixtureIp },
  });
  expect(login.status()).toBe(200);
  const session = await login.json();
  const onboard = await request.post(API + '/broker/onboarding', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { firmName: 'Isolated browser workspace', phone: '9811100001', localityIds: [] },
  });
  expect(onboard.status(), await onboard.text()).toBe(201);
  return { email, password, session: (await onboard.json()) as AuthResponse };
}
