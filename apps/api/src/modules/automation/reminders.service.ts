import { createHash } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { ModulesService } from '../../core/features/modules.service';

type ReminderKind = 'FOLLOW_UP' | 'VISIT';
const deliverySchema = z.object({
  orgId: z.string(),
  notificationId: z.string(),
  leadId: z.string(),
  recordId: z.string(),
  recordType: z.enum(['FOLLOW_UP', 'VISIT']),
  claimedAt: z.string().datetime(),
  dueAt: z.string().datetime(),
});

/** Build48 recorded a claim key; recover its exact schedule from its push outbox. */
export async function legacyVisitReminderSchedule(db: Pick<Prisma.TransactionClient, 'job'>, visitId: string, claim: string): Promise<string | null> {
  const job = await db.job.findFirst({
    where: {
      type: 'automation.reminder-push',
      AND: [
        { payload: { path: ['recordId'], equals: visitId } },
        { payload: { path: ['recordType'], equals: 'VISIT' } },
        { payload: { path: ['claimedAt'], equals: claim } },
      ],
    },
    select: { payload: true },
  });
  const parsed = z.object({ dueAt: z.string().datetime() }).safeParse(job?.payload);
  return parsed.success ? parsed.data.dueAt : null;
}

/** The in-app reminder, marker and single-attempt push outbox commit together. */
@Injectable()
export class RemindersService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
    private readonly modules: ModulesService,
  ) {}

  onModuleInit() {
    this.jobs.register('automation.reminder-push', (payload) => this.deliver(payload));
  }

  async enqueueDue(kind: ReminderKind, now = new Date()) {
    const candidates =
      kind === 'FOLLOW_UP'
        ? await this.db.followUp.findMany({
            where: { status: 'PENDING', reminderSentAt: null, dueAt: { lte: new Date(+now + 600_000) } },
            orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
            take: 200,
            select: { id: true },
          })
        : await this.db.siteVisit.findMany({
            where: { status: { in: ['SCHEDULED', 'CONFIRMED'] }, reminderSentAt: null, scheduledAt: { gte: now, lte: new Date(+now + 3_600_000) } },
            orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
            take: 200,
            select: { id: true },
          });
    for (const row of candidates) await this.enqueueOne(kind, row.id, now);
  }

  async enqueueOne(kind: ReminderKind, id: string, now = new Date()) {
    return this.db.$transaction(async (tx) => {
      const initial = kind === 'FOLLOW_UP' ? await tx.followUp.findUnique({ where: { id } }) : await tx.siteVisit.findUnique({ where: { id } });
      if (!initial) return;
      // Same lock order as lead reassignment and task mutation: Lead, then task.
      await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${initial.leadId} FOR UPDATE`;
      if (kind === 'FOLLOW_UP') await tx.$queryRaw`SELECT id FROM "FollowUp" WHERE id=${id} FOR UPDATE`;
      else await tx.$queryRaw`SELECT id FROM "SiteVisit" WHERE id=${id} FOR UPDATE`;
      const followUp = kind === 'FOLLOW_UP' ? await tx.followUp.findUnique({ where: { id } }) : null;
      const visit = kind === 'VISIT' ? await tx.siteVisit.findUnique({ where: { id } }) : null;
      const task = followUp ?? visit;
      if (!task || task.reminderSentAt || (followUp ? followUp.status !== 'PENDING' : !['SCHEDULED', 'CONFIRMED'].includes(visit!.status))) return;
      const dueAt = followUp?.dueAt ?? visit!.scheduledAt;
      if (dueAt > new Date(+now + (followUp ? 600_000 : 3_600_000)) || (!followUp && dueAt < now)) return;
      const lead = await tx.lead.findFirst({
        where: { id: task.leadId, organizationId: task.organizationId, deletedAt: null, organization: { status: 'ACTIVE' } },
      });
      const mark = async () => {
        if (followUp) await tx.followUp.update({ where: { id }, data: { reminderSentAt: now } });
        else await tx.siteVisit.update({ where: { id }, data: { reminderSentAt: now } });
      };
      // Retire ancient follow-ups without continually filling the first page.
      if (!lead || (followUp && dueAt < new Date(+now - 6 * 3_600_000))) {
        await mark();
        return;
      }
      const wanted = task.assignedToId ?? lead.assignedToId;
      const member = wanted
        ? await tx.user.findFirst({
            where: {
              id: wanted,
              organizationId: lead.organizationId,
              status: 'ACTIVE',
              deletedAt: null,
              OR: [{ role: 'BROKER_ADMIN' }, { role: 'BROKER_AGENT', id: lead.assignedToId ?? '' }],
            },
            select: { id: true },
          })
        : null;
      const recipients = member
        ? [member]
        : await tx.user.findMany({
            where: { organizationId: lead.organizationId, role: 'BROKER_ADMIN', status: 'ACTIVE', deletedAt: null },
            select: { id: true },
          });
      // No eligible recipient yet: preserve the pending reminder for a later scan.
      if (!recipients.length) return;
      for (const recipient of recipients) {
        const digest = createHash('sha256').update([kind, id, task.updatedAt.toISOString(), dueAt.toISOString(), recipient.id].join(':')).digest('hex');
        const notificationId = 'rem_' + digest.slice(0, 40);
        const payload = {
          orgId: lead.organizationId,
          notificationId,
          leadId: lead.id,
          recordId: id,
          recordType: kind,
          claimedAt: now.toISOString(),
          dueAt: dueAt.toISOString(),
        };
        await tx.notification.create({
          data: {
            id: notificationId,
            userId: recipient.id,
            kind: followUp ? 'FOLLOW_UP_DUE' : 'VISIT_REMINDER',
            title: followUp
              ? `⏰ Follow-up: ${lead.name}`
              : visit!.mode === 'VIDEO'
                ? `🎥 Video visit 1 घंटे में: ${lead.name}`
                : `🏠 Site visit 1 घंटे में: ${lead.name}`,
            body: followUp
              ? `${followUp.type}${followUp.note ? ' — ' + followUp.note : ''}`
              : visit!.meetingUrl
                ? `Video call: ${visit!.meetingUrl}`
                : (visit!.address ?? ''),
            link: `/broker/leads/${lead.id}`,
            data: payload as Prisma.InputJsonValue,
          },
        });
        // A provider may have accepted a push before a process crashes: never
        // silently resend that uncertain attempt. The in-app reminder survives.
        await tx.job.create({ data: { type: 'automation.reminder-push', key: notificationId, payload: payload as Prisma.InputJsonValue, maxAttempts: 1 } });
      }
      let legacySameSchedule = false;
      if (visit) {
        const previous = await tx.job.findMany({
          where: { type: 'automation.visit-reminder', payload: { path: ['visitId'], equals: id } },
          select: { payload: true },
        });
        for (const job of previous) {
          const p = job.payload as Record<string, unknown>;
          if (!p.dueAt && typeof p.claimedAt === 'string' && (await legacyVisitReminderSchedule(tx, id, p.claimedAt)) === visit.scheduledAt.toISOString())
            legacySameSchedule = true;
        }
      }
      if (visit && !legacySameSchedule)
        await tx.job.createMany({
          skipDuplicates: true,
          data: [
            {
              type: 'automation.visit-reminder',
              key: 'visit-reminder:' + id + ':' + visit.scheduledAt.toISOString(),
              payload: { orgId: lead.organizationId, leadId: lead.id, visitId: id, claimedAt: now.toISOString(), dueAt: visit.scheduledAt.toISOString() },
              maxAttempts: 5,
            },
          ],
        });
      await mark();
    });
  }

  async deliver(raw: unknown) {
    const p = deliverySchema.parse(raw);
    const note = await this.db.notification.findUnique({ where: { id: p.notificationId }, include: { user: true } });
    if (!note) return;
    const task =
      p.recordType === 'FOLLOW_UP'
        ? await this.db.followUp.findUnique({ where: { id: p.recordId } })
        : await this.db.siteVisit.findUnique({ where: { id: p.recordId } });
    const lead = await this.db.lead.findFirst({ where: { id: p.leadId, organizationId: p.orgId, deletedAt: null, organization: { status: 'ACTIVE' } } });
    const u = note.user;
    const liveTask =
      task &&
      task.organizationId === p.orgId &&
      task.leadId === p.leadId &&
      task.reminderSentAt?.toISOString() === p.claimedAt &&
      ('dueAt' in task
        ? task.status === 'PENDING' && task.dueAt.toISOString() === p.dueAt
        : ['SCHEDULED', 'CONFIRMED'].includes(task.status) && task.scheduledAt.toISOString() === p.dueAt);
    const allowed =
      liveTask &&
      lead &&
      u.organizationId === p.orgId &&
      u.status === 'ACTIVE' &&
      !u.deletedAt &&
      (u.role === 'BROKER_ADMIN' || (u.role === 'BROKER_AGENT' && lead.assignedToId === u.id && (task.assignedToId ?? lead.assignedToId) === u.id));
    if (!allowed) {
      await this.db.notification.deleteMany({ where: { id: note.id } });
      return;
    }
    if (!(await this.modules.enabled('automation')) || !(await this.modules.enabled('leads'))) return;
    await this.notifications.dispatchSaved(note);
  }
}
