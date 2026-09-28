import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, hkdfSync } from 'crypto';
import type { ConsentKind } from '@prisma/client';
import { PRIVACY_POLICY_VERSION, normalizeIndianPhone } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../core/settings/crypto.service';
import { AuditService } from '../../core/audit/audit.service';
import { env } from '../../config/env';
import type { RequestUser } from '../../common/decorators';

const MAX_LOCATIONS_PER_USER = 50;

/**
 * Consent-based location & phonebook data. Collected only after an explicit opt-in,
 * readable only by Super Admins (every read is audit-logged) and deleted on withdrawal.
 */
@Injectable()
export class PrivacyService {
  private readonly hashKey = Buffer.from(hkdfSync('sha256', Buffer.from(env().ENCRYPTION_MASTER_KEY, 'hex'), 'brokeriq', 'brokeriq-contacts-hash-v1', 32));

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  private phoneHash(phone: string) {
    return createHmac('sha256', this.hashKey).update(phone).digest('hex');
  }

  /** Latest decision per kind (null = never asked for this policy version). */
  async status(userId: string) {
    const [loc, con, contacts, lastLoc] = await Promise.all([
      this.prisma.userConsent.findFirst({ where: { userId, kind: 'LOCATION' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.userConsent.findFirst({ where: { userId, kind: 'CONTACTS' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.userContact.count({ where: { userId } }),
      this.prisma.userLocation.findFirst({ where: { userId }, orderBy: { capturedAt: 'desc' }, select: { capturedAt: true } }),
    ]);
    const view = (c: typeof loc) => (c ? { granted: c.granted, at: c.createdAt, current: c.policyVersion === PRIVACY_POLICY_VERSION } : null);
    return { policyVersion: PRIVACY_POLICY_VERSION, location: view(loc), contacts: view(con), contactsCount: contacts, lastLocationAt: lastLoc?.capturedAt ?? null };
  }

  private async granted(userId: string, kind: ConsentKind) {
    const c = await this.prisma.userConsent.findFirst({ where: { userId, kind }, orderBy: { createdAt: 'desc' } });
    return !!c?.granted;
  }

  async setConsent(user: RequestUser, kind: ConsentKind, granted: boolean, platform?: string, ip?: string) {
    await this.prisma.userConsent.create({ data: { userId: user.id, kind, granted, policyVersion: PRIVACY_POLICY_VERSION, platform, ip } });
    if (!granted) await this.deleteData(user.id, kind);
    await this.audit.log(user, granted ? 'privacy.consent.grant' : 'privacy.consent.withdraw', 'User', user.id, { kind, platform }, ip);
    return this.status(user.id);
  }

  async deleteData(userId: string, kind: ConsentKind) {
    if (kind === 'LOCATION') await this.prisma.userLocation.deleteMany({ where: { userId } });
    else await this.prisma.userContact.deleteMany({ where: { userId } });
  }

  async addLocation(user: RequestUser, p: { latitude: number; longitude: number; accuracy?: number | null; platform: string }) {
    if (!(await this.granted(user.id, 'LOCATION'))) throw new ForbiddenException('Location sharing की अनुमति नहीं दी गई है');
    await this.prisma.userLocation.create({ data: { userId: user.id, latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy ?? null, source: p.platform } });
    const old = await this.prisma.userLocation.findMany({ where: { userId: user.id }, orderBy: { capturedAt: 'desc' }, skip: MAX_LOCATIONS_PER_USER, select: { id: true } });
    if (old.length) await this.prisma.userLocation.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return { ok: true };
  }

  async syncContacts(user: RequestUser, contacts: { name?: string | null; phones: string[]; emails: string[] }[]) {
    if (!(await this.granted(user.id, 'CONTACTS'))) throw new ForbiddenException('Contacts sharing की अनुमति नहीं दी गई है');
    const byHash = new Map<string, { name: string | null; phone: string; email: string | null }>();
    for (const c of contacts) {
      for (const raw of c.phones) {
        const phone = normalizeIndianPhone(raw) ?? raw.replace(/[^\d+]/g, '');
        if (phone.replace(/\D/g, '').length < 7) continue;
        byHash.set(this.phoneHash(phone), { name: c.name?.trim() || null, phone, email: c.emails[0]?.trim().toLowerCase() || null });
      }
    }
    const now = new Date();
    for (const [phoneHash, c] of byHash) {
      const data = { nameEnc: c.name ? this.crypto.encrypt(c.name) : null, phoneEnc: this.crypto.encrypt(c.phone), emailEnc: c.email ? this.crypto.encrypt(c.email) : null, syncedAt: now };
      await this.prisma.userContact.upsert({ where: { userId_phoneHash: { userId: user.id, phoneHash } }, create: { userId: user.id, phoneHash, ...data }, update: data });
    }
    return { synced: byHash.size, total: await this.prisma.userContact.count({ where: { userId: user.id } }) };
  }

  // ------------------------------------------------------------------ Super Admin only

  async adminList(q: { q?: string; page?: number }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = 30;
    const consenting = await this.prisma.userConsent.findMany({ distinct: ['userId'], select: { userId: true } });
    const ids = consenting.map((c) => c.userId);
    const where = { id: { in: ids }, ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' as const } }, { email: { contains: q.q, mode: 'insensitive' as const } }, { phone: { contains: q.q } }] } : {}) };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, organization: { select: { name: true } }, _count: { select: { contacts: true, locations: true } } } }),
      this.prisma.user.count({ where }),
    ]);
    const items = await Promise.all(
      users.map(async (u) => {
        const s = await this.status(u.id);
        const last = await this.prisma.userLocation.findFirst({ where: { userId: u.id }, orderBy: { capturedAt: 'desc' } });
        return { ...u, consent: { location: s.location?.granted ?? null, contacts: s.contacts?.granted ?? null }, lastLocation: last };
      }),
    );
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /** Latest location of every user who currently shares it (for the admin map). */
  async adminMap() {
    const rows = await this.prisma.$queryRaw<{ userId: string; latitude: number; longitude: number; capturedAt: Date; name: string }[]>`
      SELECT DISTINCT ON (l."userId") l."userId", l.latitude, l.longitude, l."capturedAt", u.name
      FROM "UserLocation" l JOIN "User" u ON u.id = l."userId"
      ORDER BY l."userId", l."capturedAt" DESC`;
    return rows;
  }

  async adminDetail(admin: RequestUser, userId: string, q: { q?: string } = {}, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, lastLoginAt: true, organization: { select: { name: true } } } });
    if (!user) throw new NotFoundException();
    const [consents, locations, contacts] = await Promise.all([
      this.prisma.userConsent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.userLocation.findMany({ where: { userId }, orderBy: { capturedAt: 'desc' }, take: MAX_LOCATIONS_PER_USER }),
      this.decryptedContacts(userId),
    ]);
    const needle = q.q?.toLowerCase();
    const filtered = needle ? contacts.filter((c) => [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(needle))) : contacts;
    await this.audit.log(admin, 'privacy.admin.view', 'User', userId, { contacts: contacts.length, locations: locations.length }, ip);
    return { user, consents, locations, contacts: filtered, contactsTotal: contacts.length };
  }

  async adminCsv(admin: RequestUser, userId: string, ip?: string) {
    const contacts = await this.decryptedContacts(userId);
    await this.audit.log(admin, 'privacy.admin.export', 'User', userId, { contacts: contacts.length }, ip);
    const esc = (v: string | null) => (v == null ? '' : `"${v.replace(/"/g, '""')}"`);
    return ['name,phone,email,synced_at', ...contacts.map((c) => [esc(c.name), esc(c.phone), esc(c.email), c.syncedAt.toISOString()].join(','))].join('\n');
  }

  private async decryptedContacts(userId: string) {
    const rows = await this.prisma.userContact.findMany({ where: { userId }, orderBy: { syncedAt: 'desc' } });
    const dec = (v: string | null) => {
      if (!v) return null;
      try {
        return this.crypto.decrypt(v);
      } catch {
        return null;
      }
    };
    return rows.map((r) => ({ id: r.id, name: dec(r.nameEnc), phone: dec(r.phoneEnc), email: dec(r.emailEnc), syncedAt: r.syncedAt })).sort((a, b) => (a.name ?? '~').localeCompare(b.name ?? '~'));
  }
}
