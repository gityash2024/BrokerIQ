import { expect, test } from '@playwright/test';
import { API, browserAdminSession, createBrokerFixture } from './fixtures';

test('both admin workspaces read a new point at the ten-minute timer', async ({ browser, request }) => {
  test.setTimeout(120_000);
  const { session: broker } = await createBrokerFixture(request);
  const auth = { Authorization: 'Bearer ' + broker.accessToken };
  const coords = { latitude: 28.422, longitude: 77.077, accuracy: 15 };
  const started = await request.post(API + '/time-logging/punch-in', { headers: auth, data: { ...coords, address: 'Recorded test address' } });
  expect(started.status(), await started.text()).toBe(201);
  const shiftId = (await started.json()).shift.id;
  try {
    for (const [path, session] of [
      ['/broker/team/time-logging', broker],
      ['/admin/team/time-logging', browserAdminSession()],
    ] as const) {
      const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3311' });
      const page = await context.newPage();
      try {
        const before = await request.get(API + '/time-logging/history', { headers: auth });
        expect(before.ok()).toBe(true);
        const count = (await before.json()).count;
        await page.clock.install();
        await page.goto('/');
        await page.evaluate((s) => localStorage.setItem('biq.auth', JSON.stringify(s)), session);
        await page.goto(path + '?memberId=' + encodeURIComponent(broker.user.id));
        await expect(page.getByText(count + ' breadcrumbs captured', { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Location History Map' })).toBeVisible();
        await expect(page.getByText(/refreshes every 10 minutes/)).toBeVisible();
        await expect(page.getByText('Recorded test address (±15 m)', { exact: true }).first()).toBeVisible();
        const point = await request.post(API + '/time-logging/location', {
          headers: auth,
          data: { ...coords, shiftId, eventId: 'browser-clock-' + Date.now(), capturedAt: new Date().toISOString() },
        });
        expect(point.status(), await point.text()).toBe(201);
        await expect(page.getByText(count + ' breadcrumbs captured', { exact: true })).toBeVisible();
        const polled = page.waitForResponse((r) => r.url().includes('/time-logging/history?') && r.status() === 200);
        await page.clock.fastForward(600_000);
        await polled;
        await expect(page.getByText(count + 1 + ' breadcrumbs captured', { exact: true })).toBeVisible();
        const latest = page.getByText(/Latest location/).locator('..');
        await expect(latest).toContainText('Near Sector 57');
        await expect(latest.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
          'href',
          'https://www.google.com/maps/search/?api=1&query=28.422%2C77.077',
        );
        await expect(page.locator('.leaflet-marker-icon .biq-price-pin').first()).toBeVisible();
        console.log('Location poll and refreshed breadcrumb count verified for ' + session.user.role);
      } finally {
        await context.close();
      }
    }
  } finally {
    await request.post(API + '/time-logging/punch-out', { headers: auth, data: { shiftId } });
  }
});
