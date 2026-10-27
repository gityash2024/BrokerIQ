import { expect, test } from '@playwright/test';
import { createBrokerFixture } from './fixtures';

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
  await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: broker.email });
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell').nth(2)).toHaveText('0');
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
  await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
