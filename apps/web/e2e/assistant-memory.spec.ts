import { expect, test } from '@playwright/test';
import { API, browserAdminSession } from './fixtures';

test('Assistant restores encrypted account history after a reload and clears it on request', async ({ page, request }) => {
  const auth = browserAdminSession();
  const headers = { Authorization: 'Bearer ' + auth.accessToken };
  await request.delete(API + '/assistant/history', { headers });
  await page.addInitScript((session) => localStorage.setItem('biq.auth', JSON.stringify(session)), auth);
  await page.goto('/admin');
  const open = async () => {
    const history = page.waitForResponse((response) => response.url().endsWith('/assistant/history') && response.request().method() === 'GET');
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    expect((await history).ok()).toBe(true);
  };
  const question = 'Approval के लिए कितनी listings pending हैं?';
  await open();
  await page.getByRole('button', { name: question, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Moderation queue', exact: true })).toBeVisible();

  await page.reload();
  await open();
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  await expect(page.getByText('ताज़ा जानकारी फिर से देखी जा सकती है।', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Moderation queue', exact: true })).toHaveCount(0);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Clear assistant history' }).click();
  await expect(page.getByText(question, { exact: true }).filter({ visible: true })).toHaveCount(1); // visible again as a suggested question
  const saved = await request.get(API + '/assistant/history', { headers });
  expect((await saved.json()).messages).toEqual([]);
});
