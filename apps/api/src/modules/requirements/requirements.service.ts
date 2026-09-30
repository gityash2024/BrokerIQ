import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Listing, Prisma, TenantRequirement } from '@prisma/client';
import { formatINR, isRequirementMatch, requirementMatchScore, type TenantRequirementInput } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../core/events/events.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { SettingsService } from '../../core/settings/settings.service';
import { AuditService } from '../../core/audit/audit.service';
import { LeadsService } from '../leads/leads.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { LISTING_CARD_SELECT } from '../listings/listings.service';
import type { RequestUser } from '../../common/decorators';
import { env } from '../../config/env';
import { FeaturesService } from '../../core/features/features.service';

/** Brokers that receive a tenant's requirement (only with the tenant's explicit consent). */
const SHARE_WITH_TOP_BROKERS = 3;

/**
 * Tenant requirements ("2 BHK, Sector 54, ₹40k") and the auto-match engine: every newly
 * published listing is checked against active requirements (tenant alert) and against open CRM
 * leads' requirements (broker alert).
 */
@Injectable()
export class RequirementsService implements OnModuleInit {
  private readonly logger = new Logger(RequirementsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly leads: LeadsService,
    private readonly wa: WhatsAppService,
    private readonly features: FeaturesService,
  ) {}

  onModuleInit() {
    this.events.on('listing.published', async ({ listingId }) => {
      if (await this.features.isEnabled('tenant_requirements')) await this.onListingPublished(listingId);
    });
  }

  // ------------------------------------------------------------------ tenant side
  async create(user: RequestUser, input: TenantRequirementInput) {
    const req = await this.prisma.tenantRequirement.create({
      data: {
        ...input,
        userId: user.id,
        bedrooms: input.bedrooms ?? [],
        localityIds: input.localityIds ?? [],
        propertyTypes: input.propertyTypes ?? [],
      } as Prisma.TenantRequirementUncheckedCreateInput,
    });
    const shared = input.shareWithBrokers ? await this.shareWithBrokers(req) : [];
    await this.audit.log(user, 'requirement.create', 'TenantRequirement', req.id, { shared: shared.length });
    return { requirement: { ...req, sharedOrgIds: shared }, matches: await this.findMatches(req, 12) };
  }

