import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  async notify(userIds: string | string[], input: NotifyInput, opts: { excludeUserId?: string } = {}) {
    let ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
    if (opts.excludeUserId) ids = ids.filter((id) => id !== opts.excludeUserId);
    if (!ids.length) return;
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        link: input.link,
        data: input.data as Prisma.InputJsonValue,
      })),
    });
    for (const id of ids) this.realtime.toUser(id, 'notification', { kind: input.kind, title: input.title, body: input.body, link: input.link });
    if (input.push !== false) {
      await this.push(ids, input.title, input.body ?? '', { link: input.link, kind: input.kind, ...input.data });
      await this.webPush
        .send(ids, input.title, input.body ?? '', { link: input.link, kind: input.kind })
        .catch((e) => this.logger.warn(`web push: ${(e as Error).message}`));
    }
  }

  async notifyOrg(orgId: string, input: NotifyInput, opts: { adminsOnly?: boolean; include?: string[]; excludeUserId?: string } = {}) {
    const members = await this.prisma.user.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', ...(opts.adminsOnly ? { role: 'BROKER_ADMIN' } : {}) },
      select: { id: true },
    });
    const ids = members.map((m) => m.id).filter((id) => !opts.excludeUserId || id !== opts.excludeUserId);
    await this.notify([...ids, ...(opts.include ?? [])], input);
  }

  /** Expo push (free). Tokens that Expo reports as invalid are removed. */
  async push(userIds: string[], title: string, body: string, data: Record<string, unknown> = {}) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId: { in: userIds } } });
    const expo = tokens.filter((t) => t.token.startsWith('ExponentPushToken') || t.token.startsWith('ExpoPushToken'));
    if (!expo.length) return;
    // Deduplicate tokens so the same device never receives duplicate notifications
    const uniqueTokens = [...new Set(expo.map((t) => t.token))];
    const cfg = await this.settings.resolve('expo_push');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (cfg?.accessToken) headers.Authorization = `Bearer ${cfg.accessToken}`;
    for (let i = 0; i < uniqueTokens.length; i += 100) {
      const chunk = uniqueTokens.slice(i, i + 100);
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers,
          body: JSON.stringify(chunk.map((t) => ({ to: t, title, body, data, sound: 'default', priority: 'high', channelId: 'default' }))),
        });
        const json: any = await res.json().catch(() => ({}));
        const tickets: any[] = json?.data ?? [];
        const dead = tickets.map((t, idx) => (t?.details?.error === 'DeviceNotRegistered' ? chunk[idx] : null)).filter(Boolean) as string[];
        if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
      } catch (e) {
        this.logger.warn(`push failed: ${(e as Error).message}`);
      }
    }
  }
}
