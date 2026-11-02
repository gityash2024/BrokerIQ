import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { brokerTeamResponseSchema } from '../team';

const member = {
  id: 'member',
  name: 'Contract fixture',
  email: null,
  phone: null,
  avatarUrl: null,
  role: 'BROKER_ADMIN',
  status: 'ACTIVE',
  lastLoginAt: null,
  createdAt: '2026-10-27T00:00:00Z',
};

test('team contract rejects the lightweight assignee shape that crashed both clients', () => {
  assert.equal(brokerTeamResponseSchema.safeParse({ members: [member] }).success, false);
  assert.equal(brokerTeamResponseSchema.safeParse({ members: [member], invites: [] }).success, false);
});
test('team contract accepts real zero stats and requires complete metrics', () => {
  assert.equal(
    brokerTeamResponseSchema.safeParse({ members: [{ ...member, stats: { openLeads: 0, won30d: 0, activities30d: 0 } }], invites: [] }).success,
    true,
  );
  assert.equal(
    brokerTeamResponseSchema.safeParse({ members: [{ ...member, stats: { openLeads: null, won30d: 0, activities30d: 0 } }], invites: [] }).success,
    false,
  );
});

test('all-firms hierarchy metadata survives strict client decoding without a first-firm default', () => {
  const value = brokerTeamResponseSchema.parse({
    organizationId: null,
    organizations: [
      { id: 'a', name: 'Firm A', status: 'ACTIVE' },
      { id: 'b', name: 'Firm B', status: 'SUSPENDED' },
    ],
    members: [],
    invites: [],
  });
  assert.equal(value.organizationId, null);
  assert.deepEqual(
    value.organizations?.map((f) => f.id),
    ['a', 'b'],
  );
});
