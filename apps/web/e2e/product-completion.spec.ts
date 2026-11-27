import { expect, test } from '@playwright/test';
import { API, createBrokerFixture } from './fixtures';
import { inventoryMonth } from '@brokeriq/shared';

test('Survey address lookup identifies existing units and returns only the selected historical record', async ({ page, request }) => {
  const { session } = await createBrokerFixture(request);
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const houseNo = 'Revisit 48';
  const property = {
    houseNo, sector: 'Sector 30', purpose: 'RENT', category: 'RESIDENTIAL', propertyType: 'APARTMENT',
    bhk: 2, roomKind: 'BHK', furnishing: 'SEMI_FURNISHED', area: 1000, areaUnit: 'SQ_FT', monthlyRent: 32000,
  };
  const create = async (data: Record<string, unknown>) => {
    const result = await request.post(API + '/inventory', { headers, data: { ...property, ...data } });
    expect(result.status()).toBe(201);
    return result.json();
  };
  const existing = await create({ floor: 'Ground' });
  const available = await create({ floor: 'First', directoryMonth: inventoryMonth() });
  await page.goto('/');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/broker/inventory/new?survey=1&sector=Sector%2030');
  const house = page.getByLabel('House / plot no.', { exact: true });
  await house.fill(houseNo);
  await expect(page.getByText('First · Available Inventory', { exact: true })).toBeVisible();
  await expect(page.getByText('Ground · All Inventory', { exact: true })).toBeVisible();
  const availableLink = page.getByRole('link', { name: available.propertyCode, exact: true });
  await expect(availableLink).toBeVisible();
  const reopen = page.getByRole('button', { name: 'Return to Survey', exact: true });
  await expect(reopen).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept());
  await reopen.click();
  await expect(page.getByText('Ground · Survey', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: existing.propertyCode, exact: true })).toHaveAttribute('href', `/broker/inventory/${existing.id}`);
  await expect(house).toHaveValue(houseNo);
  await expect(reopen).toHaveCount(0);

  await page.goto('/broker/inventory?survey=1');
  await page.getByRole('button', { name: 'Add survey phone', exact: true }).click();
  const quick = page.getByRole('dialog', { name: 'Add survey phone', exact: true });
  await quick.getByLabel('Sector / locality', { exact: true }).fill('Sec-30');
  await quick.getByLabel('House / plot no.', { exact: true }).fill(houseNo);
  await expect(quick.getByText('Ground · Survey', { exact: true })).toBeVisible();
  await expect(quick.getByText('First · Available Inventory', { exact: true })).toBeVisible();
  const draft = await create({ survey: true, floor: 'Second', details: { possessionDate: '2026-11-27' } });
  await page.goto(`/broker/inventory/${draft.id}/edit`);
  await expect(page.getByText('First · Available Inventory', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: draft.propertyCode, exact: true })).toHaveCount(0);
  await page.goto('/broker/inventory?survey=1&sector=Sector%2030');
  await page.getByRole('button', { name: 'Advanced filters' }).click();
  const filters = page.locator('[role="dialog"]').filter({ hasText: 'Filter inventory' });
  await filters.getByRole('combobox', { name: 'Rooms', exact: true }).selectOption('3');
  const filtered = page.waitForResponse((response) => response.url().includes('/inventory?') &&
    ['folderMode=SURVEY', 'folderSector=Sector+30', 'bhk=3'].every((part) => response.url().includes(part)));
  await filters.getByRole('button', { name: 'Show results' }).click();
  expect((await filtered).ok()).toBe(true);
  await expect(page.getByRole('navigation', { name: 'Inventory folder path' }).getByText('Sector 30')).toBeVisible();
  await expect(page).toHaveURL(/survey=1/);
});

