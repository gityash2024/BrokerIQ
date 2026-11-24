import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { createBrokerFixture } from './fixtures';

test('Back restores all assignment drill-throughs, pagination and dialog scroll', async ({ page, request }) => {
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
    const assigned = { organizationId, assignedToId: agent.id };
    const requirement = await db.brokerRequirement.create({ data: { ...assigned, title: 'Assignment requirement', purpose: 'RENT' } });
    const property = await db.inventoryItem.create({ data: { ...assigned, houseNo: '325', sector: 'Sector 30', purpose: 'RENT' } });
    const task = { ...assigned, leadId: lead.id };
    await db.siteVisit.create({ data: { ...task, scheduledAt: new Date() } });
    await db.followUp.create({ data: { ...task, dueAt: new Date() } });
    await db.followUp.createMany({ data: Array.from({ length: 38 }, (_, index) => ({
      ...task, dueAt: new Date(Date.now() - (index + 1) * 60_000), note: 'Follow-up ' + (index + 1),
    })) });
    await page.goto('/login');
    await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
    await page.goto('/broker');
    await page.getByRole('button', { name: 'Agent assignments', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search assigned agents' }).fill('Assigned');
    await page.getByRole('button', { name: 'Open assignments for Assigned agent' }).click();
    const dialog = page.getByRole('dialog', { name: 'Assigned agent · Assignments' });
    for (const [name, title, destination] of [
      ['Leads', lead.name, '/broker/leads/' + lead.id],
      ['Requirements', requirement.title, '/broker/leads/requirements/' + requirement.id + '/edit'],
      ['Properties', 'House 325 · Sector 30', '/broker/inventory/' + property.id],
      ['Site visits', lead.name, '/broker/leads/' + lead.id + '?tab=tasks'],
    ] as const) {
      const category = dialog.getByRole('button', { name, exact: true });
      await category.click();
      const detail = dialog.getByRole('link', { name: 'Open ' + title, exact: true });
      await detail.click();
      await expect(page).toHaveURL((url) => url.pathname + url.search === destination);
      await page.goBack();
      await expect(dialog).toBeVisible();
      await expect(category).toHaveAttribute('aria-pressed', 'true');
      await expect(detail).toBeVisible();
    }
    const category = dialog.getByRole('button', { name: 'Follow-ups', exact: true });
    await category.click();
    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(dialog.getByText('Page 2', { exact: true })).toBeVisible();
    const lastRecord = dialog.getByRole('link', { name: 'Open ' + lead.name, exact: true }).last();
    await lastRecord.scrollIntoViewIfNeeded();
    const scrollArea = dialog.locator('[data-route-scroll="agent-assignment-details"]');
    const scrollBefore = await scrollArea.evaluate((element) => element.scrollTop);
    expect(scrollBefore).toBeGreaterThan(0);
    await lastRecord.click();
    await expect(page).toHaveURL((url) => url.pathname === '/broker/leads/' + lead.id && url.searchParams.get('tab') === 'tasks');
    await page.goBack();
    await expect(category).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByText('Page 2', { exact: true })).toBeVisible();
    await expect.poll(async () => Math.abs(await scrollArea.evaluate((element) => element.scrollTop) - scrollBefore)).toBeLessThan(12);
    await page.goForward();
    await expect(page).toHaveURL((url) => url.pathname === '/broker/leads/' + lead.id);
    await page.goBack();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: 'Search assigned agents' })).toHaveValue('Assigned');
  } finally {
    await db.$disconnect();
  }
});
