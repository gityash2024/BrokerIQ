import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { formatINR, listingSearchSchema, normalizeIndianPhone, parseRentalQuery, type ParsedQuery } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../core/events/events.service';
import { SettingsService } from '../../core/settings/settings.service';
import { ListingsService } from '../listings/listings.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { env } from '../../config/env';

const BROKER_THREAD_DAYS = 7;
const RESULTS = 5;

/**
 * WhatsApp search bot on the platform number: "2bhk furnished sector 54 under 40k" → top listings,
 * "alert" → hourly alerts for that search, "stop" → unsubscribe. It stays silent for people who are
 * in an active broker conversation, and ignores messages that aren't searches or commands.
 */
@Injectable()
export class WaBotService implements OnModuleInit {
  private readonly logger = new Logger(WaBotService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
    private readonly listings: ListingsService,
    private readonly wa: WhatsAppService,
  ) {}

  onModuleInit() {
    this.events.on('message.inbound', (e) => (e.orgId ? undefined : this.onPlatformMessage(e.conversationId)));
  }

  private web() {
    return env().PUBLIC_WEB_URL.replace(/\/$/, '');
  }

  private async enabled() {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key: 'whatsapp_bot' } }).catch(() => null);
    return flag ? flag.enabled : true;
  }

  async onPlatformMessage(conversationId: string) {
    if (!(await this.enabled())) return null;
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId }, include: { messages: { where: { direction: 'INBOUND' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    const text = conv?.messages[0]?.body?.trim();
    const phone = conv?.contactPhone;
    if (!conv || !text || !phone) return null;
    const recentBroker = await this.prisma.message.count({
      where: { direction: 'OUTBOUND', createdAt: { gt: new Date(Date.now() - BROKER_THREAD_DAYS * 86400_000) }, conversation: { organizationId: { not: null }, contactPhone: phone } },
    });
    if (recentBroker) return null;
    const reply = await this.handle(phone, text, conv.contactName ?? null);
    if (reply) await this.wa.send(null, phone, { type: 'text', text: reply }, { contactName: conv.contactName ?? undefined, meta: { bot: true } }).catch((e) => this.logger.warn(`bot reply: ${(e as Error).message}`));
    return reply;
  }

  /** Returns the reply text (null = stay silent). Exposed for tests. */
  async handle(phone: string, text: string, name: string | null): Promise<string | null> {
    const q = parseRentalQuery(text);
    const norm = normalizeIndianPhone(phone) ?? phone;
    const sub = await this.prisma.whatsAppSubscriber.findUnique({ where: { phone: norm } });
    switch (q.command) {
      case 'help':
        return this.help(name);
      case 'stop': {
        if (sub) await this.prisma.whatsAppSubscriber.update({ where: { id: sub.id }, data: { active: false } });
        await this.prisma.savedSearch.updateMany({ where: { whatsappAlerts: true, user: { phone: norm } }, data: { whatsappAlerts: false } });
        return 'ठीक है, अब आपको WhatsApp alerts नहीं आएँगे। फिर से चालू करने के लिए अपनी ज़रूरत लिखकर "alert" भेजें।';
      }
      case 'alert': {
        if (!sub) return 'पहले बताइए क्या चाहिए — जैसे "2 BHK furnished Sector 54, 40k तक" — फिर "alert" भेजें।';
        await this.prisma.whatsAppSubscriber.update({ where: { id: sub.id }, data: { active: true, lastNotifiedAt: new Date() } });
        return `✅ Alert चालू: ${sub.label ?? 'आपकी search'}। नई matching property live होते ही यहीं बताएँगे। बंद करने के लिए "stop" भेजें।`;
      }
      case 'more':
        if (!sub) return this.help(name);
        return this.results(sub.filters as Record<string, unknown>, sub.label ?? '', 2);
    }
    if (!q.isSearch) return null;
    const filters = await this.toFilters(q);
    const label = this.label(q, filters.localityName);
    const { localityName: _l, ...stored } = filters;
    await this.prisma.whatsAppSubscriber.upsert({ where: { phone: norm }, create: { phone: norm, filters: stored as Prisma.InputJsonValue, label, active: false }, update: { filters: stored as Prisma.InputJsonValue, label } });
    return this.results(stored, label, 1);
  }

  private help(name: string | null) {
    return [
      `नमस्ते${name ? ` ${name.split(' ')[0]}` : ''}! 🏠 BrokerIQ पर Gurgaon में rent का घर खोजें।`,
      'बस लिखिए क्या चाहिए, जैसे:',
      '• 2 BHK furnished Sector 54 40k तक',
      '• PG Sohna Road 12000',
      '"more" = और results · "alert" = नई property पर alert · "stop" = alerts बंद',
    ].join('\n');
  }

  private label(q: ParsedQuery, localityName: string | null) {
    return [q.bedrooms.length ? `${q.bedrooms.join('/')} BHK` : null, q.types.includes('PG') ? 'PG' : null, q.furnishing ? q.furnishing.toLowerCase().replace('_', ' ') : null, localityName, q.maxBudget ? `${formatINR(q.maxBudget)} तक` : null].filter(Boolean).join(' · ') || 'Gurgaon rentals';
  }

  private async toFilters(q: ParsedQuery) {
    let locality: { slug: string; name: string } | null = null;
    if (q.localityText) {
      locality = await this.prisma.locality.findFirst({ where: { OR: [{ name: { equals: q.localityText, mode: 'insensitive' } }, { name: { startsWith: q.localityText, mode: 'insensitive' } }] }, select: { slug: true, name: true } });
      if (!locality) {
        const rows = await this.prisma.$queryRaw<{ slug: string; name: string }[]>`SELECT slug, name FROM "Locality" WHERE similarity(name, ${q.localityText}) > 0.4 ORDER BY similarity(name, ${q.localityText}) DESC LIMIT 1`.catch(() => []);
        locality = rows[0] ?? null;
      }
    }
    return {
      ...(q.bedrooms.length ? { bedrooms: q.bedrooms.join(',') } : {}),
      ...(q.maxBudget ? { maxPrice: q.maxBudget } : {}),
      ...(q.minBudget ? { minPrice: q.minBudget } : {}),
      ...(q.furnishing ? { furnishing: q.furnishing } : {}),
      ...(q.types.length ? { types: q.types.join(',') } : {}),
      ...(locality ? { localities: locality.slug } : {}),
      localityName: locality?.name ?? null,
    };
  }

  private async results(filters: Record<string, unknown>, label: string, page: number) {
    const input = listingSearchSchema.parse({ ...filters, page, pageSize: RESULTS });
    const r = await this.listings.search(input);
    if (!r.items.length) return page > 1 ? 'और results नहीं हैं। Alert के लिए "alert" भेजें।' : `"${label}" के लिए अभी कोई property नहीं मिली। "alert" भेजें — नई property आते ही बताएँगे।`;
    const lines = r.items.map((l: any, i: number) => `${(page - 1) * RESULTS + i + 1}. ${l.title}\n   ${formatINR(l.price)}/month · ${l.locality.name}\n   ${this.web()}/property/${l.slug}`);
    const more = r.total > page * RESULTS ? `\n\n${r.total - page * RESULTS} और हैं — "more" भेजें।` : '';
    return `🏠 ${label} — ${r.total} properties\n\n${lines.join('\n\n')}${more}\n\nनई property पर alert चाहिए? "alert" भेजें।`;
  }

  // ------------------------------------------------------------------ alerts
  @Cron('0 10 * * * *')
  async hourlyAlerts() {
    if (!env().JOBS_ENABLED || !(await this.enabled())) return;
    await this.sendAlerts();
  }

  async sendAlerts(now = new Date()) {
    const app = await this.settings.getAppConfig();
    const tpl = app.whatsappTemplates?.searchAlert;
    const subs = await this.prisma.whatsAppSubscriber.findMany({ where: { active: true }, take: 2000 });
    let sent = 0;
    for (const s of subs) {
      const since = s.lastNotifiedAt ?? s.createdAt;
      const where = { AND: [this.listings.buildWhere(s.filters as any), { publishedAt: { gt: since } }] };
      const fresh = await this.prisma.listing.findMany({ where, orderBy: { publishedAt: 'desc' }, take: 3, select: { title: true, slug: true, price: true } });
      if (!fresh.length) continue;
      const count = await this.prisma.listing.count({ where });
      const conv = await this.prisma.conversation.findFirst({ where: { organizationId: null, contactPhone: s.phone }, orderBy: { lastMessageAt: 'desc' }, select: { lastInboundAt: true } });
      const windowOpen = !!conv?.lastInboundAt && now.getTime() - conv.lastInboundAt.getTime() < 23 * 3600_000;
      const link = `${this.web()}/rent?${new URLSearchParams(Object.entries(s.filters as Record<string, unknown>).map(([k, v]) => [k, String(v)])).toString()}`;
      try {
        if (windowOpen) {
          const text = `🔔 ${s.label ?? 'आपकी search'}: ${count} नई properties\n\n${fresh.map((l) => `• ${l.title} — ${formatINR(l.price)}/month\n  ${this.web()}/property/${l.slug}`).join('\n')}\n\nसब देखें: ${link}\n"stop" = alerts बंद`;
          await this.wa.send(null, s.phone, { type: 'text', text }, { meta: { alert: true } });
        } else if (tpl) {
          await this.wa.send(null, s.phone, { type: 'template', name: tpl, language: app.whatsappTemplates.language || 'hi', params: [String(count), s.label ?? 'Gurgaon rentals', link] }, { meta: { alert: true } });
        } else continue;
        await this.prisma.whatsAppSubscriber.update({ where: { id: s.id }, data: { lastNotifiedAt: now } });
        sent++;
      } catch (e) {
        this.logger.warn(`alert ${s.phone}: ${(e as Error).message}`);
      }
    }
    return sent;
  }
}
