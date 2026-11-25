import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { API, browserAdminSession, createBrokerFixture } from './fixtures';

const { PrismaClient } = createRequire(resolve(__dirname, '../../api/package.json'))('@prisma/client');

test('the organic workspaces open in Super Admin', async ({ page }) => {
  const db = new PrismaClient();
  const recordTitle = 'Sector 30 rental';
  const values = { title: recordTitle, kind: 'SUPPLY', ownership: 'OWNER_CONFIRMED', availability: 'AVAILABLE', sectors: ['Sector 30'] };
  try {
    await db.organicRecord.upsert({ where: { kind_key: { kind: 'SUPPLY', key: 'organic-navigation-test' } }, update: {},
      create: { ...values, key: 'organic-navigation-test', priority: 'MEDIUM', confidence: 80, values: { ...values, url: 'https://example.test/sector-30-rental' } } });
  } finally {
    await db.$disconnect();
  }
  await page.goto('/login');
  await page.evaluate((session) => localStorage.setItem('biq.auth', JSON.stringify(session)), browserAdminSession());
  for (const [path, title] of [
    ['supply', 'Organic Property Supply'],
    ['demand', 'Organic Buyer & Tenant Leads'],
    ['sources', 'Discovery sources'],
    ['workflows', 'Organic Automation'],
    ['delivery', 'Daily Lead Delivery'],
  ]) {
    await page.goto('/admin/organic/' + path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    if (path === 'supply' || path === 'demand') {
      const recommended = page.getByRole('button', { name: path === 'supply' ? 'Direct owners' : 'Genuine demand', exact: true });
      await expect(recommended).toHaveAttribute('aria-pressed', 'true');
      if (path === 'supply') {
        const search = page.getByLabel('Search', { exact: true });
        await search.fill('Sector 30');
        await page.getByRole('button', { name: recordTitle, exact: true }).click();
        const detail = page.getByRole('dialog', { name: recordTitle, exact: true });
        await expect(detail).toBeVisible();
        await page.goBack();
        await expect(detail).toHaveCount(0);
        await expect(search).toHaveValue('Sector 30');
        await page.goForward();
        await expect(detail).toBeVisible();
        await detail.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(detail).toHaveCount(0);
      }
      await page.getByRole('button', { name: 'All records', exact: true }).click();
      await expect(recommended).toHaveAttribute('aria-pressed', 'false');
    }
  }
  await expect(page.getByText('All new eligible leads', { exact: true })).toBeAttached();
});

test('PDF Inventory has its own upload and filters on desktop and narrow screens', async ({ page, request }) => {
  const { session } = await createBrokerFixture(request);
  const db = new PrismaClient();
  const organizationId = session.user.organization!.id;
  try {
    await db.importBatch.create({ data: {
      organizationId, sourceType: 'PDF', sourceHash: 'pdf-navigation-test', fileName: 'PDF navigation.pdf', status: 'COMPLETE',
      pdfRows: { create: { organizationId, pageNo: 4, rowNo: 1, address: 'Sector 30, Gurgaon', rawText: 'Sector 30, Gurgaon', sector: 'Sector 30' } },
    } });
  } finally {
    await db.$disconnect();
  }
  await page.goto('/login');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker/inventory/pdf');
  await expect(page.getByRole('heading', { name: 'PDF Inventory', exact: true })).toBeVisible();
  await expect(page.getByLabel('Property PDF')).toHaveAttribute('accept', 'application/pdf,.pdf');
  await expect(page.getByLabel('PDF batch')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByRole('button', { name: 'Import property from PDF' })).toBeVisible();
  await expect(page.getByLabel('PDF batch')).toBeVisible();
  const sector = page.getByRole('searchbox', { name: 'Sector', exact: true });
  await sector.fill('Sector 30');
  await page.getByRole('button', { name: 'Open property', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Sector 30, Gurgaon' });
  await expect(detail).toBeVisible();
  await page.goBack();
  await expect(detail).toHaveCount(0);
  await expect(sector).toHaveValue('Sector 30');
  await page.goForward();
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(detail).toHaveCount(0);
  await expect(sector).toHaveValue('Sector 30');
});

test('invoice edits keep the filtered list and cancellation preserves invoice history', async ({ page, request }) => {
  const { session } = await createBrokerFixture(request);
  const created = await request.post(API + '/broker/invoices', {
    headers: { Authorization: 'Bearer ' + session.accessToken },
    data: { clientName: 'Invoice cancellation fixture', items: [{ description: 'Brokerage', amount: 1000 }] },
  });
  expect(created.ok()).toBeTruthy();
  const { number } = await created.json();
  await page.goto('/login');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker/invoices');
  await page.getByRole('button', { name: 'Pending', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Edit invoice ' + number });
  await detail.getByLabel('Due date').fill('2026-12-02');
  await detail.getByLabel('Notes').fill('Client requested December due date');
  await detail.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(detail).toHaveCount(0);
  await expect(page.getByText(number, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(detail.getByLabel('Due date')).toHaveValue('2026-12-02');
  await page.goBack();
  await expect(detail).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel invoice', exact: true }).click();
  await expect(page.getByText(number, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancelled', exact: true }).click();
  await expect(page.getByText(number, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
});
