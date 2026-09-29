import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, TokenStatus } from '@prisma/client';
import { formatINR, haversineKm, normalizeIndianPhone } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { AuditService } from '../../core/audit/audit.service';
import { LeadsService } from '../leads/leads.service';
import { randomOtp, requireOrg, sha256 } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';

/** Consumer mailboxes don't prove employment. */
export const FREE_EMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'rediffmail.com', 'zoho.com', 'zohomail.in', 'gmx.com', 'yandex.com', 'mail.com', 'tutanota.com']);

/** Max distance of an on-site photo from the listing pin (or locality centre when there's no pin). */
export const VISIT_RADIUS_M = { pin: 300, locality: 1500 };

export interface ReviewInput {
  societyName?: string | null;
  water: number;
  power: number;
  safety: number;
  parking: number;
  connectivity: number;
  maintenance: number;
  pros?: string | null;
  cons?: string | null;
  isResident?: boolean;
  livedYears?: number | null;
}
const DIMENSIONS = ['water', 'power', 'safety', 'parking', 'connectivity', 'maintenance'] as const;

/**
 * Trust features: on-site "Visit verified" listings, verified tenant profiles (work email / KYC),
 * resident locality & society reviews, and a manual record of token money paid to a broker.
 */
@Injectable()
export class TrustService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly leads: LeadsService,
  ) {}

  // ------------------------------------------------------------------ visit verification (BrokerIQ field team = super admins)
  async verificationQueue(near?: string) {
    const [lat, lng] = (near ?? '').split(',').map(Number);
    const rows = await this.prisma.listing.findMany({
      where: { status: 'ACTIVE', deletedAt: null, visitVerifiedAt: null },
      orderBy: { publishedAt: 'desc' },
      take: 300,
      select: { id: true, slug: true, title: true, coverUrl: true, address: true, societyName: true, latitude: true, longitude: true, locality: { select: { name: true, latitude: true, longitude: true } }, organization: { select: { name: true, phone: true } } },
    });
    const withDist = rows.map((l) => {
      const p = l.latitude != null && l.longitude != null ? { lat: l.latitude, lng: l.longitude } : { lat: l.locality.latitude, lng: l.locality.longitude };
      return { ...l, point: p, km: Number.isFinite(lat) && Number.isFinite(lng) ? Math.round(haversineKm({ lat, lng }, p) * 10) / 10 : null };
    });
    return withDist.sort((a, b) => (a.km ?? 0) - (b.km ?? 0)).slice(0, 60);
  }

  async verifyVisit(admin: RequestUser, listingId: string, photos: { url: string; lat: number; lng: number }[]) {
    const l = await this.prisma.listing.findUnique({ where: { id: listingId }, include: { locality: { select: { latitude: true, longitude: true } } } });
    if (!l || l.deletedAt) throw new NotFoundException();
    const pinned = l.latitude != null && l.longitude != null;
    const target = pinned ? { lat: l.latitude!, lng: l.longitude! } : { lat: l.locality.latitude, lng: l.locality.longitude };
    const limit = pinned ? VISIT_RADIUS_M.pin : VISIT_RADIUS_M.locality;
    const measured = photos.map((p) => ({ ...p, distanceM: Math.round(haversineKm(target, p) * 1000) }));
    if (!measured.some((p) => p.distanceM <= limit)) {
      throw new BadRequestException(`Photos property से दूर हैं (${measured.map((p) => `${p.distanceM}m`).join(', ')}) — ${limit}m के अंदर से photo लें`);
    }
    await this.prisma.listingVerificationPhoto.createMany({ data: measured.map((p) => ({ listingId, url: p.url, lat: p.lat, lng: p.lng, distanceM: p.distanceM, takenById: admin.id })) });
    const updated = await this.prisma.listing.update({ where: { id: listingId }, data: { visitVerifiedAt: new Date(), visitVerifiedById: admin.id }, select: { id: true, visitVerifiedAt: true } });
    await this.notifications.notify(l.postedById, { kind: 'VISIT_VERIFIED', title: '✅ आपकी listing "Visit verified" हुई', body: l.title, link: `/property/${l.slug}` });
    await this.audit.log(admin, 'listing.visit_verify', 'Listing', listingId, { photos: measured.length, bestM: Math.min(...measured.map((p) => p.distanceM)) });
    return { ...updated, photos: measured };
  }

  async removeVisitVerification(admin: RequestUser, listingId: string) {
    await this.prisma.listing.update({ where: { id: listingId }, data: { visitVerifiedAt: null, visitVerifiedById: null } });
    await this.audit.log(admin, 'listing.visit_unverify', 'Listing', listingId);
    return { ok: true };
  }

  // ------------------------------------------------------------------ verified tenant
  async tenantProfile(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { occupation: true, employer: true, workEmail: true, workEmailVerifiedAt: true, tenantVerifiedAt: true } });
    const kyc = await this.prisma.kycDocument.findMany({ where: { userId }, select: { id: true, docType: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    return { ...u, kyc };
  }

  updateTenantProfile(userId: string, body: { occupation?: string | null; employer?: string | null }) {
    return this.prisma.user.update({ where: { id: userId }, data: { occupation: body.occupation ?? undefined, employer: body.employer ?? undefined }, select: { occupation: true, employer: true } });
  }

  async requestWorkEmail(userId: string, raw: string) {
    const email = raw.trim().toLowerCase();
    const domain = email.split('@')[1] ?? '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestException('Email सही नहीं है');
    if (FREE_EMAIL_DOMAINS.has(domain)) throw new BadRequestException('Office / company का email डालें (Gmail, Yahoo वगैरह नहीं चलेंगे)');
    const recent = await this.prisma.otpCode.count({ where: { email, purpose: 'WORK_EMAIL', createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (recent >= 3) throw new BadRequestException('थोड़ी देर बाद फिर कोशिश करें');
    const code = randomOtp();
    await this.prisma.otpCode.create({ data: { email, purpose: 'WORK_EMAIL', codeHash: sha256(code), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    await this.prisma.user.update({ where: { id: userId }, data: { workEmail: email, workEmailVerifiedAt: null } });
    await this.mail.sendTemplate('auth.otp', email, { code });
    return { sent: true, email };
  }

  async verifyWorkEmail(userId: string, code: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { workEmail: true } });
    if (!u.workEmail) throw new BadRequestException('पहले office email डालें');
    const otp = await this.prisma.otpCode.findFirst({ where: { email: u.workEmail, purpose: 'WORK_EMAIL', consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.attempts >= 5) throw new BadRequestException('Code expire हो गया — दोबारा भेजें');
    if (otp.codeHash !== sha256(code.trim())) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Code गलत है');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    const now = new Date();
    return this.prisma.user.update({ where: { id: userId }, data: { workEmailVerifiedAt: now, tenantVerifiedAt: now }, select: { workEmail: true, workEmailVerifiedAt: true, tenantVerifiedAt: true } });
  }

  // ------------------------------------------------------------------ locality / society reviews
  async submitReview(user: RequestUser, localitySlug: string, body: ReviewInput) {
    const loc = await this.prisma.locality.findUnique({ where: { slug: localitySlug }, select: { id: true, name: true } });
    if (!loc) throw new NotFoundException('Locality नहीं मिली');
    const societyName = body.societyName?.trim() || '';
    const data = { ...body, societyName, status: 'PENDING' as const };
    const review = await this.prisma.localityReview.upsert({
      where: { localityId_userId_societyName: { localityId: loc.id, userId: user.id, societyName } },
      create: { ...data, localityId: loc.id, userId: user.id },
      update: data,
    });
    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await this.notifications.notify(admins.map((a) => a.id), { kind: 'REVIEW_PENDING', title: `नया locality review: ${loc.name}`, body: societyName || undefined, link: '/admin/locality-reviews', push: false });
    return review;
  }

  async publicReviews(localitySlug: string, society?: string) {
    const loc = await this.prisma.locality.findUnique({ where: { slug: localitySlug }, select: { id: true } });
    if (!loc) throw new NotFoundException();
    const where: Prisma.LocalityReviewWhereInput = { localityId: loc.id, status: 'APPROVED', ...(society ? { societyName: { equals: society, mode: 'insensitive' } } : {}) };
    const [items, agg] = await Promise.all([
      this.prisma.localityReview.findMany({ where, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.localityReview.aggregate({ where, _avg: { water: true, power: true, safety: true, parking: true, connectivity: true, maintenance: true }, _count: { _all: true } }),
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: items.map((i) => i.userId) } }, select: { id: true, name: true } });
    const avg = Object.fromEntries(DIMENSIONS.map((d) => [d, agg._avg[d] ? Math.round(agg._avg[d]! * 10) / 10 : null]));
    const vals = Object.values(avg).filter((v): v is number => v != null);
    return {
      count: agg._count._all,
      overall: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
      avg,
      items: items.map(({ userId, ...r }) => ({ ...r, author: (users.find((u) => u.id === userId)?.name ?? 'Resident').split(' ')[0] })),
    };
  }

  adminReviews(status = 'PENDING') {
    return this.prisma.localityReview.findMany({ where: { status: status as any }, orderBy: { createdAt: 'desc' }, take: 200, include: { locality: { select: { name: true, slug: true } } } });
  }

  async moderateReview(admin: RequestUser, id: string, status: 'APPROVED' | 'REJECTED') {
    const r = await this.prisma.localityReview.update({ where: { id }, data: { status } });
    await this.audit.log(admin, `locality_review.${status.toLowerCase()}`, 'LocalityReview', id);
    return r;
  }

  // ------------------------------------------------------------------ token money (manual record, no gateway)
  async tokenInfo(listingId: string) {
    const l = await this.prisma.listing.findFirst({ where: { id: listingId, status: 'ACTIVE', deletedAt: null }, select: { price: true, securityDeposit: true, tokenReceivedAt: true, organization: { select: { name: true, upiId: true, upiName: true } } } });
    if (!l) throw new NotFoundException();
    return { org: l.organization ? { name: l.organization.name, upiId: l.organization.upiId, upiName: l.organization.upiName } : null, rent: l.price, deposit: l.securityDeposit, alreadyTaken: !!l.tokenReceivedAt };
  }

  async claimToken(user: RequestUser, listingId: string, body: { amount: number; mode: string; ref?: string | null; notes?: string | null }) {
    const l = await this.prisma.listing.findFirst({ where: { id: listingId, status: 'ACTIVE', deletedAt: null }, select: { id: true, title: true, organizationId: true, postedById: true } });
    if (!l) throw new NotFoundException();
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, phone: true, email: true } });
    let leadId: string | null = null;
    if (l.organizationId && me.phone) {
      const { lead } = await this.leads.ingest({ orgId: l.organizationId, name: me.name, phone: me.phone, email: me.email, source: 'WEBSITE', sourceDetail: `Token paid: ${l.title}`, listingId: l.id, message: `Tenant ने ${formatINR(body.amount)} token देने की जानकारी दी (${body.mode}${body.ref ? `, ref ${body.ref}` : ''})` });
      leadId = lead.id;
    }
    const t = await this.prisma.tokenPayment.create({ data: { listingId: l.id, organizationId: l.organizationId, leadId, userId: user.id, amount: body.amount, mode: body.mode, ref: body.ref ?? null, notes: body.notes ?? null } });
    const note = { kind: 'TOKEN_CLAIMED', title: `💰 Token की जानकारी: ${formatINR(body.amount)}`, body: `${me.name} · ${l.title} — payment मिला हो तो confirm करें`, link: '/broker/tokens' };
    if (l.organizationId) await this.notifications.notifyOrg(l.organizationId, note, { adminsOnly: true });
    else await this.notifications.notify(l.postedById, { ...note, link: '/account/listings' });
    return t;
  }

  myTokens(userId: string) {
    return this.prisma.tokenPayment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { listing: { select: { title: true, slug: true } } } });
  }

  brokerTokens(user: RequestUser) {
    return this.prisma.tokenPayment.findMany({ where: { organizationId: requireOrg(user) }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200, include: { listing: { select: { id: true, title: true, slug: true } } } });
  }

  async markToken(user: RequestUser, id: string, status: Exclude<TokenStatus, 'CLAIMED'>, notes?: string | null) {
    const t = await this.prisma.tokenPayment.findUnique({ where: { id } });
    if (!t || t.organizationId !== requireOrg(user)) throw new NotFoundException();
    if (t.status === 'REFUNDED' || t.status === 'CANCELLED') throw new ForbiddenException('यह record बंद हो चुका है');
    const updated = await this.prisma.tokenPayment.update({ where: { id }, data: { status, markedById: user.id, notes: notes ?? t.notes } });
    if (status === 'RECEIVED') {
      await this.prisma.listing.update({ where: { id: t.listingId }, data: { tokenReceivedAt: new Date() } });
      if (t.leadId) {
        const lead = await this.prisma.lead.findUnique({ where: { id: t.leadId }, select: { stage: true } });
        if (lead && ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT'].includes(lead.stage)) await this.leads.changeStage(t.leadId, 'NEGOTIATION', user).catch(() => undefined);
      }
    } else {
      const stillHeld = await this.prisma.tokenPayment.count({ where: { listingId: t.listingId, status: 'RECEIVED', id: { not: id } } });
      if (!stillHeld) await this.prisma.listing.update({ where: { id: t.listingId }, data: { tokenReceivedAt: null } });
    }
    if (t.userId) {
      const titles = { RECEIVED: '✅ Broker ने token मिलने की पुष्टि की', REFUNDED: '↩️ Token refund दर्ज हुआ', CANCELLED: 'Token record cancel हुआ' };
      await this.notifications.notify(t.userId, { kind: 'TOKEN_UPDATE', title: titles[status], body: formatINR(t.amount), link: '/account/visits' });
    }
    await this.audit.log(user, `token.${status.toLowerCase()}`, 'TokenPayment', id);
    return updated;
  }

  normalizePhone(p?: string | null) {
    return p ? normalizeIndianPhone(p) ?? p : null;
  }
}