test('both client screens apply BHK and budget filters against the API', async ({ page, request }) => {
  const { session } = await createBrokerFixture(request);
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const requirement = { bedrooms: [3], minBudget: 30_000, maxBudget: 38_000 };
  for (const [index, name] of ['Matched client', 'Different rooms'].entries()) {
    const fields = { ...requirement, bedrooms: [index ? 2 : 3] };
    const lead = await request.post(API + '/leads', { headers, data: { name, phone: `981076543${index}`, requirement: fields } });
    expect(lead.status()).toBe(201);
    const separate = await request.post(API + '/broker-requirements', { headers, data: { contactName: name, intent: 'DEMAND', purpose: 'RENT', localityNames: ['Sector 30'], ...fields } });
    expect(separate.status()).toBe(201);
  }
  await page.addInitScript((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  for (const path of ['/broker/leads', '/broker/leads/requirements']) {
    await page.goto(path);
    await expect(page.getByText('Different rooms', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'BHK & budget', exact: true }).click();
    const dialog = page.locator('[role="dialog"]').filter({ hasText: 'BHK and budget filters' });
    await dialog.getByRole('combobox', { name: 'BHK', exact: true }).selectOption('3');
    await dialog.getByRole('spinbutton', { name: 'Minimum budget (₹)', exact: true }).fill('35000');
    await dialog.getByRole('spinbutton', { name: 'Maximum budget (₹)', exact: true }).fill('40000');
    await dialog.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByText('Matched client', { exact: true })).toBeVisible();
    await expect(page.getByText('Different rooms', { exact: true })).toHaveCount(0);
  }
});

test('scanner and chat exports are discoverable, private drafts survive reload and imports stay in review', async ({ page, request }, testInfo) => {
  const { session, password } = await createBrokerFixture(request);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker/inventory');
  await page.getByRole('link', { name: 'Scan property', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scanner & import', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Camera scan', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /WhatsApp export · TXT/ })).toBeVisible();
  const text = 'Sector 45, 2 BHK requirement, budget 20k. Contact 9899980802';
  await page.getByRole('button', { name: 'Requirements', exact: true }).click();
  await page.getByLabel('Original message', { exact: true }).fill(text);
  await expect(page.getByRole('status').filter({ hasText: 'Encrypted draft saved' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Original message', { exact: true })).toHaveValue(text);
  await expect(page.getByRole('button', { name: 'Requirements', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Persisted data is ciphertext, not the original contact text.
  const serialized = await page.evaluate(
    async () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('brokeriq-private-drafts');
        open.onsuccess = () => {
          const query = open.result.transaction('drafts').objectStore('drafts').getAll();
          query.onsuccess = () => resolve(JSON.stringify(query.result));
          query.onerror = () => reject(query.error);
        };
      }),
  );
  expect(serialized).not.toContain(text);
  await page.getByRole('button', { name: 'Save & extract for review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved sources', exact: true })).toBeVisible();
  expect((await request.get(API + '/inventory', { headers: { Authorization: `Bearer ${session.accessToken}` } })).status()).toBe(200);
  const rows = await (await request.get(API + '/inventory', { headers: { Authorization: `Bearer ${session.accessToken}` } })).json();
  expect(rows.total).toBe(0);
  await expect(page.getByRole('button', { name: 'Save & extract for review', exact: true })).toBeEnabled();
  await page.getByLabel('WhatsApp chat export files').setInputFiles({
    name: 'chat-export.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('[18/10/2026, 10:00:00] Fixture: Need 1 BHK in Sector 45, budget 15k, contact 9899980802'),
  });
  await expect(page.getByRole('link', { name: 'chat-export.txt', exact: true })).toBeVisible();
  // A populated source history must fit a phone, including timestamp + review badge.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Source history & review', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('button', { name: 'Product features & upcoming' })).toHaveCount(0);
  const navigation = page.getByRole('navigation', { name: 'Workspace navigation' });
  await navigation.getByRole('textbox', { name: 'Find a module or tool' }).fill('Campaigns');
  await expect(navigation.locator('[aria-disabled=true]').filter({ hasText: 'Campaigns' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('capture-catalog-desktop24.png'), fullPage: true });
  const customer = await (
    await request.post(API + '/auth/register', {
      data: { name: 'Catalog access fixture', email: `catalog.${Date.now()}@e2e.test`, password, accountType: 'USER' },
    })
  ).json();
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), customer);
  await page.goto('/user/account');
  await page.getByRole('button', { name: 'Product features & upcoming' }).click();
  await expect(page.locator('article[aria-disabled=true]').filter({ hasText: 'Campaigns' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Scanner · Inventory/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('rich inventory details remain usable at desktop and phone widths', async ({ page, request }, testInfo) => {
  const { session } = await createBrokerFixture(request);
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const created = await request.post(API + '/inventory', {
    headers,
    data: {
      houseNo: '24',
      sector: 'Sector 45',
      purpose: 'RENT',
      monthlyRent: 20000,
      floor: '0',
      bhk: 2,
      roomKind: 'BHK',
      propertyType: 'APARTMENT',
      availability: 'UNKNOWN',
      details: { securityMonths: 1, advanceMonths: 1, gatedSociety: false },
      notes: 'Private fixture note',
      contacts: [{ name: 'Fixture owner', phone: '9811100001', role: 'OWNER', note: 'Call before visiting' }],
    },
  });
  expect(created.status()).toBe(201);
  const item = await created.json();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker/inventory/' + item.id);
  const detail = page.getByRole('main');
  await expect(detail.getByText('Location & configuration', { exact: true })).toBeVisible();
  await expect(detail.getByText('Ground floor', { exact: true })).toBeVisible();
  await expect(detail.getByText('Gated society', { exact: true })).toBeVisible();
  await expect(detail.getByText('No', { exact: true })).toBeVisible();
  await expect(detail.getByText('Call before visiting', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('inventory-detail-desktop24.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(detail.getByText('Location & configuration', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('inventory-detail-phone24.png') });
  expect(errors).toEqual([]);
});

test('inventory edit returns through details to the selected custom folder and filters', async ({ page, request }) => {
  const { session } = await createBrokerFixture(request);
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const folderResponse = await request.post(API + '/inventory/folder-definitions', {
    headers, data: { kind: 'CUSTOM', label: 'Walkthrough folder' },
  });
  expect(folderResponse.status()).toBe(201);
  const folder = await folderResponse.json();
  const propertyResponse = await request.post(API + '/inventory', {
    headers, data: { houseNo: '241', sector: 'Sector 30', purpose: 'RENT', monthlyRent: 39000, customFolderId: folder.id },
  });
  expect(propertyResponse.status()).toBe(201);
  const property = await propertyResponse.json();
  const record = '/broker/inventory/' + property.id;
  await page.goto('/login');
  await page.evaluate((auth) => localStorage.setItem('biq.auth', JSON.stringify(auth)), session);
  await page.goto('/broker/inventory/data');
  const selectedFolder = page.getByLabel('Inventory folder');
  const search = page.getByRole('textbox', { name: 'Search inventory' });
  await selectedFolder.selectOption(folder.id);
  await search.fill(property.propertyCode);
  await page.getByText(property.propertyCode, { exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === record);
  await page.getByRole('button', { name: 'Edit property', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === record + '/edit');
  await page.getByRole('link', { name: 'Property details', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === record);
  await page.getByRole('link', { name: 'Inventory', exact: true }).last().click();
  await expect(page).toHaveURL((url) => url.pathname === '/broker/inventory/data');
  await expect(selectedFolder).toHaveValue(folder.id);
  await expect(search).toHaveValue(property.propertyCode);
});
