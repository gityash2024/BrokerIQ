import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type Notification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SettingsService } from '../settings/settings.service';
import { WebPushService } from './web-push.service';

export interface NotifyInput {
  kind: string;
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
  push?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly settings: SettingsService,
    private readonly webPush: WebPushService,
  ) {}

  /** Legacy reminders may only carry a lead URL; current database ownership wins. */
  async hiddenLeadNotifications(userId: string) {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT n.id FROM "Notification" n
      LEFT JOIN "Lead" l ON l.id = COALESCE(NULLIF(n.data->>'leadId', ''), substring(n.link from '^/broker/leads/([^/?#]+)'))
      JOIN "User" u ON u.id = n."userId"
      WHERE n."userId"=${userId}
        AND COALESCE(NULLIF(n.data->>'leadId', ''), substring(n.link from '^/broker/leads/([^/?#]+)')) IS NOT NULL
        AND NOT COALESCE((l.id IS NOT NULL AND l."deletedAt" IS NULL AND (
          u.role='SUPER_ADMIN' OR (u."organizationId"=l."organizationId" AND
          (u.role='BROKER_ADMIN' OR (u.role='BROKER_AGENT' AND l."assignedToId"=u.id))))), FALSE)`);
    return rows.map((row) => row.id);
  }

  async notify(userIds: string | string[], input: NotifyInput, opts: { excludeUserId?: string } = {}) {
    let ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
    if (opts.excludeUserId) ids = ids.filter((id) => id !== opts.excludeUserId);
    if (!ids.length) return;
    const leadId = typeof input.data?.leadId === 'string' ? input.data.leadId : /^\/broker\/leads\/([^/?#]+)/.exec(input.link ?? '')?.[1];
    const lead = leadId
      ? await this.prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { organizationId: true, assignedToId: true } })
      : null;
    if (leadId && !lead) return;
    ids = (
      await this.prisma.user.findMany({
        where: {
          id: { in: ids },
          status: 'ACTIVE',
          deletedAt: null,
          ...(lead
            ? {
                OR: [
                  { role: 'SUPER_ADMIN' },
                  { role: 'BROKER_ADMIN', organizationId: lead.organizationId },
                  { role: 'BROKER_AGENT', organizationId: lead.organizationId, id: lead.assignedToId ?? '' },
                ],
              }
            : {}),
        },
        select: { id: true },
      })
    ).map((u) => u.id);
    if (!ids.length) return;
    const notes = await this.prisma.notification.createManyAndReturn({
      data: ids.map((userId) => ({
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        link: input.link,
        data: input.data as Prisma.InputJsonValue,
      })),
    });
    const common = { ...input.data, link: input.link, kind: input.kind };
    const recipients = Object.fromEntries(notes.map((note) => [note.userId, { notificationId: note.id, recipientUserId: note.userId }]));
    for (const note of notes) {
      const data = { ...common, ...recipients[note.userId] };
      this.realtime.toUser(note.userId, 'notification', { ...data, title: input.title, body: input.body });
    }
    if (input.push !== false) {
      await this.push(ids, input.title, input.body ?? '', common, recipients);
      await this.webPush.send(ids, input.title, input.body ?? '', common, recipients).catch((e) => this.logger.warn(`web push: ${(e as Error).message}`));
    }
  }

  async notifyOrg(orgId: string, input: NotifyInput, opts: { adminsOnly?: boolean; include?: string[]; excludeUserId?: string } = {}) {
    const members = await this.prisma.user.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null, ...(opts.adminsOnly ? { role: 'BROKER_ADMIN' } : {}) },
      select: { id: true },
    });
    const ids = members.map((m) => m.id).filter((id) => !opts.excludeUserId || id !== opts.excludeUserId);
    await this.notify([...ids, ...(opts.include ?? [])], input, { excludeUserId: opts.excludeUserId });
  }

  /** Dispatch a previously committed outbox notification without inserting it again. */
  async dispatchSaved(note: Notification) {
    const common = { ...((note.data as Record<string, unknown>) ?? {}), link: note.link, kind: note.kind };
    const recipients = { [note.userId]: { notificationId: note.id, recipientUserId: note.userId } };
    this.realtime.toUser(note.userId, 'notification', { ...common, ...recipients[note.userId], title: note.title, body: note.body });
    const deliveries = await Promise.allSettled([
      this.push([note.userId], note.title, note.body ?? '', common, recipients, true),
      this.webPush.send([note.userId], note.title, note.body ?? '', common, recipients, true),
    ]);
    if (deliveries.some((result) => result.status === 'rejected'))
      throw new Error('Reminder push was not fully accepted; in-app notification retained. Inspect delivery before retrying.');
  }

  /** Expo push (free). Tokens that Expo reports as invalid are removed. */
  async push(
    userIds: string[],
    title: string,
    body: string,
    data: Record<string, unknown> = {},
    recipients: Record<string, { notificationId: string; recipientUserId: string }> = {},
    throwOnFailure = false,
  ) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId: { in: userIds } } });
    const expo = tokens.filter((t) => t.token.startsWith('ExponentPushToken') || t.token.startsWith('ExpoPushToken'));
    if (!expo.length) return;
    // Deduplicate tokens so the same device never receives duplicate notifications
    const uniqueTokens = [...new Map(expo.map((t) => [t.token, t])).values()];
    const cfg = await this.settings.resolve('expo_push');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (cfg?.accessToken) headers.Authorization = `Bearer ${cfg.accessToken}`;
    for (let i = 0; i < uniqueTokens.length; i += 100) {
      const chunk = uniqueTokens.slice(i, i + 100);
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify(
            chunk.map((t) => ({
              to: t.token,
              title,
              body,
              data: { ...data, ...recipients[t.userId] },
              sound: 'default',
              priority: 'high',
              channelId: 'default',
            })),
          ),
        });
        if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);
        const json: any = await res.json().catch(() => ({}));
        const tickets: any[] = json?.data ?? [];
        const dead = tickets.map((t, idx) => (t?.details?.error === 'DeviceNotRegistered' ? chunk[idx]?.token : null)).filter(Boolean) as string[];
        if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
        if (throwOnFailure && (tickets.length !== chunk.length || tickets.some((t) => t.status !== 'ok' && t?.details?.error !== 'DeviceNotRegistered')))
          throw new Error('Expo push did not accept every valid token');
      } catch (e) {
        this.logger.warn(`push failed: ${(e as Error).message}`);
        if (throwOnFailure) throw e;
      }
    }
  }
}