  mine(userId: string) {
    return this.prisma.tenantRequirement.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 });
  }

  async update(userId: string, id: string, patch: Partial<TenantRequirementInput> & { status?: 'ACTIVE' | 'PAUSED' | 'CLOSED' }) {
    await this.own(userId, id);
    const { shareWithBrokers: _ignored, ...rest } = patch;
    return this.prisma.tenantRequirement.update({ where: { id }, data: rest as Prisma.TenantRequirementUpdateInput });
  }

  async remove(userId: string, id: string) {
    await this.own(userId, id);
    await this.prisma.tenantRequirement.delete({ where: { id } });
    return { ok: true };
  }

  async matches(userId: string, id: string) {
    return this.findMatches(await this.own(userId, id), 30);
  }

  private async own(userId: string, id: string) {
    const r = await this.prisma.tenantRequirement.findFirst({ where: { id, userId } });
    if (!r) throw new NotFoundException();
    return r;
  }

  private async findMatches(r: TenantRequirement, take: number) {
    const rows = await this.prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        purpose: 'RENT',
        ...(r.localityIds.length ? { localityId: { in: r.localityIds } } : {}),
        ...(r.bedrooms.length ? { bedrooms: { in: r.bedrooms } } : {}),
        ...(r.propertyTypes.length ? { propertyType: { in: r.propertyTypes } } : {}),
        ...(r.maxBudget || r.minBudget
          ? { price: { ...(r.maxBudget ? { lte: r.maxBudget * 1.1 } : {}), ...(r.minBudget ? { gte: r.minBudget * 0.8 } : {}) } }
          : {}),
      },
      orderBy: [{ isFeatured: 'desc' }, { isVerified: 'desc' }, { rankBoost: 'desc' }, { publishedAt: 'desc' }],
      take: 60,
      select: { ...LISTING_CARD_SELECT, localityId: true },
    });
    return rows
      .filter((l) => isRequirementMatch(r, l))
      .map((l) => ({ ...l, matchScore: requirementMatchScore(r, l) }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, take);
  }

  /** Sends the requirement as a lead to the best-ranked brokers covering those localities. */
  private async shareWithBrokers(r: TenantRequirement): Promise<string[]> {
    const orgs = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', onboarded: true, ...(r.localityIds.length ? { localities: { some: { id: { in: r.localityIds } } } } : {}) },
      orderBy: [{ rankScore: 'desc' }, { rating: 'desc' }],
      take: SHARE_WITH_TOP_BROKERS,
      select: { id: true },
    });
    const localities = r.localityIds.length ? await this.prisma.locality.findMany({ where: { id: { in: r.localityIds } }, select: { name: true } }) : [];
    const summary = [
      r.bedrooms.length ? `${r.bedrooms.join('/')} BHK` : null,
      localities.length ? localities.map((l) => l.name).join(', ') : null,
      r.maxBudget ? `budget ${r.minBudget ? `${formatINR(r.minBudget)}–` : 'up to '}${formatINR(r.maxBudget)}` : null,
      r.furnishing ? r.furnishing.toLowerCase().replace('_', ' ') : null,
      r.moveInBy ? `move-in by ${r.moveInBy.toISOString().slice(0, 10)}` : null,
      r.notes,
    ]
      .filter(Boolean)
      .join(' · ');
    const shared: string[] = [];
    for (const o of orgs) {
      try {
        await this.leads.ingest({
          orgId: o.id,
          name: r.name,
          phone: r.phone,
          source: 'WEBSITE',
          sourceRef: `requirement:${r.id}`,
          sourceDetail: 'BrokerIQ पर tenant की ज़रूरत',
          message: summary,
          requirement: {
            purpose: 'RENT',
            bedrooms: r.bedrooms,
            localityIds: r.localityIds,
            minBudget: r.minBudget,
            maxBudget: r.maxBudget,
            furnishing: r.furnishing as any,
            propertyTypes: r.propertyTypes as any,
          },
          rawPayload: { requirementId: r.id },
        });
        shared.push(o.id);
      } catch (e) {
        this.logger.warn(`share requirement ${r.id} → ${o.id} failed: ${(e as Error).message}`);
      }
    }
    if (shared.length) await this.prisma.tenantRequirement.update({ where: { id: r.id }, data: { sharedOrgIds: shared } });
    return shared;
  }

  // ------------------------------------------------------------------ auto-match on new listings
  async onListingPublished(listingId: string) {
    const l = await this.prisma.listing.findUnique({ where: { id: listingId }, include: { locality: { select: { name: true } } } });
    if (!l || l.status !== 'ACTIVE' || l.purpose !== 'RENT') return { tenants: 0, leads: 0 };
    const tenants = await this.alertTenants(l);
    const leads = await this.alertBrokers(l);
    return { tenants, leads };
  }

  private requirementWhere(l: Listing): Prisma.TenantRequirementWhereInput {
    return {
      status: 'ACTIVE',
      AND: [
        { OR: [{ bedrooms: { isEmpty: true } }, ...(l.bedrooms != null ? [{ bedrooms: { has: l.bedrooms } }] : [])] },
        { OR: [{ localityIds: { isEmpty: true } }, { localityIds: { has: l.localityId } }] },
        { OR: [{ propertyTypes: { isEmpty: true } }, { propertyTypes: { has: l.propertyType } }] },
        { OR: [{ maxBudget: null }, { maxBudget: { gte: l.price / 1.1 } }] },
        { OR: [{ minBudget: null }, { minBudget: { lte: l.price / 0.8 } }] },
      ],
    };
  }

  private async alertTenants(l: Listing & { locality: { name: string } }) {
    const reqs = (await this.prisma.tenantRequirement.findMany({ where: this.requirementWhere(l), take: 300 })).filter((r) => isRequirementMatch(r, l));
    if (!reqs.length) return 0;
    const web = env().PUBLIC_WEB_URL.replace(/\/$/, '');
    const link = `${web}/property/${l.slug}`;
    const app = await this.settings.getAppConfig();
    const waTemplate = app.whatsappTemplates?.requirementMatch;
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(reqs.map((r) => r.userId))] } }, select: { id: true, email: true } });
    for (const r of reqs) {
      await this.notifications.notify(r.userId, {
        kind: 'REQUIREMENT_MATCH',
        title: '🏠 आपकी ज़रूरत से मिलती नई property',
        body: `${l.title} · ${formatINR(l.price)}/month`,
        link: `/property/${l.slug}`,
      });
      const email = users.find((u) => u.id === r.userId)?.email;
      if (email)
        await this.mail.trySendTemplate('requirement.match', email, {
          name: r.name,
          listing: l,
          rent: l.price.toLocaleString('en-IN'),
          locality: l.locality.name,
          link,
        });
      if (waTemplate) {
        await this.wa
          .send(
            null,
            r.phone,
            { type: 'template', name: waTemplate, language: app.whatsappTemplates.language || 'hi', params: [r.name, l.title, link] },
            { contactName: r.name, meta: { requirementId: r.id } },
          )
          .catch((e) => this.logger.warn(`requirement WA ${r.id}: ${(e as Error).message}`));
      }
      await this.prisma.tenantRequirement.update({ where: { id: r.id }, data: { lastMatchedAt: new Date(), matchCount: { increment: 1 } } });
    }
    return reqs.length;
  }

  /** Tells agents when a new listing fits their open leads (own firm, or network for co-broking listings). */
  private async alertBrokers(l: Listing) {
    const leadWhere: Prisma.LeadWhereInput = {
      deletedAt: null,
      stage: { notIn: ['WON', 'LOST'] },
      ...(l.coBroking ? {} : { organizationId: l.organizationId ?? '__none__' }),
      requirement: {
        AND: [
          { OR: [{ bedrooms: { isEmpty: true } }, ...(l.bedrooms != null ? [{ bedrooms: { has: l.bedrooms } }] : [])] },
          { OR: [{ localityIds: { isEmpty: true } }, { localityIds: { has: l.localityId } }] },
          { OR: [{ maxBudget: null }, { maxBudget: { gte: l.price / 1.1 } }] },
          { OR: [{ minBudget: null }, { minBudget: { lte: l.price / 0.8 } }] },
          { OR: [{ purpose: null }, { purpose: 'RENT' }] },
        ],
      },
    };
    const leads = await this.prisma.lead.findMany({
      where: leadWhere,
      take: 200,
      select: { id: true, organizationId: true, assignedToId: true, requirement: true },
    });
    const fit = leads.filter(
      (ld) =>
        ld.requirement &&
        (ld.requirement.localityIds.length || ld.requirement.bedrooms.length || ld.requirement.maxBudget) &&
        isRequirementMatch(ld.requirement, l),
    );
    const byOrg = new Map<string, typeof fit>();
    for (const ld of fit) byOrg.set(ld.organizationId, [...(byOrg.get(ld.organizationId) ?? []), ld]);
    for (const [orgId, rows] of [...byOrg.entries()].slice(0, 30)) {
      const own = orgId === l.organizationId;
      const title = own ? `🏠 नई listing ${rows.length} leads से match करती है` : `🤝 Network listing ${rows.length} leads से match करती है`;
      const link = rows.length === 1 ? `/broker/leads/${rows[0].id}` : own ? '/broker/leads' : '/broker/network';
      const assignees = [...new Set(rows.map((r) => r.assignedToId).filter(Boolean))] as string[];
      if (assignees.length) await this.notifications.notify(assignees, { kind: 'LISTING_MATCH', title, body: l.title, link });
      else await this.notifications.notifyOrg(orgId, { kind: 'LISTING_MATCH', title, body: l.title, link }, { adminsOnly: true });
    }
    return fit.length;
  }
}
