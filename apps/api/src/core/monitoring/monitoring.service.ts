import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { ErrorSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { env } from '../../config/env';

export interface ErrorReport {
  source: ErrorSource;
  message: string;
  stack?: string | null;
  route?: string | null;
  method?: string | null;
  userId?: string | null;
  appVersion?: string | null;
  userAgent?: string | null;
}

const ALERT_EVERY_MS = 60 * 60_000; // same alert at most once an hour
const DISK_ALERT_PCT = 85;

/**
 * Built-in monitoring: groups errors from the API, website and app (Admin → Health → Errors), alerts
 * Super Admins on new ones, forwards to Sentry when a DSN is configured, and runs periodic uptime checks
 * (website, database latency, disk space, watchdog restarts).
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly lastAlert = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  /** Stable id for "the same error": source + message without numbers/ids + first stack frame. */
  static fingerprint(r: Pick<ErrorReport, 'source' | 'message' | 'stack' | 'route'>) {
    const msg = r.message.replace(/[0-9a-f]{8,}|\d+/gi, '#').slice(0, 300);
    const frame =
      (r.stack ?? '')
        .split('\n')
        .find((l) => /^\s*at /.test(l))
        ?.trim()
        .replace(/:\d+:\d+\)?$/, '') ?? '';
    const route = (r.route ?? '').replace(/\/[0-9a-z]{20,}|\/\d+/gi, '/:id').split('?')[0];
    return createHash('sha1').update(`${r.source}|${msg}|${frame}|${route}`).digest('hex');
  }

  async record(r: ErrorReport) {
    try {
      const message = r.message.slice(0, 1000) || 'Unknown error';
      const fingerprint = MonitoringService.fingerprint({ ...r, message });
      const existing = await this.prisma.errorLog.findUnique({ where: { fingerprint } });
      const row = existing
        ? await this.prisma.errorLog.update({
            where: { id: existing.id },
            data: {
              count: { increment: 1 },
              lastSeenAt: new Date(),
              resolvedAt: null,
              userId: r.userId ?? existing.userId,
              appVersion: r.appVersion ?? existing.appVersion,
            },
          })
        : await this.prisma.errorLog.create({
            data: {
              fingerprint,
              source: r.source,
              message,
              stack: r.stack?.slice(0, 8000),
              route: r.route?.slice(0, 300),
              method: r.method,
              userId: r.userId,
              appVersion: r.appVersion,
              userAgent: r.userAgent?.slice(0, 300),
            },
          });
      // New, or came back after being marked resolved.
      if (!existing || existing.resolvedAt) {
        await this.alert(
          `error:${fingerprint}`,
          `${r.source === 'API' ? 'API' : r.source === 'WEB' ? 'Website' : 'App'} error: ${message.slice(0, 120)}`,
          [r.route, r.appVersion && `v${r.appVersion}`].filter(Boolean).join(' · '),
          '/admin/health',
        );
        await this.prisma.errorLog.update({ where: { id: row.id }, data: { alertedAt: new Date() } });
      }
      void this.toSentry(r, message);
    } catch (e) {
      this.logger.warn(`error log failed: ${(e as Error).message}`);
    }
  }

  /** Notify all Super Admins (in-app + email), at most once per key per hour. */
  async alert(key: string, title: string, body = '', link = '/admin/health') {
    const now = Date.now();
    if (now - (this.lastAlert.get(key) ?? 0) < ALERT_EVERY_MS) return;
    this.lastAlert.set(key, now);
    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null }, select: { id: true, email: true } });
    if (!admins.length) return;
    await this.notifications
      .notify(
        admins.map((a) => a.id),
        { kind: 'SYSTEM_ALERT', title: `⚠️ ${title}`, body, link },
      )
      .catch(() => undefined);
    const to = admins.map((a) => a.email).filter(Boolean);
    if (!to.length) return;
    const web = env().PUBLIC_WEB_URL.replace(/\/$/, '');
    await this.mail
      .send({
        to: to[0],
        bcc: to.slice(1),
        subject: `BrokerIQ alert — ${title}`,
        html: `<p><b>${escapeHtml(title)}</b></p><p>${escapeHtml(body)}</p><p><a href="${web}${link}">Admin panel में देखें</a></p>`,
      })
      .catch(() => undefined); // mail not configured → in-app only
  }

  // ------------------------------------------------------------------ Sentry (optional, no SDK)
  private async toSentry(r: ErrorReport, message: string) {
    const cfg = await this.settings.resolve('sentry').catch(() => null);
    const dsn = cfg?.dsn ? String(cfg.dsn) : '';
    const m = dsn.match(/^(https?):\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) return;
    const [, proto, key, host, project] = m;
    const eventId = randomBytes(16).toString('hex');
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'javascript',
      level: 'error',
      environment: env().NODE_ENV,
      release: r.appVersion ?? undefined,
      tags: { source: r.source, route: r.route ?? undefined },
      user: r.userId ? { id: r.userId } : undefined,
      exception: { values: [{ type: r.source === 'API' ? 'ApiError' : r.source === 'WEB' ? 'WebError' : 'AppError', value: message }] },
      extra: { stack: r.stack ?? undefined, userAgent: r.userAgent ?? undefined },
    };
    const envelope = `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}`;
    await fetch(`${proto}://${host}/api/${project}/envelope/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=brokeriq/1.0` },
      body: envelope,
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  }

  // ------------------------------------------------------------------ uptime checks
  @Cron('0 */10 * * * *')
  async periodicChecks() {
    if (!env().JOBS_ENABLED) return;
    await this.checks();
  }

  /** Website reachable, database fast, disk not full, watchdog restarts reported. Returns what it found. */
  async checks() {
    const found: string[] = [];
    const web = env().PUBLIC_WEB_URL.replace(/\/$/, '');
    if (web && !web.includes('localhost')) {
      const ok = await fetch(`${web}/`, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })
        .then((r) => r.ok || r.status === 405)
        .catch(() => false);
      if (!ok) found.push('website');
      if (!ok) await this.alert('uptime:web', 'Website नहीं खुल रही', web);
    }
    const t = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - t;
    if (dbMs > 2000) {
      found.push('db-slow');
      await this.alert('uptime:db', 'Database धीमा है', `${dbMs} ms`);
    }
    const disk = await diskUsedPct(env().MEDIA_ROOT || '/');
    if (disk != null && disk >= DISK_ALERT_PCT) {
      found.push('disk');
      await this.alert('uptime:disk', `Server disk ${disk}% भर चुकी है`, 'पुरानी files/backups साफ़ करें या disk बढ़ाएँ');
    }
    const incidents = env().WATCHDOG_INCIDENTS_FILE;
    if (incidents) {
      const text = await fs.readFile(incidents, 'utf8').catch(() => '');
      if (text.trim()) {
        found.push('watchdog');
        await this.alert('uptime:watchdog', 'Watchdog ने BrokerIQ restart किया', text.trim().split('\n').slice(-5).join(' | '));
        await fs.writeFile(incidents, '').catch(() => undefined);
      }
    }
    return { found, dbMs, disk };
  }
}

async function diskUsedPct(path: string) {
  try {
    const s = await fs.statfs(path);
    return Math.round((1 - s.bavail / s.blocks) * 100);
  } catch {
    return null;
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
