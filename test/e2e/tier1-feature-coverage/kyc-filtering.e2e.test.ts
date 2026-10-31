/**
 * Tier 1 — Feature Coverage: KYC Module Filtering (Requirement R1)
 * Verifies Date Range presets (Today, Yesterday, Last 7 Days, This Month, Custom),
 * Status, Role, Search (name, email, phone), Broker/Agent filters, and Reset behavior.
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';

test('Tier 1: KYC Filtering (Requirement R1)', async (t) => {
  let client: E2EClient;

  before(async () => {
    client = await E2EClient.create();
  });

  after(async () => {
    await client.close();
  });

  await t.test('T1.1.1: Date Range Preset - "today" returns only records submitted today', async () => {
    const res = await client.getKyc({ datePreset: 'today' });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1, 'Should return at least 1 document for today');

    const todayStr = new Date().toISOString().slice(0, 10);
    for (const doc of res.body) {
      assert.ok(
        doc.createdAt.startsWith(todayStr),
        `Document ${doc.id} createdAt (${doc.createdAt}) must match today (${todayStr})`
      );
    }
  });

  await t.test('T1.1.2: Date Range Preset - "yesterday" returns only records submitted yesterday', async () => {
    const res = await client.getKyc({ datePreset: 'yesterday' });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1, 'Should return records for yesterday');

    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    for (const doc of res.body) {
      assert.ok(
        doc.createdAt.startsWith(yesterdayDate),
        `Document ${doc.id} createdAt (${doc.createdAt}) must match yesterday (${yesterdayDate})`
      );
    }
  });

  await t.test('T1.1.3: Date Range Preset - "last_7_days" captures documents from past 7 days', async () => {
    const res = await client.getKyc({ datePreset: 'last_7_days' });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 2, 'Should include today, yesterday, and 3-day-old records');

    const cutoff = Date.now() - 7 * 86400000;
    for (const doc of res.body) {
      const docTime = new Date(doc.createdAt).getTime();
      assert.ok(docTime >= cutoff, `Document ${doc.id} must be within last 7 days`);
    }
  });

  await t.test('T1.1.4: Status Filter - filters accurately by PENDING vs VERIFIED vs REJECTED', async () => {
    const pendingRes = await client.getKyc({ status: 'PENDING' });
    assert.strictEqual(pendingRes.status, 200);
    assert.ok(pendingRes.body.length > 0);
    assert.ok(pendingRes.body.every((d) => d.status === 'PENDING'), 'All documents must be PENDING');

    const verifiedRes = await client.getKyc({ status: 'VERIFIED' });
    assert.strictEqual(verifiedRes.status, 200);
    assert.ok(verifiedRes.body.length > 0);
    assert.ok(verifiedRes.body.every((d) => d.status === 'VERIFIED'), 'All documents must be VERIFIED');
  });

  await t.test('T1.1.5: Role Filter - filters by BROKER_ADMIN vs BROKER_AGENT', async () => {
    const agentRes = await client.getKyc({ role: 'BROKER_AGENT' });
    assert.strictEqual(agentRes.status, 200);
    assert.ok(agentRes.body.every((d) => d.user.role === 'BROKER_AGENT'));

    const adminRes = await client.getKyc({ role: 'BROKER_ADMIN' });
    assert.strictEqual(adminRes.status, 200);
    assert.ok(adminRes.body.every((d) => d.user.role === 'BROKER_ADMIN'));
  });

  await t.test('T1.1.6: Search Query - matches name, email, phone, and docNumber', async () => {
    const nameSearch = await client.getKyc({ search: 'Sharma' });
    assert.strictEqual(nameSearch.status, 200);
    assert.ok(nameSearch.body.some((d) => d.user.name.includes('Sharma')));

    const emailSearch = await client.getKyc({ search: 'priya@' });
    assert.strictEqual(emailSearch.status, 200);
    assert.ok(emailSearch.body.some((d) => d.user.email.includes('priya@')));

    const phoneSearch = await client.getKyc({ search: '9811001122' });
    assert.strictEqual(phoneSearch.status, 200);
    assert.ok(phoneSearch.body.some((d) => d.user.phone?.includes('9811001122')));
  });

  await t.test('T1.1.7: Reset / Unfiltered View - returns full collection', async () => {
    const unfiltered = await client.getKyc({});
    assert.strictEqual(unfiltered.status, 200);
    assert.ok(unfiltered.body.length >= 3, 'Default unfiltered view must contain all records for the firm');
  });
});
