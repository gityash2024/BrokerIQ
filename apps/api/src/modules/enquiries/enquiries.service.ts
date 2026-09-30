import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeIndianPhone, type EnquiryInput } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import type { RequestUser } from '../../common/decorators';
import { env } from '../../config/env';
import { AccessService } from '../../core/access/access.service';

@Injectable()
export class EnquiriesService {
  constructor(
    private readonly access: AccessService,
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  /**
   * Website/app enquiry. Routing:
   *  - broker listing / broker microsite → Lead in that broker's CRM (automation runs)
   *  - owner listing → owner's enquiry inbox + notification
   *  - project → super admins
   */
  async create(input: EnquiryInput, user?: RequestUser) {
    await this.access.assertNotBlocked({ email: input.email ?? user?.email, phone: input.phone });
    await this.access.assertAllowed(user, 'enquire');
    const phone = normalizeIndianPhone(input.phone);
    if (!phone) throw new BadRequestException('Valid mobile number डालें');
    let orgId = input.organizationId ?? null;
    let ownerUserId: string | null = null;
    let listing = null as null | { id: string; title: string; slug: string; organizationId: string | null; postedById: string; postedByType: string };
    if (input.listingId) {
      listing = await this.prisma.listing.findFirst({ where: { id: input.listingId, status: 'ACTIVE', deletedAt: null }, select: { id: true, title: true, slug: true, organizationId: true, postedById: true, postedByType: true } });
      if (!listing) throw new NotFoundException('Property अब उपलब्ध नहीं है');
      orgId = listing.organizationId;
      if (!orgId) ownerUserId = listing.postedById;
    } else if (orgId) {
      const org = await this.prisma.organization.findFirst({ where: { id: orgId, status: 'ACTIVE' } });
      if (!org) throw new NotFoundException('Broker नहीं मिला');
    } else if (!input.projectId) {
      throw new BadRequestException('listingId, organizationId या projectId ज़रूरी है');
    }
    if (user && ownerUserId === user.id) throw new ForbiddenException('अपनी ही property पर enquiry नहीं कर सकते');

    const enquiry = await this.prisma.enquiry.create({
      data: {
        listingId: listing?.id,
        projectId: input.projectId,
        organizationId: orgId,
        ownerUserId,
        userId: user?.id,
        name: input.name,
        phone,
        email: input.email || null,
        message: input.message,
        wantsVisit: input.wantsVisit,
        visitDate: input.visitDate ? new Date(input.visitDate) : null,
        source: input.source,
      },
    });
    if (listing) await this.prisma.listing.update({ where: { id: listing.id }, data: { enquiryCount: { increment: 1 } } });

    if (orgId) {
      const { lead } = await this.leads.ingest({
        orgId,
        name: input.name,
        phone,
        email: input.email || null,
        source: input.source === 'MICROSITE' ? 'MICROSITE' : 'WEBSITE',
        sourceRef: enquiry.id,
        sourceDetail: listing ? listing.title : input.source === 'MICROSITE' ? 'Microsite contact form' : 'Website enquiry',
        listingId: listing?.id,
        message: [input.message, input.wantsVisit ? `Site visit requested${input.visitDate ? ` on ${new Date(input.visitDate).toLocaleDateString('en-IN')}` : ''}` : ''].filter(Boolean).join('\n') || null,
      });
      await this.prisma.enquiry.update({ where: { id: enquiry.id }, data: { leadId: lead.id } });
      // Verified tenants (work email / KYC) are flagged so brokers can prioritise them.
      if (user && !lead.tags.includes('verified-tenant')) {
        const u = await this.prisma.user.findUnique({ where: { id: user.id }, select: { tenantVerifiedAt: true } });
        if (u?.tenantVerifiedAt) await this.prisma.lead.update({ where: { id: lead.id }, data: { tags: { push: 'verified-tenant' } } });
      }
    } else if (ownerUserId) {
      await this.notifications.notify(ownerUserId, { kind: 'ENQUIRY', title: `नई enquiry: ${input.name}`, body: listing?.title, link: '/account/enquiries?tab=received', data: { enquiryId: enquiry.id } });
      const owner = await this.prisma.user.findUnique({ where: { id: ownerUserId } });
      if (owner) this.mail.trySendTemplate('enquiry.owner', owner.email, { listing, enquiry: { ...enquiry, phone }, link: `${env().PUBLIC_WEB_URL}/account/enquiries?tab=received` }).catch(() => undefined);
    } else if (input.projectId) {
      const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
      await this.notifications.notify(admins.map((a) => a.id), { kind: 'ENQUIRY', title: `Project enquiry: ${input.name}`, body: phone, link: '/admin/enquiries' });
    }
    return { ok: true, id: enquiry.id };
  }

  sent(userId: string) {
    return this.prisma.enquiry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true, slug: true, coverUrl: true, price: true, purpose: true, locality: { select: { name: true } } } },
        organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
        project: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  received(userId: string) {
    return this.prisma.enquiry.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: { listing: { select: { id: true, title: true, slug: true, coverUrl: true } } },
    });
  }

  async setStatus(id: string, status: 'NEW' | 'RESPONDED' | 'CLOSED', user: RequestUser) {
    const e = await this.prisma.enquiry.findFirst({ where: { id, ownerUserId: user.id } });
    if (!e) throw new NotFoundException();
    return this.prisma.enquiry.update({ where: { id }, data: { status } });
  }

  adminList(q: { page?: number; projectOnly?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    return this.prisma.enquiry.findMany({
      where: q.projectOnly === 'true' ? { projectId: { not: null } } : {},
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
      include: { listing: { select: { title: true, slug: true } }, project: { select: { name: true, slug: true } }, organization: { select: { name: true } } },
    });
  }
}
