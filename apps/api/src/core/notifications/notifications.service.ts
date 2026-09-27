import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SettingsService } from '../settings/settings.service';

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
  ) {}

  async notify(userIds: string | string[], input: NotifyInput) {
    const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
    if (!ids.length) return;
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, kind: input.kind, title: input.title, body: input.body, link: input.link, data: input.data as Prisma.InputJsonValue })),
    });
    for (const id of ids) this.realtime.toUser(id, 'notification', { kind: input.kind, title: input.title, body: input.body, link: input.link });
    if (input.push !== false) await this.push(ids, input.title, input.body ?? '', { link: input.link, kind: input.kind, ...input.data });
  }

  async notifyOrg(orgId: string, input: NotifyInput, opts: { adminsOnly?: boolean; include?: string[] } = {}) {
    const members = await this.prisma.user.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', ...(opts.adminsOnly ? { role: 'BROKER_ADMIN' } : {}) },
      select: { id: true },
    });
    await this.notify([...members.map((m) => m.id), ...(opts.include ?? [])], input);
  }

  /** Expo push (free). Tokens that Expo reports as invalid are removed. */
  async push(userIds: string[], title: string, body: string, data: Record<string, unknown> = {}) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId: { in: userIds } } });
    const expo = tokens.filter((t) => t.token.startsWith('ExponentPushToken') || t.token.startsWith('ExpoPushToken'));
    if (!expo.length) return;
    const cfg = await this.settings.resolve('expo_push');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (cfg?.accessToken) headers.Authorization = `Bearer ${cfg.accessToken}`;
    for (let i = 0; i < expo.length; i += 100) {
      const chunk = expo.slice(i, i + 100);
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers,
          body: JSON.stringify(chunk.map((t) => ({ to: t.token, title, body, data, sound: 'default', priority: 'high', channelId: 'default' }))),
        });
        const json: any = await res.json().catch(() => ({}));
        const tickets: any[] = json?.data ?? [];
        const dead = tickets.map((t, idx) => (t?.details?.error === 'DeviceNotRegistered' ? chunk[idx].token : null)).filter(Boolean) as string[];
        if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
      } catch (e) {
        this.logger.warn(`push failed: ${(e as Error).message}`);
      }
    }
  }
}
