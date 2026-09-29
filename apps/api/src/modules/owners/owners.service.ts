import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { formatINR, normalizeIndianPhone } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../core/events/events.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { env } from '../../config/env';

/** Days before lease end when the firm is reminded (renew with the tenant or re-rent the flat). */
export const RENEWAL_REMINDER_DAYS = [60, 30, 7];
const DEFAULT_LEASE_MONTHS = 11;

export interface OwnerInput {
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface TenancyInput {
  listingId?: string | null;
  ownerId?: string | null;
  tenantName: string;
  tenantPhone?: string | null;
  rent: number;
  startDate: Date;
  endDate?: Date | null;
  notes?: string | null;
}

const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};

/**
 * Landlord CRM + lease tracking. Closing a rent deal records the tenancy; before it ends the firm
 * gets follow-ups to renew or re-rent — repeat business from the same flats.
 */
@Injectable()
export class OwnersService implements OnModuleInit {
  private readonly logger = new Logger(OwnersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.events.on('deal.closed', (e) => this.tenancyFromDeal(e.dealId));
  }

  // ------------------------------------------------------------------ owners
  /** Creates owner records for the firm's listings that carry an owner phone but no owner yet. */
  async syncFromListings(orgId: string) {
    const listings = await this.prisma.listing.findMany({ where: { organizationId: orgId, ownerId: null, deletedAt: null, contactPhone: { not: null } }, select: { id: true, contactName: true, contactPhone: true }, take: 500 });
    for (const l of listings) {
      const phone = normalizeIndianPhone(l.contactPhone!) ?? l.contactPhone!;
      const owner = await this.prisma.owner.upsert({
        where: { organizationId_phone: { organizationId: orgId, phone } },
        create: { organizationId: orgId, phone, name: l.contactName?.trim() || 'Owner' },
        update: {},
      });
      await this.prisma.listing.update({ where: { id: l.id }, data: { ownerId: owner.id } });
    }
    return listings.length;
  }

