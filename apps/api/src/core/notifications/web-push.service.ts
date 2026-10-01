import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CryptoService } from '../settings/crypto.service';
import { env } from '../../config/env';

const KEY = 'webpush.vapid';

/**
 * Browser push for the website (PWA), free and without any third-party service: VAPID keys are generated on first
 * use and kept in SystemSetting (private key encrypted). Subscriptions live in PushToken with platform "web".
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private keys?: { publicKey: string; privateKey: string };
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly crypto: CryptoService,
  ) {}

  async vapid() {
    if (this.keys) return this.keys;
    const stored = await this.settings.getJson<{ publicKey: string; privateKeyEnc: string }>(KEY);
    if (stored) {
      this.keys = { publicKey: stored.publicKey, privateKey: this.crypto.decrypt(stored.privateKeyEnc) };
      return this.keys;
    }
    const k = webpush.generateVAPIDKeys();
    await this.settings.setJson(KEY, { publicKey: k.publicKey, privateKeyEnc: this.crypto.encrypt(k.privateKey) });
    this.keys = k;
    return k;
  }

  async publicKey() {
    return (await this.vapid()).publicKey;
  }

  async send(userIds: string[], title: string, body: string, data: Record<string, unknown> = {}) {
    const subs = await this.prisma.pushToken.findMany({ where: { userId: { in: userIds }, platform: 'web' } });
    if (!subs.length) return 0;
    const { publicKey, privateKey } = await this.vapid();
    const subject = env().PUBLIC_WEB_URL.startsWith('https://') ? env().PUBLIC_WEB_URL : 'mailto:support@brokeriq.in';
    const payload = JSON.stringify({ title, body, link: typeof data.link === 'string' ? data.link : '/', kind: data.kind ?? null });
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(JSON.parse(s.token), payload, { vapidDetails: { subject, publicKey, privateKey }, TTL: 24 * 3600, urgency: 'normal' });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // Gone / not found / bad subscription: the browser unsubscribed — forget it.
        if (status === 404 || status === 410 || status === 400 || e instanceof SyntaxError)
          await this.prisma.pushToken.delete({ where: { id: s.id } }).catch(() => undefined);
        else this.logger.warn(`web push failed (${status ?? '-'}): ${(e as Error).message}`);
      }
    }
    return sent;
  }
}
