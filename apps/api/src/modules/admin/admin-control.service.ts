import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { BlockKind, ListingStatus, Prisma } from '@prisma/client';
import { ORG_RESTRICTIONS, USER_RESTRICTIONS } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';
import { AccessService } from '../../core/access/access.service';
import { AuthService } from '../auth/auth.service';
import type { RequestUser } from '../../common/decorators';

/** Listings hidden because their account/firm was blocked carry this prefix, so unblocking restores only those. */
const ACCOUNT = 'ACCOUNT: ';
const FIRM = 'FIRM: ';
const LIVE: ListingStatus[] = ['ACTIVE', 'PENDING_REVIEW'];

export type BulkAction = 'block' | 'unblock' | 'approve' | 'reject' | 'delete' | 'restore' | 'verify' | 'unverify' | 'feature' | 'unfeature';

/** Super Admin / staff actions on listings, users, broker firms, the blocklist and user content. */
@Injectable()
export class AdminControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly access: AccessService,
    private readonly auth: AuthService,
  ) {}

  // ------------------------------------------------------------------ listings
  private async listingOrThrow(id: string, withDeleted = false) {
    const l = await this.prisma.listing.findFirst({ where: { id, ...(withDeleted ? {} : { deletedAt: null }) } });
    if (!l) throw new NotFoundException('Listing नहीं मिली');
    return l;
  }

  /** Tell whoever posted the listing (and the firm's admins). */
  private async tellOwner(l: { postedById: string | null; organizationId: string | null; title: string; id: string }, title: string, body?: string) {
    const link = l.organizationId ? '/broker/listings' : '/account/listings';
    if (l.postedById) await this.notifications.notify(l.postedById, { kind: 'LISTING_MODERATION', title, body, link, data: { listingId: l.id } }).catch(() => undefined);
    if (l.organizationId) await this.notifications.notifyOrg(l.organizationId, { kind: 'LISTING_MODERATION', title, body, link, data: { listingId: l.id } }, { adminsOnly: true }).catch(() => undefined);
  }

  async blockListing(actor: RequestUser, id: string, reason: string, notify = true) {
    const l = await this.listingOrThrow(id);
    if (l.status === 'BLOCKED') return l;
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: 'BLOCKED', statusBeforeBlock: l.status, blockedReason: reason, blockedAt: new Date(), blockedById: actor.id, isFeatured: false },
    });
    if (notify) await this.tellOwner(l, `🚫 Listing हटाई गई: ${l.title}`, reason);
    await this.audit.log(actor, 'listing.block', 'Listing', id, { reason });
    return updated;
  }

  async unblockListing(actor: RequestUser, id: string, notify = true) {
    const l = await this.listingOrThrow(id);
    if (l.status !== 'BLOCKED') return l;
    const status = l.statusBeforeBlock && l.statusBeforeBlock !== 'BLOCKED' ? l.statusBeforeBlock : 'PENDING_REVIEW';
    const updated = await this.prisma.listing.update({ where: { id }, data: { status, statusBeforeBlock: null, blockedReason: null, blockedAt: null, blockedById: null } });
    if (notify) await this.tellOwner(l, `✅ Listing वापस चालू: ${l.title}`);
    await this.audit.log(actor, 'listing.unblock', 'Listing', id, { status });
    return updated;
  }

  async setListingStatus(actor: RequestUser, id: string, status: 'ACTIVE' | 'RENTED' | 'EXPIRED' | 'ARCHIVED', expiryDays = 90) {
    const l = await this.listingOrThrow(id);
    const data: Prisma.ListingUpdateInput = { status, statusBeforeBlock: null, blockedReason: null, blockedAt: null, blockedById: null };
    if (status === 'ACTIVE') {
      data.publishedAt = l.publishedAt ?? new Date();
      data.expiresAt = new Date(Date.now() + expiryDays * 86400_000);
    }
    const updated = await this.prisma.listing.update({ where: { id }, data });
    await this.audit.log(actor, 'listing.status', 'Listing', id, { from: l.status, to: status });
    return updated;
  }

  async deleteListing(actor: RequestUser, id: string) {
    await this.listingOrThrow(id);
    await this.prisma.listing.update({ where: { id }, data: { deletedAt: new Date(), isFeatured: false } });
    await this.audit.log(actor, 'listing.delete', 'Listing', id);
    return { ok: true };
  }

  async restoreListing(actor: RequestUser, id: string) {
    const l = await this.listingOrThrow(id, true);
    if (!l.deletedAt) return l;
    const updated = await this.prisma.listing.update({ where: { id }, data: { deletedAt: null } });
    await this.audit.log(actor, 'listing.restore', 'Listing', id);
    return updated;
  }

  /** Move a listing to another firm and/or poster (e.g. owner handed it to a broker). */
  async transferListing(actor: RequestUser, id: string, to: { organizationId?: string | null; postedById?: string }) {
    await this.listingOrThrow(id);
    if (to.organizationId && !(await this.prisma.organization.findUnique({ where: { id: to.organizationId }, select: { id: true } }))) throw new BadRequestException('Firm नहीं मिली');
    if (to.postedById && !(await this.prisma.user.findUnique({ where: { id: to.postedById }, select: { id: true } }))) throw new BadRequestException('User नहीं मिला');
    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        ...(to.organizationId !== undefined ? { organizationId: to.organizationId, postedByType: to.organizationId ? 'BROKER' : 'OWNER' } : {}),
        ...(to.postedById ? { postedById: to.postedById } : {}),
      },
    });
    await this.audit.log(actor, 'listing.transfer', 'Listing', id, to);
    return updated;
  }

  async bulkListings(actor: RequestUser, ids: string[], action: BulkAction, reason?: string) {
    const done: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of [...new Set(ids)]) {
      try {
        switch (action) {
          case 'block':
            await this.blockListing(actor, id, reason || 'BrokerIQ नियमों के अनुसार हटाई गई');
            break;
          case 'unblock':
            await this.unblockListing(actor, id);
            break;
          case 'approve':
            await this.setListingStatus(actor, id, 'ACTIVE');
            break;
          case 'reject': {
            const l = await this.listingOrThrow(id);
            await this.prisma.listing.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason ?? null } });
            await this.tellOwner(l, `Listing approve नहीं हुई: ${l.title}`, reason);
            break;
          }
          case 'delete':
            await this.deleteListing(actor, id);
            break;
          case 'restore':
            await this.restoreListing(actor, id);
            break;
          case 'verify':
          case 'unverify':
            await this.prisma.listing.update({ where: { id }, data: { isVerified: action === 'verify' } });
            break;
          case 'feature':
          case 'unfeature':
            await this.prisma.listing.update({ where: { id }, data: { isFeatured: action === 'feature', featuredUntil: action === 'feature' ? new Date(Date.now() + 30 * 86400_000) : null } });
            break;
        }
        done.push(id);
      } catch (e) {
        failed.push({ id, error: (e as Error).message });
      }
    }
    await this.audit.log(actor, `listing.bulk.${action}`, 'Listing', null, { count: done.length, failed: failed.length, reason });
    return { done: done.length, failed };
  }

  // ------------------------------------------------------------------ users
  private async userOrThrow(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u || u.status === 'DELETED') throw new NotFoundException('User नहीं मिला');
    return u;
  }

  /** Staff can't act on Super Admins (only another Super Admin, and never on themselves). */
  private guardTarget(actor: RequestUser, target: { id: string; role: string }) {
    if (target.id === actor.id) throw new ForbiddenException('अपने account पर यह action नहीं कर सकते');
    if (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') throw new ForbiddenException('Super Admin पर यह action नहीं हो सकता');
  }

  async userOverview(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, role: true, status: true, blockedReason: true, restrictions: true, avatarUrl: true, createdAt: true, lastLoginAt: true, emailVerified: true,
        tenantVerifiedAt: true, workEmailVerifiedAt: true, organization: { select: { id: true, name: true, slug: true, status: true } },
      },
    });
    if (!user) throw new NotFoundException('User नहीं मिला');
    const [listings, enquiries, reports, reviews, sessions, recentLogins] = await Promise.all([
      this.prisma.listing.findMany({ where: { postedById: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, slug: true, title: true, status: true, price: true, deletedAt: true, createdAt: true } }),
      this.prisma.enquiry.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, createdAt: true, listing: { select: { title: true, slug: true } } } }),
      this.prisma.listingReport.count({ where: { userId: id } }),
      this.prisma.review.count({ where: { userId: id } }),
      this.prisma.refreshToken.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.auditLog.findMany({ where: { actorId: id, action: 'auth.login' }, orderBy: { createdAt: 'desc' }, take: 5, select: { createdAt: true, ip: true } }),
    ]);
    return { user, listings, enquiries, counts: { reports, reviews, activeSessions: sessions }, recentLogins };
  }

  async blockUser(actor: RequestUser, id: string, reason: string) {
    const u = await this.userOrThrow(id);
    this.guardTarget(actor, u);
    await this.prisma.user.update({ where: { id }, data: { status: 'SUSPENDED', blockedReason: reason } });
    await this.auth.revokeAll(id);
    // The user's own (owner) listings go down with the account.
    const own = await this.prisma.listing.findMany({ where: { postedById: id, organizationId: null, deletedAt: null, status: { in: LIVE } }, select: { id: true } });
    for (const l of own) await this.blockListing(actor, l.id, ACCOUNT + reason, false);
    await this.mailUser(u.email, 'आपका BrokerIQ account block किया गया है', `कारण: ${reason}. सवाल हो तो BrokerIQ support से संपर्क करें।`);
    await this.audit.log(actor, 'user.block', 'User', id, { reason, listings: own.length });
    return { ok: true, listingsHidden: own.length };
  }

  async unblockUser(actor: RequestUser, id: string) {
    const u = await this.userOrThrow(id);
    await this.prisma.user.update({ where: { id }, data: { status: 'ACTIVE', blockedReason: null } });
    const hidden = await this.prisma.listing.findMany({ where: { postedById: id, status: 'BLOCKED', blockedReason: { startsWith: ACCOUNT } }, select: { id: true } });
    for (const l of hidden) await this.unblockListing(actor, l.id, false);
    await this.mailUser(u.email, 'आपका BrokerIQ account फिर से चालू है', 'अब आप login करके BrokerIQ इस्तेमाल कर सकते हैं।');
    await this.audit.log(actor, 'user.unblock', 'User', id, { listings: hidden.length });
    return { ok: true, listingsRestored: hidden.length };
  }

  async forceLogout(actor: RequestUser, id: string) {
    const u = await this.userOrThrow(id);
    this.guardTarget(actor, u);
    await this.auth.revokeAll(id);
    await this.audit.log(actor, 'user.force_logout', 'User', id);
    return { ok: true };
  }

  async sendPasswordReset(actor: RequestUser, id: string) {
    const u = await this.userOrThrow(id);
    await this.auth.requestOtp(u.email, 'RESET_PASSWORD');
    await this.audit.log(actor, 'user.password_reset', 'User', id);
    return { ok: true, email: u.email };
  }

  async setUserRestrictions(actor: RequestUser, id: string, restrictions: string[]) {
    const u = await this.userOrThrow(id);
    this.guardTarget(actor, u);
    const valid = restrictions.filter((r) => r in USER_RESTRICTIONS);
    await this.prisma.user.update({ where: { id }, data: { restrictions: valid } });
    await this.audit.log(actor, 'user.restrictions', 'User', id, { restrictions: valid });
    return { restrictions: valid };
  }

  async deleteUser(actor: RequestUser, id: string) {
    const u = await this.userOrThrow(id);
    this.guardTarget(actor, u);
    if (u.role === 'SUPER_ADMIN') throw new ForbiddenException('Super Admin account delete नहीं हो सकता');
    await this.auth.deleteAccount(id);
    await this.audit.log(actor, 'user.delete', 'User', id);
    return { ok: true };
  }

  // ------------------------------------------------------------------ broker firms
  private async orgOrThrow(id: string) {
    const o = await this.prisma.organization.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Firm नहीं मिली');
    return o;
  }

  async blockOrg(actor: RequestUser, id: string, reason: string) {
    const org = await this.orgOrThrow(id);
    await this.prisma.organization.update({ where: { id }, data: { status: 'SUSPENDED', blockedReason: reason } });
    const members = await this.prisma.user.findMany({ where: { organizationId: id }, select: { id: true, email: true, role: true } });
    for (const m of members) await this.auth.revokeAll(m.id);
    const live = await this.prisma.listing.findMany({ where: { organizationId: id, deletedAt: null, status: { in: LIVE } }, select: { id: true } });
    for (const l of live) await this.blockListing(actor, l.id, FIRM + reason, false);
    for (const m of members.filter((x) => x.role === 'BROKER_ADMIN')) await this.mailUser(m.email, `${org.name} का BrokerIQ account block किया गया है`, `कारण: ${reason}. सवाल हो तो BrokerIQ support से संपर्क करें।`);
    await this.audit.log(actor, 'organization.block', 'Organization', id, { reason, listings: live.length, members: members.length });
    return { ok: true, listingsHidden: live.length, membersLoggedOut: members.length };
  }

  async unblockOrg(actor: RequestUser, id: string) {
    const org = await this.orgOrThrow(id);
    await this.prisma.organization.update({ where: { id }, data: { status: 'ACTIVE', blockedReason: null } });
    const hidden = await this.prisma.listing.findMany({ where: { organizationId: id, status: 'BLOCKED', blockedReason: { startsWith: FIRM } }, select: { id: true } });
    for (const l of hidden) await this.unblockListing(actor, l.id, false);
    await this.notifications.notifyOrg(id, { kind: 'ACCOUNT', title: `✅ ${org.name} का account फिर से चालू है`, link: '/broker' }, { adminsOnly: true }).catch(() => undefined);
    await this.audit.log(actor, 'organization.unblock', 'Organization', id, { listings: hidden.length });
    return { ok: true, listingsRestored: hidden.length };
  }

  async setOrgRestrictions(actor: RequestUser, id: string, restrictions: string[]) {
    await this.orgOrThrow(id);
    const valid = restrictions.filter((r) => r in ORG_RESTRICTIONS);
    await this.prisma.organization.update({ where: { id }, data: { restrictions: valid } });
    await this.audit.log(actor, 'organization.restrictions', 'Organization', id, { restrictions: valid });
    return { restrictions: valid };
  }

  /** Take a member out of a firm (they keep a normal user account). */
  async removeMember(actor: RequestUser, orgId: string, userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, organizationId: orgId } });
    if (!u) throw new NotFoundException('Member नहीं मिला');
    await this.prisma.user.update({ where: { id: userId }, data: { organizationId: null, role: 'USER' } });
    await this.auth.revokeAll(userId);
    await this.audit.log(actor, 'organization.remove_member', 'Organization', orgId, { userId });
    return { ok: true };
  }

  // ------------------------------------------------------------------ blocklist
  listBlocklist() {
    return this.prisma.blocklist.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  }

  async addBlock(actor: RequestUser, kind: BlockKind, value: string, reason?: string) {
    const v = AccessService.normalize(kind, value);
    if (!v) throw new BadRequestException('Value खाली है');
    const row = await this.prisma.blocklist.upsert({ where: { kind_value: { kind, value: v } }, create: { kind, value: v, reason, createdById: actor.id }, update: { reason } });
    this.access.invalidate();
    // Existing accounts using that identity, so the admin can block them too.
    const matches = await this.prisma.user.findMany({
      where: { status: { not: 'DELETED' }, ...(kind === 'EMAIL' ? { email: v } : kind === 'DOMAIN' ? { email: { endsWith: `@${v}` } } : kind === 'PHONE' ? { phone: { endsWith: v.slice(-10) } } : { id: '__none__' }) },
      select: { id: true, name: true, email: true, status: true },
      take: 20,
    });
    await this.audit.log(actor, 'blocklist.add', 'Blocklist', row.id, { kind, value: v, reason });
    return { ...row, matchingUsers: matches };
  }

  async removeBlock(actor: RequestUser, id: string) {
    const row = await this.prisma.blocklist.delete({ where: { id } }).catch(() => null);
    if (!row) throw new NotFoundException();
    this.access.invalidate();
    await this.audit.log(actor, 'blocklist.remove', 'Blocklist', id, { kind: row.kind, value: row.value });
    return { ok: true };
  }

  // ------------------------------------------------------------------ user content
  listReviews(status?: 'PUBLISHED' | 'HIDDEN') {
    return this.prisma.review.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, name: true, email: true } }, organization: { select: { id: true, name: true, slug: true } } },
    });
  }

  async setReviewStatus(actor: RequestUser, id: string, status: 'PUBLISHED' | 'HIDDEN') {
    const r = await this.prisma.review.update({ where: { id }, data: { status } });
    await this.recomputeRating(r.organizationId);
    await this.audit.log(actor, `review.${status === 'HIDDEN' ? 'hide' : 'publish'}`, 'Review', id);
    return r;
  }

  async deleteReview(actor: RequestUser, id: string) {
    const r = await this.prisma.review.delete({ where: { id } });
    await this.recomputeRating(r.organizationId);
    await this.audit.log(actor, 'review.delete', 'Review', id);
    return { ok: true };
  }

  private async recomputeRating(orgId: string) {
    const agg = await this.prisma.review.aggregate({ where: { organizationId: orgId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: true });
    await this.prisma.organization.update({ where: { id: orgId }, data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count } });
  }

  async listFlatmates(active?: boolean) {
    const rows = await this.prisma.flatmateProfile.findMany({ where: active === undefined ? {} : { isActive: active }, orderBy: { updatedAt: 'desc' }, take: 200 });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, email: true, phone: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({ ...r, user: byId.get(r.userId) ?? null }));
  }

  async setFlatmateActive(actor: RequestUser, id: string, isActive: boolean) {
    const f = await this.prisma.flatmateProfile.update({ where: { id }, data: { isActive } });
    await this.audit.log(actor, isActive ? 'flatmate.show' : 'flatmate.hide', 'FlatmateProfile', id);
    return f;
  }

  /** Staff-queue counts for the admin dashboard. */
  async pendingCounts() {
    const [pendingListings, reportsOpen, localityReviews, errorsOpen, blockedListings, kycPending] = await Promise.all([
      this.prisma.listing.count({ where: { status: 'PENDING_REVIEW', deletedAt: null } }),
      this.prisma.listingReport.count({ where: { status: 'OPEN' } }).catch(() => 0),
      this.prisma.localityReview.count({ where: { status: 'PENDING' } }).catch(() => 0),
      this.prisma.errorLog.count({ where: { resolvedAt: null } }),
      this.prisma.listing.count({ where: { status: 'BLOCKED', deletedAt: null } }),
      this.prisma.kycDocument.count({ where: { status: 'PENDING' } }).catch(() => 0),
    ]);
    return { pendingListings, reportsOpen, localityReviews, errorsOpen, blockedListings, kycPending };
  }

  private async mailUser(email: string | null, subject: string, text: string) {
    if (!email || email.endsWith('@brokeriq.invalid')) return;
    await this.mail.send({ to: email, subject, html: `<p>${text.replace(/</g, '&lt;')}</p>` }).catch(() => undefined);
  }
}
