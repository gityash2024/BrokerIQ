import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { normalizeIndianPhone, videoRoomUrl } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../core/events/events.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { SettingsService } from '../../core/settings/settings.service';
import { LeadsService } from '../leads/leads.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import type { RequestUser } from '../../common/decorators';
import { randomToken, requireOrg } from '../../common/utils';
import { FeaturesService } from '../../core/features/features.service';
import { env } from '../../config/env';

export interface VisitSlotConfig {
  days: number[]; // 0 = Sunday
  start: string; // "10:00" IST
  end: string; // "19:00" IST
  slotMinutes: number;
  maxPerSlot: number;
}

export const DEFAULT_SLOTS: VisitSlotConfig = { days: [0, 1, 2, 3, 4, 5, 6], start: '10:00', end: '19:00', slotMinutes: 60, maxPerSlot: 2 };
const IST_MS = 330 * 60_000;
const MIN_LEAD_MINUTES = 120;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Slot start times (UTC) for the next `days` IST days, following the firm's weekly schedule. */
export function slotTimes(cfg: VisitSlotConfig, now: Date, days: number): Date[] {
  const out: Date[] = [];
  const istNow = new Date(now.getTime() + IST_MS);
  const dayStartUtc = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_MS;
  for (let d = 0; d < days; d++) {
    const start = dayStartUtc + d * 86400_000;
    const weekday = new Date(start + IST_MS).getUTCDay();
    if (!cfg.days.includes(weekday)) continue;
    for (let t = toMin(cfg.start); t + cfg.slotMinutes <= toMin(cfg.end); t += cfg.slotMinutes) {
      const at = new Date(start + t * 60_000);
      if (at.getTime() >= now.getTime() + MIN_LEAD_MINUTES * 60_000) out.push(at);
    }
  }
  return out;
}

/**
 * Tenant self-service visit booking on broker listings: the firm publishes weekly slots, tenants
 * pick one (lead + site visit are created), and both sides get reminders.
 */
@Injectable()
export class VisitBookingService {
  private readonly logger = new Logger(VisitBookingService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly leads: LeadsService,
    private readonly wa: WhatsAppService,
    private readonly features: FeaturesService,
  ) {}

  config(raw: unknown): VisitSlotConfig {
    const c = (raw ?? {}) as Partial<VisitSlotConfig>;
    return {
      days: Array.isArray(c.days) && c.days.length ? c.days.filter((d) => d >= 0 && d <= 6) : DEFAULT_SLOTS.days,
      start: /^\d{2}:\d{2}$/.test(c.start ?? '') ? c.start! : DEFAULT_SLOTS.start,
      end: /^\d{2}:\d{2}$/.test(c.end ?? '') ? c.end! : DEFAULT_SLOTS.end,
      slotMinutes: [30, 45, 60, 90, 120].includes(Number(c.slotMinutes)) ? Number(c.slotMinutes) : DEFAULT_SLOTS.slotMinutes,
      maxPerSlot: Math.min(10, Math.max(1, Number(c.maxPerSlot) || DEFAULT_SLOTS.maxPerSlot)),
    };
  }

