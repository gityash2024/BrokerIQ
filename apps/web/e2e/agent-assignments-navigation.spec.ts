import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { createBrokerFixture } from './fixtures';

test('Back restores the assignment dialog and Forward returns to the record', async ({ page, request }) => {
  const { session } = await createBrokerFixture(request);
  const organizationId = session.user.organization!.id;
  const { PrismaClient } = createRequire(resolve(__dirname, '../../api/package.json'))('@prisma/client');
  const db = new PrismaClient();
  try {
    const agent = await db.user.create({
      data: { organizationId, name: 'Assigned agent', role: 'BROKER_AGENT', email: `assignments.${crypto.randomUUID()}@e2e.test` },
    });
    const lead = await db.lead.create({
      data: { organizationId, assignedToId: agent.id, name: 'Assignment navigation lead', phone: '+919811108419' },
    });
    await db.followUp.create({ data: { organizationId, assignedToId: agent.id, leadId: lead.id, dueAt: new Date() } });
    await page.goto('/login');
    await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
    await page.goto('/broker');
    await page.getByRole('button', { name: 'Agent assignments', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search assigned agents' }).fill('Assigned');
    await page.getByRole('button', { name: 'Open assignments for Assigned agent' }).click();
    const dialog = page.getByRole('dialog', { name: 'Assigned agent · Assignments' });
    const category = dialog.getByRole('button', { name: 'Follow-ups' });
    await category.click();
    await dialog.getByRole('link', { name: 'Open Assignment navigation lead' }).click();
    await expect(page).toHaveURL(new RegExp(`/broker/leads/${lead.id}\\?tab=tasks`));
    await page.goBack();
    await expect(dialog).toBeVisible();
    await expect(category).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('link', { name: 'Open Assignment navigation lead' })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/broker/leads/${lead.id}`));
    await page.goBack();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: 'Search assigned agents' })).toHaveValue('Assigned');
  } finally {
    await db.$disconnect();
  }
});