  async list(orgId: string, q?: string) {
    await this.syncFromListings(orgId);
    return this.prisma.owner.findMany({
      where: { organizationId: orgId, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 300,
      include: {
        _count: { select: { listings: true } },
        tenancies: { where: { status: 'ACTIVE' }, select: { id: true, endDate: true }, orderBy: { endDate: 'asc' }, take: 1 },
      },
    });
  }

  async get(orgId: string, id: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id, organizationId: orgId },
      include: {
        listings: { where: { deletedAt: null }, select: { id: true, slug: true, title: true, status: true, price: true, coverUrl: true, availableFrom: true }, orderBy: { updatedAt: 'desc' } },
        tenancies: { orderBy: { startDate: 'desc' }, include: { listing: { select: { id: true, title: true, slug: true } } } },
      },
    });
    if (!owner) throw new NotFoundException();
    return owner;
  }

  async create(orgId: string, input: OwnerInput) {
    const phone = normalizeIndianPhone(input.phone) ?? input.phone;
    const exists = await this.prisma.owner.findUnique({ where: { organizationId_phone: { organizationId: orgId, phone } } });
    if (exists) throw new BadRequestException('इस number का owner पहले से है');
    return this.prisma.owner.create({ data: { organizationId: orgId, name: input.name, phone, email: input.email || null, notes: input.notes ?? null, tags: input.tags ?? [] } });
  }

  async update(orgId: string, id: string, input: Partial<OwnerInput>) {
    await this.get(orgId, id);
    return this.prisma.owner.update({ where: { id }, data: { ...input, phone: input.phone ? normalizeIndianPhone(input.phone) ?? input.phone : undefined } });
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.owner.delete({ where: { id } });
    return { ok: true };
  }

  async linkListing(orgId: string, ownerId: string, listingId: string) {
    await this.get(orgId, ownerId);
    const l = await this.prisma.listing.findFirst({ where: { id: listingId, organizationId: orgId } });
    if (!l) throw new NotFoundException('Listing नहीं मिली');
    return this.prisma.listing.update({ where: { id: listingId }, data: { ownerId }, select: { id: true, ownerId: true } });
  }

  // ------------------------------------------------------------------ tenancies
  tenancies(orgId: string, status?: string) {
    return this.prisma.tenancy.findMany({
      where: { organizationId: orgId, ...(status ? { status: status as any } : {}) },
      orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
      take: 300,
      include: { listing: { select: { id: true, title: true, slug: true } }, owner: { select: { id: true, name: true, phone: true } } },
    });
  }

  async createTenancy(orgId: string, input: TenancyInput) {
    if (input.listingId && !(await this.prisma.listing.findFirst({ where: { id: input.listingId, organizationId: orgId } }))) throw new BadRequestException('Listing नहीं मिली');
    const listingOwner = input.listingId ? (await this.prisma.listing.findUnique({ where: { id: input.listingId }, select: { ownerId: true } }))?.ownerId : null;
    return this.prisma.tenancy.create({
      data: {
        organizationId: orgId,
        listingId: input.listingId ?? null,
        ownerId: input.ownerId ?? listingOwner ?? null,
        tenantName: input.tenantName,
        tenantPhone: input.tenantPhone ? normalizeIndianPhone(input.tenantPhone) ?? input.tenantPhone : null,
        rent: input.rent,
        startDate: input.startDate,
        endDate: input.endDate ?? addMonths(input.startDate, DEFAULT_LEASE_MONTHS),
        notes: input.notes ?? null,
      },
    });
  }

  async updateTenancy(orgId: string, id: string, patch: Partial<TenancyInput> & { status?: 'ACTIVE' | 'RENEWED' | 'ENDED'; renewMonths?: number }) {
    const t = await this.prisma.tenancy.findFirst({ where: { id, organizationId: orgId } });
    if (!t) throw new NotFoundException();
    const { renewMonths, ...rest } = patch;
    if (renewMonths) {
      // Renewal = close this lease as RENEWED and open the next term with the same tenant.
      await this.prisma.tenancy.update({ where: { id }, data: { status: 'RENEWED' } });
      return this.prisma.tenancy.create({
        data: { organizationId: orgId, listingId: t.listingId, ownerId: t.ownerId, dealId: t.dealId, tenantName: t.tenantName, tenantPhone: t.tenantPhone, rent: rest.rent ?? t.rent, startDate: t.endDate, endDate: addMonths(t.endDate, renewMonths), notes: rest.notes ?? t.notes },
      });
    }
    return this.prisma.tenancy.update({ where: { id }, data: rest as Prisma.TenancyUncheckedUpdateInput });
  }

  /** A closed rent deal becomes a tenancy (11-month default term) so renewals are tracked. */
  async tenancyFromDeal(dealId: string) {
    const d = await this.prisma.deal.findUnique({ where: { id: dealId }, include: { lead: { select: { name: true, phone: true } }, listing: { select: { id: true, purpose: true, price: true, ownerId: true } } } });
    if (!d?.listing || d.listing.purpose !== 'RENT') return null;
    if (await this.prisma.tenancy.findFirst({ where: { dealId } })) return null;
    const start = d.closedAt ?? new Date();
    return this.prisma.tenancy.create({
      data: { organizationId: d.organizationId, listingId: d.listing.id, ownerId: d.listing.ownerId, dealId, tenantName: d.lead.name, tenantPhone: d.lead.phone, rent: d.listing.price, startDate: start, endDate: addMonths(start, DEFAULT_LEASE_MONTHS) },
    });
  }

  // ------------------------------------------------------------------ renewal reminders
  @Cron('0 30 4 * * *') // 10:00 IST
  async renewalReminders() {
    if (!env().JOBS_ENABLED) return;
    await this.runRenewalReminders();
  }

  async runRenewalReminders(now = new Date()) {
    const horizon = new Date(now.getTime() + Math.max(...RENEWAL_REMINDER_DAYS) * 86400_000);
    const due = await this.prisma.tenancy.findMany({
      where: { status: 'ACTIVE', endDate: { lte: horizon } },
      include: { listing: { select: { id: true, title: true, status: true } }, deal: { select: { leadId: true, agentId: true } } },
      take: 1000,
    });
    let sent = 0;
    for (const t of due) {
      const daysLeft = Math.ceil((t.endDate.getTime() - now.getTime()) / 86400_000);
      if (daysLeft < 0) {
        await this.prisma.tenancy.update({ where: { id: t.id }, data: { status: 'ENDED' } });
        continue;
      }
      // All thresholds already crossed count as done (a missed 60-day reminder isn't sent late next to the 30-day one).
      const crossed = RENEWAL_REMINDER_DAYS.filter((d) => daysLeft <= d && !t.remindersSent.includes(d));
      if (!crossed.length) continue;
      const step = Math.min(...crossed);
      const title = `🔁 Lease ${daysLeft} दिन में ख़त्म: ${t.tenantName}`;
      const body = `${t.listing?.title ?? 'Property'} · ${formatINR(t.rent)}/month — renewal करवाएँ या नया tenant ढूँढें`;
      if (t.deal?.leadId) {
        await this.prisma.followUp.create({
          data: { organizationId: t.organizationId, leadId: t.deal.leadId, assignedToId: t.deal.agentId, type: 'CALL', dueAt: new Date(now.getTime() + 3600_000), note: `${title}. ${body}` },
        });
      }
      if (t.deal?.agentId) await this.notifications.notify(t.deal.agentId, { kind: 'TENANCY_RENEWAL', title, body, link: '/broker/owners?tab=leases' });
      else await this.notifications.notifyOrg(t.organizationId, { kind: 'TENANCY_RENEWAL', title, body, link: '/broker/owners?tab=leases' }, { adminsOnly: true });
      // 30 days out: the flat will be free soon — show it as available from the lease end date.
      if (step <= 30 && t.listingId) await this.prisma.listing.update({ where: { id: t.listingId }, data: { availableFrom: t.endDate } }).catch(() => undefined);
      await this.prisma.tenancy.update({ where: { id: t.id }, data: { remindersSent: { push: crossed } } });
      sent++;
    }
    if (sent) this.logger.log(`renewal reminders sent: ${sent}`);
    return sent;
  }
}