  async getSettings(user: RequestUser) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: requireOrg(user) }, select: { visitSlots: true } });
    return this.config(org.visitSlots);
  }

  async saveSettings(user: RequestUser, body: Partial<VisitSlotConfig>) {
    const cfg = this.config(body);
    if (toMin(cfg.end) <= toMin(cfg.start)) throw new BadRequestException('End time start से बाद होना चाहिए');
    await this.prisma.organization.update({ where: { id: requireOrg(user) }, data: { visitSlots: cfg as any } });
    return cfg;
  }

  private async bookableListing(listingId: string) {
    const l = await this.prisma.listing.findFirst({
      where: { id: listingId, status: 'ACTIVE', deletedAt: null },
      include: { organization: { select: { id: true, name: true, visitSlots: true } }, locality: { select: { name: true } } },
    });
    if (!l) throw new NotFoundException('Listing नहीं मिली');
    return l;
  }

  /** Available slots for the next `days` days (broker listings only; owner listings use the enquiry form). */
  async slots(listingId: string, days = 7, now = new Date()) {
    const l = await this.bookableListing(listingId);
    if (!l.organization) return { bookable: false, days: [] as { date: string; slots: { at: string; available: number }[] }[] };
    const cfg = this.config(l.organization.visitSlots);
    const times = slotTimes(cfg, now, Math.min(14, Math.max(1, days)));
    if (!times.length) return { bookable: true, days: [] };
    const booked = await this.prisma.siteVisit.groupBy({
      by: ['scheduledAt'],
      where: { organizationId: l.organization.id, status: { in: ['SCHEDULED', 'CONFIRMED'] }, scheduledAt: { in: times } },
      _count: { _all: true },
    });
    const byDay = new Map<string, { at: string; available: number }[]>();
    for (const t of times) {
      const used = booked.find((b) => b.scheduledAt.getTime() === t.getTime())?._count._all ?? 0;
      const date = new Date(t.getTime() + IST_MS).toISOString().slice(0, 10);
      byDay.set(date, [...(byDay.get(date) ?? []), { at: t.toISOString(), available: Math.max(0, cfg.maxPerSlot - used) }]);
    }
    return { bookable: true, days: [...byDay.entries()].map(([date, slots]) => ({ date, slots })) };
  }

  async book(
    user: RequestUser,
    listingId: string,
    body: { at: string; name?: string | null; phone?: string | null; note?: string | null; mode?: 'IN_PERSON' | 'VIDEO' },
  ) {
    const video = body.mode === 'VIDEO';
    if (video) await this.features.assertEnabled('video_visits');
    const l = await this.bookableListing(listingId);
    if (!l.organization) throw new BadRequestException('इस listing पर slot booking नहीं है — enquiry भेजें');
    const at = new Date(body.at);
    const avail = await this.slots(listingId, 14);
    const slot = avail.days.flatMap((d) => d.slots).find((s) => new Date(s.at).getTime() === at.getTime());
    if (!slot) throw new BadRequestException('यह slot उपलब्ध नहीं है');
    if (slot.available <= 0) throw new BadRequestException('यह slot भर चुका है — दूसरा समय चुनें');
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, phone: true, email: true, tenantVerifiedAt: true } });
    const phone = normalizeIndianPhone(body.phone ?? me.phone ?? '') ?? body.phone ?? me.phone;
    if (!phone) throw new BadRequestException('Mobile number डालें');
    const name = body.name || me.name;
    const when = at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const { lead } = await this.leads.ingest({
      orgId: l.organization.id,
      name,
      phone,
      email: me.email,
      source: 'WEBSITE',
      sourceRef: `visit:${l.id}:${at.toISOString()}`,
      sourceDetail: `Visit booked: ${l.title}`,
      listingId: l.id,
      message: `${video ? 'Video visit' : 'Site visit'} ${when}${body.note ? ` — ${body.note}` : ''}`,
    });
    if (me.tenantVerifiedAt && !lead.tags.includes('verified-tenant'))
      await this.prisma.lead.update({ where: { id: lead.id }, data: { tags: { push: 'verified-tenant' } } });
    const visit = await this.prisma.siteVisit.create({
      data: {
        organizationId: l.organization.id,
        leadId: lead.id,
        listingId: l.id,
        assignedToId: lead.assignedToId,
        scheduledAt: at,
        address: [l.societyName, l.address, l.locality.name].filter(Boolean).join(', '),
        note: body.note ?? null,
        tenantUserId: user.id,
        bookedByTenant: true,
        mode: video ? 'VIDEO' : 'IN_PERSON',
        meetingUrl: video ? videoRoomUrl(randomToken(12)) : null,
      },
    });
    await this.prisma.enquiry.create({
      data: {
        listingId: l.id,
        organizationId: l.organization.id,
        userId: user.id,
        name,
        phone,
        email: me.email,
        message: `Visit booked: ${when}`,
        wantsVisit: true,
        visitDate: at,
        source: 'VISIT_BOOKING',
        leadId: lead.id,
      },
    });
    await this.prisma.listing.update({ where: { id: l.id }, data: { enquiryCount: { increment: 1 } } });
    await this.prisma.activity.create({
      data: {
        organizationId: l.organization.id,
        leadId: lead.id,
        type: 'SITE_VISIT',
        content: `${video ? '🎥 Tenant ने video visit book की' : '📅 Tenant ने visit book की'}: ${when}${visit.meetingUrl ? ` · ${visit.meetingUrl}` : ''}`,
        meta: { visitId: visit.id },
      },
    });
    this.events.emit('visit.scheduled', { visitId: visit.id, orgId: l.organization.id, leadId: lead.id });
    const note = {
      kind: 'VISIT_BOOKED',
      title: `${video ? '🎥 नई video visit' : '📅 नई visit booking'}: ${name}`,
      body: `${l.title} · ${when}${visit.meetingUrl ? ` · ${visit.meetingUrl}` : ''}`,
      link: `/broker/visits`,
    };
    if (lead.assignedToId) await this.notifications.notify(lead.assignedToId, note);
    else await this.notifications.notifyOrg(l.organization.id, note, { adminsOnly: true });
    return { visit, when };
  }

  myVisits(userId: string) {
    return this.prisma.siteVisit.findMany({
      where: { tenantUserId: userId },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
      include: {
        listing: { select: { id: true, slug: true, title: true, coverUrl: true } },
        organization: { select: { name: true, phone: true, whatsapp: true } },
      },
    });
  }

  async cancelMine(userId: string, visitId: string) {
    const v = await this.prisma.siteVisit.findFirst({ where: { id: visitId, tenantUserId: userId } });
    if (!v) throw new NotFoundException();
    const updated = await this.prisma.siteVisit.update({ where: { id: v.id }, data: { status: 'CANCELLED' } });
    await this.notifications.notifyOrg(
      v.organizationId,
      {
        kind: 'VISIT_CANCELLED',
        title: 'Tenant ने visit cancel की',
        body: v.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        link: '/broker/visits',
      },
      { adminsOnly: true },
    );
    return updated;
  }

  // ------------------------------------------------------------------ tenant reminders
  @Cron('0 */10 * * * *')
  async remindersTick() {
    if (!env().JOBS_ENABLED) return;
    await this.sendTenantReminders();
  }

  /** Evening-before (after 8pm IST) and ~1 hour-before reminders to the tenant. */
  async sendTenantReminders(now = new Date()) {
    const istHour = new Date(now.getTime() + IST_MS).getUTCHours();
    const soon = await this.prisma.siteVisit.findMany({
      where: {
        tenantUserId: { not: null },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gt: now, lte: new Date(now.getTime() + 36 * 3600_000) },
      },
      include: { listing: { select: { title: true, slug: true } }, lead: { select: { phone: true, name: true } }, organization: { select: { name: true } } },
      take: 500,
    });
    const app = await this.settings.getAppConfig();
    let sent = 0;
    for (const v of soon) {
      const minsLeft = (v.scheduledAt.getTime() - now.getTime()) / 60_000;
      const tomorrow = new Date(v.scheduledAt.getTime() + IST_MS).toISOString().slice(0, 10) !== new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);
      const hour = minsLeft <= 75 && !v.tenantHourReminderAt;
      const day = !hour && tomorrow && istHour >= 20 && !v.tenantDayReminderAt;
      if (!hour && !day) continue;
      const when = v.scheduledAt.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
      const what = v.mode === 'VIDEO' ? 'video visit' : 'site visit';
      const title = hour ? `⏰ 1 घंटे में ${what}: ${v.listing?.title ?? ''}` : `📅 कल ${what}: ${when}`;
      await this.notifications.notify(v.tenantUserId!, {
        kind: 'VISIT_REMINDER',
        title,
        body: v.meetingUrl ? `Video call link: ${v.meetingUrl} · ${v.organization.name}` : `${v.address ?? ''} · ${v.organization.name}`,
        link: v.meetingUrl ?? (v.listing ? `/property/${v.listing.slug}` : '/account/visits'),
      });
      const tpl = app.whatsappTemplates?.visitReminder;
      if (tpl && v.lead?.phone) {
        await this.wa
          .send(
            null,
            v.lead.phone,
            {
              type: 'template',
              name: tpl,
              language: app.whatsappTemplates.language || 'hi',
              params: [v.lead.name, v.listing?.title ?? '', when, v.address ?? ''],
            },
            { contactName: v.lead.name },
          )
          .catch((e) => this.logger.warn(`visit WA ${v.id}: ${(e as Error).message}`));
      }
      await this.prisma.siteVisit.update({ where: { id: v.id }, data: hour ? { tenantHourReminderAt: now } : { tenantDayReminderAt: now } });
      sent++;
    }
    return sent;
  }
}
