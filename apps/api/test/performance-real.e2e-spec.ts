import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Real targets, SLA and period performance', () => {
  let app: INestApplication, db: PrismaService, org: string, otherOrg: string;
  let a: { id: string; token: string }, b: { id: string; token: string }, admin: { id: string; token: string }, sa: { id: string; token: string };
  const stamp = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const h = (actor = a) => ({ Authorization: `Bearer ${actor.token}` });
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    org = (await db.organization.create({ data: { name: 'Performance fixture', slug: 'performance-' + stamp } })).id;
    otherOrg = (await db.organization.create({ data: { name: 'Other performance fixture', slug: 'other-performance-' + stamp } })).id;
    const actor = async (name: string, role: 'BROKER_AGENT' | 'BROKER_ADMIN' | 'SUPER_ADMIN', organizationId: string | null) => {
      const user = await db.user.create({
        data: { name, email: name + '.perf.' + stamp + '@e2e.test', role, organizationId },
        include: { organization: true },
      });
      return { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    a = await actor('A', 'BROKER_AGENT', org);
    b = await actor('B', 'BROKER_AGENT', org);
    admin = await actor('Admin', 'BROKER_ADMIN', org);
    sa = await actor('Platform', 'SUPER_ADMIN', null);
    await db.orgSetting.create({
      data: { organizationId: org, key: 'agent_targets', value: { [a.id]: { monthlyDeals: 0, monthlyLeads: 7, commissionPct: 0 } } },
    });
    let index = 0;
    const lead = async (minutesAgo: number, responseMinutes: number | null, won: boolean, owner = a) => {
      const createdAt = new Date(Date.now() - minutesAgo * 60_000);
      const row = await db.lead.create({
        data: {
          organizationId: org,
          name: 'Measured lead ' + ++index,
          phone: '+91970000900' + index,
          assignedToId: owner.id,
          createdAt,
          stage: won ? 'WON' : 'NEW',
          stageChangedAt: createdAt,
          firstResponseAt: responseMinutes == null ? null : new Date(createdAt.getTime() + responseMinutes * 60_000),
        },
      });
      if (won)
        await db.activity.create({ data: { organizationId: org, userId: owner.id, leadId: row.id, type: 'NOTE', content: 'Measured activity', createdAt } });
    };
    await lead(60, 10, true);
    await lead(120, 20, true);
    await lead(60, null, false);
    await lead(5, null, false);
    await lead(120 * 24 * 60, 10, true);
    await lead(60, 5, true, b);
  });
  afterAll(async () => {
    await app?.close();
  });
  it('uses saved targets including zero, real response timestamps and no fabricated target defaults', async () => {
    const data = (await http().get('/api/broker/dashboard/metrics?days=7').set(h()).expect(200)).body;
    const metric = (key: string) => data.metrics.find((item: any) => item.key === key);
    expect(metric('slaHealth').value).toBe('33%');
    expect(metric('targetLeads').value).toBe('4/7');
    expect(metric('targetDeals').value).toBe('No monthly target');
    const wonRows = (
      await http()
        .get('/api' + metric('wonDeals').href.replace('/broker/leads', '/leads'))
        .set(h())
        .expect(200)
    ).body;
    expect(wonRows.total).toBe(metric('wonDeals').value);
    const eligible = (
      await http()
        .get('/api' + metric('slaHealth').href.replace('/broker/leads', '/leads'))
        .set(h())
        .expect(200)
    ).body;
    expect(eligible.total).toBe(3);
    const unset = (await http().get('/api/broker/dashboard/metrics?days=7').set(h(b)).expect(200)).body;
    expect(unset.metrics.find((m: any) => m.key === 'targetDeals').value).toBe('Not set');
    const team = (await http().get('/api/broker/team').set(h(admin)).expect(200)).body;
    expect(team.members.find((m: any) => m.id === a.id).targets.monthlyDeals).toBe(0);
    expect(team.members.find((m: any) => m.id === b.id).targets.monthlyDeals).toBeUndefined();
  });
  it('counts actual period records instead of multiplying monthly totals and isolates Agent data', async () => {
    const month = (await http().get('/api/broker/performance?range=MONTH').set(h()).expect(200)).body;
    expect(month.scope).toBe('SELF');
    expect(month.items).toHaveLength(1);
    expect(month.items[0].id).toBe(a.id);
    expect(month.items[0].rank).toBeNull();
    expect(month.items[0].wonLeads).toBe(2);
    expect(month.items[0].monthlyFulfillment).toBeNull();
    const year = (await http().get('/api/broker/performance?range=YEAR').set(h()).expect(200)).body;
    expect(year.items[0].wonLeads).toBe(3);
    expect(year.items[0].activities).toBe(3);
    const team = (await http().get('/api/broker/performance?range=MONTH').set(h(admin)).expect(200)).body;
    expect(team.scope).toBe('FIRM');
    expect(team.items[0].id).toBe(a.id);
    expect(team.items[0].rank).toBe(1);
    await http().get('/api/broker/performance').query({ organizationId: otherOrg }).set(h(admin)).expect(403);
    await http().get('/api/broker/performance').query({ organizationId: otherOrg }).set(h()).expect(403);
    const all = (await http().get('/api/broker/performance?range=MONTH').set(h(sa)).expect(200)).body;
    expect(all.scope).toBe('ALL_FIRMS');
    expect(all.items.some((row: any) => row.id === a.id)).toBe(true);
  });
  it('rejects invalid/custom future dates and returns no measured SLA for an empty period', async () => {
    await http().get('/api/broker/performance?range=CUSTOM&from=2026-02-30&to=2026-03-02').set(h()).expect(400);
    await http().get('/api/broker/performance?range=CUSTOM&from=2099-01-01&to=2099-01-02').set(h()).expect(400);
    const empty = (await http().get('/api/broker/dashboard/metrics?from=2020-01-01&to=2020-01-02').set(h()).expect(200)).body;
    expect(empty.metrics.find((m: any) => m.key === 'slaHealth').value).toBeNull();
    await http().get('/api/leads?from=2026-02-30').set(h()).expect(400);
    const included = await db.lead.create({
      data: { organizationId: org, assignedToId: b.id, name: 'IST boundary included', phone: '+919700009101', createdAt: new Date('2026-10-31T19:00:00Z') },
    });
    const excluded = await db.lead.create({
      data: { organizationId: org, assignedToId: b.id, name: 'IST boundary excluded', phone: '+919700009102', createdAt: new Date('2026-10-31T18:29:59Z') },
    });
    const day = (await http().get('/api/leads?from=2026-11-01&to=2026-11-01').set(h(b)).expect(200)).body;
    expect(day.items.some((row: any) => row.id === included.id)).toBe(true);
    expect(day.items.some((row: any) => row.id === excluded.id)).toBe(false);
  });
});
