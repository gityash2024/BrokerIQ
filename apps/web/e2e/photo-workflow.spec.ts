import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { inventoryMonth } from '@brokeriq/shared';
import { API, createBrokerFixture } from './fixtures';

test('an empty property gallery offers normal upload and saves reviewed video frames', async ({ page, request }) => {
  test.setTimeout(95_000);
  const folder = mkdtempSync(resolve(tmpdir(), 'brokeriq-browser-video-'));
  const file = resolve(folder, 'walkthrough.mp4');
  try {
    execFileSync(process.env.PROPERTY_VIDEO_FFMPEG ?? 'ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=duration=2:size=320x240:rate=10', '-an', '-c:v', 'mpeg4', file,
    ]);
    const { session } = await createBrokerFixture(request);
    const headers = { Authorization: 'Bearer ' + session.accessToken };
    const response = await request.post(API + '/inventory', {
      headers, data: { houseNo: 'Video test', sector: 'Sector 45', purpose: 'RENT', propertyType: 'APARTMENT', availability: 'UNKNOWN' },
    });
    expect(response.status()).toBe(201);
    const item = await response.json();
    await page.goto('/');
    await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
    await page.goto('/broker/inventory/' + item.id);
    await expect(page.getByRole('button', { name: 'Upload photos', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Extract photos from video', exact: true })).toBeEnabled();
    await page.getByLabel('Select a video for property photos').setInputFiles(file);
    const review = page.getByLabel('Review extracted property photos');
    await expect(review.getByRole('checkbox').first()).toBeVisible({ timeout: 60_000 });
    for (const box of (await review.getByRole('checkbox').all()).slice(1)) await box.uncheck();
    const attached = page.waitForResponse((r) => r.url().endsWith(`/inventory/${item.id}/photos`) && r.request().method() === 'PATCH' && r.ok());
    await review.getByRole('button', { name: 'Add selected photos' }).click();
    const result = await attached;
    expect(result.request().postDataJSON().urls).toHaveLength(1);
    await expect(review).toHaveCount(0);
    const saved = await (await request.get(API + '/inventory/' + item.id, { headers })).json();
    expect(saved.photoUrls).toHaveLength(1);
    expect(saved.videoUrls ?? []).toHaveLength(0);
    await expect(page.getByRole('button', { name: 'Upload photos', exact: true })).toBeEnabled();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('WhatsApp Share property marks shareable photos before choosing a property', async ({ page, request }) => {
  const { session } = await createBrokerFixture(request);
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const { PrismaClient } = createRequire(resolve(__dirname, '../../api/package.json'))('@prisma/client');
  const db = new PrismaClient();
  let conversationId: string;
  try {
    const organizationId = session.user.organization!.id;
    const lead = await db.lead.create({ data: { organizationId, name: 'Isolated sharing recipient', phone: '+919811100063', source: 'HOUSING' } });
    const conversation = await db.conversation.create({ data: {
      organizationId, leadId: lead.id, channel: 'WHATSAPP', contactKey: '919811100063', contactPhone: '+919811100063',
    } });
    conversationId = conversation.id;
  } finally {
    await db.$disconnect();
  }
  const property = {
    sector: 'Sector 45', purpose: 'RENT', category: 'RESIDENTIAL', propertyType: 'APARTMENT',
    roomKind: 'BHK', bhk: 2, area: 1100, areaUnit: 'SQ_FT', monthlyRent: 26000, furnishing: 'SEMI_FURNISHED',
    directoryMonth: inventoryMonth(),
  };
  for (const [houseNo, photoUrls] of [['Photo picker A', ['https://example.test/property-a.jpg']], ['Photo picker B', []]] as const) {
    const response = await request.post(API + '/inventory', { headers, data: { ...property, houseNo, photoUrls } });
    expect(response.status()).toBe(201);
  }
  await page.goto('/');
  await page.evaluate((value) => localStorage.setItem('biq.auth', JSON.stringify(value)), session);
  await page.goto('/broker/inbox?channel=WHATSAPP&c=' + conversationId);
  await page.getByRole('button', { name: 'Share property', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share property', exact: true });
  const withPhotos = dialog.getByRole('button', { name: /Photo picker A/ });
  const withoutPhotos = dialog.getByRole('button', { name: /Photo picker B/ });
  await expect(withPhotos).toContainText('· Photos');
  await expect(withoutPhotos).not.toContainText('· Photos');
  await withPhotos.click();
  await expect(dialog.getByText(/AVAILABLE · Photos/)).toBeVisible();
});

test('property upload persists and photo links enter the lead draft, then avatar upload persists', async ({ page, request }) => {
  test.setTimeout(90_000);
  const { session } = await createBrokerFixture(request);
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const photo = 'https://brokeriq.mymultimeds.com/directory/essel-towers-commons.jpg';
  const imageFile = resolve('public/directory/essel-towers-commons.jpg');
  const created = await request.post(API + '/inventory', {
    headers,
    data: { houseNo: '62', sector: 'Sector 45', purpose: 'RENT', monthlyRent: 20000, propertyType: 'APARTMENT', availability: 'UNKNOWN', photoUrls: [photo] },
  });
  expect(created.status(), await created.text()).toBe(201);
  const item = await created.json();
  const lead = await request.post(API + '/leads', {
    headers,
    data: { name: 'Isolated photo workflow recipient', phone: '9811100062' },
  });
  expect(lead.status()).toBe(201);
  const leadId = (await lead.json()).id;
  await page.goto('/');
  await page.evaluate((s) => localStorage.setItem('biq.auth', JSON.stringify(s)), session);
  await page.goto('/broker/inventory/' + item.id);
  const savedPhoto = page.waitForResponse((r) => r.url().endsWith('/inventory/' + item.id + '/photos') && r.request().method() === 'PATCH' && r.ok());
  await page.getByLabel('Select photo files').setInputFiles(imageFile);
  await savedPhoto;
  await expect(page.getByAltText('Property photo 2')).toBeVisible();
  const saved = await (await request.get(API + '/inventory/' + item.id, { headers })).json();
  expect(saved.photoUrls).toHaveLength(2);
  const image = await request.get(saved.photoUrls[1]);
  expect(image.ok()).toBe(true);
  expect(image.headers()['content-type']).toContain('image/');
  await page.getByRole('button', { name: 'Share property', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Prepare property message' });
  await dialog.getByRole('button', { name: 'Client Sharing Pitch' }).click();
  await dialog.getByPlaceholder('Lead का नाम या phone लिखें…').fill('Isolated photo workflow');
  await dialog.getByRole('button', { name: /Isolated photo workflow recipient/ }).click();
  await dialog.getByLabel('Include photo gallery link').check();
  await dialog.getByRole('button', { name: 'Email', exact: true }).click();
  await dialog.getByRole('button', { name: 'Open Email Inbox', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/broker/inbox\\?lead=' + leadId + '&channel=EMAIL$'));
  await expect(page.getByRole('link', { name: 'अभी जोड़ें →', exact: true })).toBeVisible();
  const draft = await page.evaluate(
    async ({ leadId, user }) => {
      const namespace = 'scope:' + JSON.stringify([user.id, user.role, user.organization?.id ?? '']);
      const storageKey = namespace + ':inbox:lead:EMAIL:' + leadId;
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('brokeriq-private-drafts', 1);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      try {
        const read = <T>(store: string, key: string) =>
          new Promise<T>((resolve, reject) => {
            const request = database.transaction(store).objectStore(store).get(key);
            request.onsuccess = () => resolve(request.result as T);
            request.onerror = () => reject(request.error);
          });
        const [sealed, key] = await Promise.all([
          read<{ iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer }>('drafts', storageKey),
          read<CryptoKey>('keys', namespace),
        ]);
        const decoded = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: sealed.iv,
            additionalData: new TextEncoder().encode(storageKey),
          },
          key,
          sealed.ciphertext,
        );
        return { text: JSON.parse(new TextDecoder().decode(decoded)) as string, extractable: key.extractable };
      } finally {
        database.close();
      }
    },
    { leadId, user: session.user },
  );
  expect(draft.text).toMatch(/\/photos\/[a-f0-9]{48}/);
  expect(draft.extractable).toBe(false);
  expect(page.url()).not.toContain('Property photos');
  await page.goto('/broker/settings');
  await page.getByRole('button', { name: 'मेरा account', exact: true }).click();
  const avatarSaved = page.waitForResponse((r) => r.url().endsWith('/me') && r.request().method() === 'PATCH' && r.ok());
  await page.locator('input[type=file]').setInputFiles(imageFile);
  await avatarSaved;
  const profile = await request.get(API + '/auth/me', { headers });
  expect(profile.ok()).toBe(true);
  const current = await profile.json();
  expect(current.avatarUrl).toContain('/api/media/f/avatar/');
});
