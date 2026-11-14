import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { API, createBrokerFixture } from './fixtures';

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
  await page.goto('/broker/inventory');
  await page.getByRole('button', { name: 'Card view', exact: true }).click();
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Apartment 62' }) })
    .getByRole('button', { name: 'Details →' })
    .click();
  let dialog = page.getByRole('dialog');
  const savedPhoto = page.waitForResponse((r) => r.url().endsWith('/inventory/' + item.id) && r.request().method() === 'PATCH' && r.ok());
  await dialog.locator('input[type=file]').setInputFiles(imageFile);
  await savedPhoto;
  await expect(dialog.getByAltText('Property photograph 2')).toBeVisible();
  const saved = await (await request.get(API + '/inventory/' + item.id, { headers })).json();
  expect(saved.photoUrls).toHaveLength(2);
  const image = await request.get(saved.photoUrls[1]);
  expect(image.ok()).toBe(true);
  expect(image.headers()['content-type']).toContain('image/');
  await dialog.getByRole('button', { name: 'Prepare WhatsApp message' }).click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Prepare property message' });
  await dialog.getByRole('button', { name: 'Client Sharing Pitch' }).click();
  await dialog.getByPlaceholder('Lead का नाम या phone लिखें…').fill('Isolated photo workflow');
  await dialog.getByRole('button', { name: /Isolated photo workflow recipient/ }).click();
  await dialog.getByLabel('Include property photo links').check();
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
  expect(draft.text).toContain(photo);
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
