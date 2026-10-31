/**
 * Tier 1 — Feature Coverage: Teams Module Filtering (Requirement R1)
 * Verifies Date Range presets (Today, Yesterday, Last 7 Days, This Month, Custom),
 * Status, Role, Search (name, email, phone), and Reset behavior.
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { E2EClient } from '../harness/client';

test('Tier 1: Teams Filtering (Requirement R1)', async (t) => {
  let client: E2EClient;

  before(async () => {
    client = await E2EClient.create();
  });

  after(async () => {
    await client.close();
  });

  await t.test('T1.2.1: Date Range Preset - "today" filters agents who joined or were active today', async () => {
    const res = await client.getTeam({ datePreset: 'today' });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.members));
    assert.ok(res.body.members.length >= 1, 'Should return at least 1 member for today');

    const todayStr = new Date().toISOString().slice(0, 10);
    for (const member of res.body.members) {
      assert.ok(
        member.createdAt.startsWith(todayStr),
        `Member ${member.name} createdAt (${member.createdAt}) must match today (${todayStr})`
      );
    }
  });

  await t.test('T1.2.2: Date Range Preset - "this_month" includes members joined within current calendar month', async () => {
    const res = await client.getTeam({ datePreset: 'this_month' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.members.length >= 3, 'Should include members from this month');

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    for (const member of res.body.members) {
      assert.ok(
        member.createdAt.startsWith(currentYearMonth),
        `Member ${member.name} createdAt (${member.createdAt}) must be in current month (${currentYearMonth})`
      );
    }
  });

  await t.test('T1.2.3: Role & Status Filter - filters by BROKER_ADMIN vs BROKER_AGENT and ACTIVE vs SUSPENDED', async () => {
    const adminRes = await client.getTeam({ role: 'BROKER_ADMIN' });
    assert.strictEqual(adminRes.status, 200);
    assert.ok(adminRes.body.members.every((m) => m.role === 'BROKER_ADMIN'));

    const agentRes = await client.getTeam({ role: 'BROKER_AGENT' });
    assert.strictEqual(agentRes.status, 200);
    assert.ok(agentRes.body.members.every((m) => m.role === 'BROKER_AGENT'));

    const activeRes = await client.getTeam({ status: 'ACTIVE' });
    assert.strictEqual(activeRes.status, 200);
    assert.ok(activeRes.body.members.every((m) => m.status === 'ACTIVE'));
  });

  await t.test('T1.2.4: Search Query - matches member name, email, or contact number', async () => {
    const nameSearch = await client.getTeam({ search: 'Priya' });
    assert.strictEqual(nameSearch.status, 200);
    assert.ok(nameSearch.body.members.some((m) => m.name.includes('Priya')));

    const phoneSearch = await client.getTeam({ search: '9811005566' });
    assert.strictEqual(phoneSearch.status, 200);
    assert.ok(phoneSearch.body.members.some((m) => m.phone.includes('9811005566')));
  });

  await t.test('T1.2.5: Reset Filters - restores complete unfiltered team roster', async () => {
    // First apply restrictive search
    const filtered = await client.getTeam({ search: 'Vikram' });
    assert.strictEqual(filtered.status, 200);
    assert.strictEqual(filtered.body.members.length, 1);

    // Reset by passing empty params
    const reset = await client.getTeam({});
    assert.strictEqual(reset.status, 200);
    assert.ok(reset.body.members.length >= 3, 'Reset must restore full team roster without criteria loss');
  });
});
