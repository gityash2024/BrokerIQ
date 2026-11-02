import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RemindersService } from '../src/modules/automation/reminders.service';
import { NotificationsService } from '../src/core/notifications/notifications.service';
import { JobsService } from '../src/core/jobs/jobs.service';
import { AutomationService } from '../src/modules/automation/automation.service';
import { ModulesService } from '../src/core/features/modules.service';
import { LeadsService } from '../src/modules/leads/leads.service';

/** Real transactions/locks/outbox; no provider call, production fixture or simulator. */
describe('Production reminder delivery and current ownership', () => {
  let app: INestApplication, db: PrismaService, reminders: RemindersService, notifications: NotificationsService, jobs: JobsService;
  let org: string, admin: string, a: string, b: string, lead: string;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    db = app.get(PrismaService);
    reminders = app.get(RemindersService);
    notifications = app.get(NotificationsService);
    jobs = app.get(JobsService);
    org = (await db.organization.create({ data: { name: 'Isolated reminder firm', slug: 'reminders-' + uid } })).id;
    const member = async (suffix: string, role: 'BROKER_ADMIN' | 'BROKER_AGENT') =>
      (await db.user.create({ data: { name: suffix, email: suffix + uid + '@e2e.test', organizationId: org, role } })).id;
    admin = await member('admin', 'BROKER_ADMIN');
    a = await member('agent-a', 'BROKER_AGENT');
    b = await member('agent-b', 'BROKER_AGENT');
    lead = (await db.lead.create({ data: { organizationId: org, assignedToId: a, name: 'Isolated reminder client', phone: '+919700006601' } })).id;
  });
  afterAll(async () => {
    await app?.close();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  const followUp = (extra: Record<string, unknown> = {}) =>
    db.followUp.create({ data: { organizationId: org, leadId: lead, assignedToId: a, dueAt: new Date(Date.now() + 60_000), ...extra } });
  const claim = (job: { id: string }) => db.job.update({ where: { id: job.id }, data: { status: 'RUNNING', attempts: 1, lockedAt: new Date() } });
  const queued = async (recordId: string) =>
    db.job.findMany({ where: { type: 'automation.reminder-push', payload: { path: ['recordId'], equals: recordId } } });

  it('commits exactly one in-app row/outbox/marker under simultaneous scans', async () => {
    const task = await followUp();
    await Promise.all(Array.from({ length: 12 }, () => reminders.enqueueOne('FOLLOW_UP', task.id)));
    const outbox = await queued(task.id);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].maxAttempts).toBe(1);
    const p = outbox[0].payload as any;
    expect(await db.notification.count({ where: { id: p.notificationId, userId: a } })).toBe(1);
    expect((await db.followUp.findUniqueOrThrow({ where: { id: task.id } })).reminderSentAt?.toISOString()).toBe(p.claimedAt);
  });

  it('routes stale assignment to firm admins and excludes deleted leads/inactive firms', async () => {
    const stale = await db.lead.create({ data: { organizationId: org, assignedToId: b, name: 'New assignee', phone: '+919700006602' } });
    const task = await followUp({ leadId: stale.id });
    await reminders.enqueueOne('FOLLOW_UP', task.id);
    const outbox = await queued(task.id);
    expect(outbox).toHaveLength(1);
    const note = await db.notification.findUniqueOrThrow({ where: { id: (outbox[0].payload as any).notificationId } });
    expect(note.userId).toBe(admin);
    await db.lead.update({ where: { id: stale.id }, data: { deletedAt: new Date() } });
    const deleted = await followUp({ leadId: stale.id });
    await reminders.enqueueOne('FOLLOW_UP', deleted.id);
    expect(await queued(deleted.id)).toHaveLength(0);
    const inactive = await followUp();
    await db.organization.update({ where: { id: org }, data: { status: 'SUSPENDED' } });
    try {
      await reminders.enqueueOne('FOLLOW_UP', inactive.id);
      expect(await queued(inactive.id)).toHaveLength(0);
    } finally {
      await db.organization.update({ where: { id: org }, data: { status: 'ACTIVE' } });
    }
  });

  it('rolls back the notification and marker if durable enqueue fails', async () => {
    const task = await followUp();
    const fn = 'reminder_failure_' + uid;
    await db.$executeRawUnsafe(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload->>'recordId' = '${task.id}' THEN RAISE EXCEPTION 'Isolated reminder queue failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE INSERT ON "Job" FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
    try {
      await expect(reminders.enqueueOne('FOLLOW_UP', task.id)).rejects.toThrow('Isolated reminder queue failure');
      expect((await db.followUp.findUniqueOrThrow({ where: { id: task.id } })).reminderSentAt).toBeNull();
      expect(await db.notification.count({ where: { data: { path: ['recordId'], equals: task.id } } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER ${fn} ON "Job"`);
      await db.$executeRawUnsafe(`DROP FUNCTION ${fn}()`);
    }
    await reminders.enqueueOne('FOLLOW_UP', task.id);
    expect(await queued(task.id)).toHaveLength(1);
  });

  it('rechecks ownership, completion and rescheduling immediately before queued dispatch', async () => {
    const dispatch = jest.spyOn(notifications, 'dispatchSaved').mockResolvedValue();
    for (const change of ['reassign', 'complete', 'reschedule'] as const) {
      const task = await followUp();
      await reminders.enqueueOne('FOLLOW_UP', task.id);
      const [job] = await queued(task.id);
      if (change === 'reassign') await db.lead.update({ where: { id: lead }, data: { assignedToId: b } });
      else
        await db.followUp.update({
          where: { id: task.id },
          data: change === 'complete' ? { status: 'DONE' } : { dueAt: new Date(Date.now() + 86_400_000), reminderSentAt: null },
        });
      await reminders.deliver(job.payload);
      expect(dispatch).not.toHaveBeenCalled();
      expect(await db.notification.findUnique({ where: { id: (job.payload as any).notificationId } })).toBeNull();
      await db.lead.update({ where: { id: lead }, data: { assignedToId: a } });
    }
  });

  it('retains durable work across service restart and records uncertain push failure without retry', async () => {
    const task = await followUp();
    await reminders.enqueueOne('FOLLOW_UP', task.id);
    const [job] = await queued(task.id);
    const restarted = new RemindersService(db, jobs, notifications, app.get(ModulesService));
    restarted.onModuleInit();
    jest.spyOn(notifications, 'dispatchSaved').mockRejectedValue(new Error('Isolated provider outage'));
    await (jobs as any).execute(await claim(job));
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('FAILED');
    expect(await db.notification.findUnique({ where: { id: (job.payload as any).notificationId } })).not.toBeNull();
    await restarted.enqueueOne('FOLLOW_UP', task.id);
    expect(await queued(task.id)).toHaveLength(1);
  });

  it('keeps visit notification/automation work durable and suppresses cancelled visit dispatch', async () => {
    const visit = await db.siteVisit.create({ data: { organizationId: org, leadId: lead, assignedToId: a, scheduledAt: new Date(Date.now() + 600_000) } });
    await Promise.all([reminders.enqueueOne('VISIT', visit.id), reminders.enqueueOne('VISIT', visit.id)]);
    const [push] = await queued(visit.id);
    expect(push).toBeDefined();
    const triggers = await db.job.findMany({ where: { type: 'automation.visit-reminder', payload: { path: ['visitId'], equals: visit.id } } });
    expect(triggers).toHaveLength(1);
    const dispatch = jest.spyOn(notifications, 'dispatchSaved').mockResolvedValue();
    const trigger = jest.spyOn(app.get(AutomationService), 'trigger').mockResolvedValue();
    await db.siteVisit.update({ where: { id: visit.id }, data: { status: 'CANCELLED' } });
    await reminders.deliver(push.payload);
    await (jobs as any).execute(await claim(triggers[0]));
    expect(dispatch).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
  });

  it('records actual Expo HTTP rejection as failed instead of successful delivery', async () => {
    const task = await followUp();
    await reminders.enqueueOne('FOLLOW_UP', task.id);
    const [job] = await queued(task.id);
    const token = await db.pushToken.create({ data: { userId: a, platform: 'android', token: 'ExponentPushToken[isolated-' + uid + ']' } });
    const provider = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 429 } as Response);
    try {
      await (jobs as any).execute(await claim(job));
      expect(provider).toHaveBeenCalledTimes(1);
      const result = await db.job.findUniqueOrThrow({ where: { id: job.id } });
      expect(result.status).toBe('FAILED');
      expect(result.lastError).toContain('not fully accepted');
      expect(await db.notification.findUnique({ where: { id: (job.payload as any).notificationId } })).not.toBeNull();
    } finally {
      await db.pushToken.delete({ where: { id: token.id } });
    }
  });

  it.each([false, true])('renews staff reminders without repeating client outreach (legacy Build48 job: %s)', async (legacy) => {
    const visit = await db.siteVisit.create({ data: { organizationId: org, leadId: lead, assignedToId: a, scheduledAt: new Date(Date.now() + 600_000) } });
    await reminders.enqueueOne('VISIT', visit.id);
    if (legacy) {
      const original = await db.job.findFirstOrThrow({ where: { type: 'automation.visit-reminder', payload: { path: ['visitId'], equals: visit.id } } });
      const payload = { ...(original.payload as any) };
      delete payload.dueAt;
      await db.job.update({ where: { id: original.id }, data: { key: 'visit-reminder:' + visit.id + ':' + payload.claimedAt, payload } });
    }
    const [oldPush] = await queued(visit.id);
    const dispatch = jest.spyOn(notifications, 'dispatchSaved').mockResolvedValue();
    await app.get(LeadsService).assign(lead, b, null, { orgId: org });
    try {
      await reminders.enqueueOne('VISIT', visit.id);
      const pushes = await queued(visit.id);
      expect(pushes).toHaveLength(2);
      await reminders.deliver(oldPush.payload);
      expect(dispatch).not.toHaveBeenCalled();
      const current = pushes.find((j) => j.id !== oldPush.id)!;
      await reminders.deliver(current.payload);
      expect(dispatch).toHaveBeenCalledTimes(1);
      const sameSchedule = await db.job.findMany({ where: { type: 'automation.visit-reminder', payload: { path: ['visitId'], equals: visit.id } } });
      expect(sameSchedule).toHaveLength(1);
      const trigger = jest.spyOn(app.get(AutomationService), 'trigger').mockResolvedValue();
      await (jobs as any).execute(await claim(sameSchedule[0]));
      expect(trigger).toHaveBeenCalledWith('VISIT_REMINDER', org, lead, expect.objectContaining({ reminderScheduledAt: visit.scheduledAt.toISOString() }));
      const later = new Date(Date.now() + 1_200_000);
      await db.siteVisit.update({ where: { id: visit.id }, data: { scheduledAt: later, reminderSentAt: null } });
      await reminders.enqueueOne('VISIT', visit.id);
      expect(await db.job.count({ where: { type: 'automation.visit-reminder', payload: { path: ['visitId'], equals: visit.id } } })).toBe(2);
      trigger.mockRestore();
      const rule = await db.automationRule.create({
        data: {
          organizationId: org,
          name: 'Isolated delayed reminder',
          trigger: 'VISIT_REMINDER',
          conditions: {},
          actions: [{ type: 'ADD_TAG', delayMinutes: 1, params: { tag: 'must-not-apply' } }],
        },
      });
      await app
        .get(AutomationService)
        .runAction(rule.id, lead, 0, { visitId: visit.id, reminderScheduledAt: visit.scheduledAt.toISOString() }, 'isolated-old-schedule');
      expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).tags).not.toContain('must-not-apply');
      expect((await db.automationRun.findFirstOrThrow({ where: { ruleId: rule.id } })).status).toBe('SKIPPED');
    } finally {
      await app.get(LeadsService).assign(lead, a, null, { orgId: org });
    }
  });
});
