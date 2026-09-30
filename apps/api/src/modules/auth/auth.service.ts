import { ForbiddenException, HttpStatus, Injectable, Logger, OnApplicationBootstrap, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import type { Organization, User } from '@prisma/client';
import { ErrorCode, slugify, type AuthResponse, type AuthUser, type RegisterInput } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../core/settings/settings.service';
import { MailService } from '../../core/mail/mail.service';
import { AuditService } from '../../core/audit/audit.service';
import { BrokerInvitesService } from './broker-invites.service';
import type { BrokerInvite } from '@prisma/client';
import { AppException, IntegrationNotConfiguredException } from '../../common/exceptions';
import { randomOtp, randomToken, sha256, shortCode } from '../../common/utils';
import { env } from '../../config/env';
import { AccessService } from '../../core/access/access.service';

type UserWithOrg = User & { organization: Organization | null };
interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly access: AccessService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly invites: BrokerInvitesService,
  ) {}

  /** Ensure the Super Admin from env exists (idempotent). */
  async onApplicationBootstrap() {
    const { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME } = env();
    if (!SUPER_ADMIN_EMAIL) return;
    const email = SUPER_ADMIN_EMAIL.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await this.prisma.user.create({
        data: {
          email,
          name: SUPER_ADMIN_NAME,
          role: 'SUPER_ADMIN',
          emailVerified: true,
          passwordHash: SUPER_ADMIN_PASSWORD ? await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12) : null,
        },
      });
      this.logger.log(`Super Admin created: ${email}`);
    } else if (existing.role !== 'SUPER_ADMIN') {
      await this.prisma.user.update({ where: { id: existing.id }, data: { role: 'SUPER_ADMIN', organizationId: null } });
    }
  }

  // ------------------------------------------------------------------ helpers
  toAuthUser(u: UserWithOrg): AuthUser {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
      role: u.role,
      organizationId: u.organizationId,
      emailVerified: u.emailVerified,
      locale: u.locale,
      organization: u.organization ? { id: u.organization.id, name: u.organization.name, slug: u.organization.slug, logoUrl: u.organization.logoUrl, onboarded: u.organization.onboarded } : null,
    };
  }

  async issue(user: UserWithOrg, meta: ClientMeta = {}): Promise<AuthResponse> {
    if (user.status !== 'ACTIVE') throw new ForbiddenException('यह account suspend है। Support से संपर्क करें।');
    if (user.organization?.status === 'SUSPENDED' && user.role !== 'SUPER_ADMIN') throw new ForbiddenException('आपकी firm का account suspend है। Support से संपर्क करें।');
    const accessToken = this.jwt.sign({ sub: user.id, role: user.role, orgId: user.organizationId, email: user.email });
    const refreshToken = randomToken(48);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + env().REFRESH_TTL_DAYS * 86400_000), ip: meta.ip, userAgent: meta.userAgent?.slice(0, 250) },
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const decoded: any = this.jwt.decode(accessToken);
    return { accessToken, refreshToken, expiresIn: decoded.exp - decoded.iat, user: this.toAuthUser(user) };
  }

  private findUser(where: { id?: string; email?: string; googleId?: string }) {
    return this.prisma.user.findFirst({ where: { ...where, deletedAt: null }, include: { organization: true } });
  }

  private async uniqueOrgSlug(name: string) {
    const base = slugify(name) || 'broker';
    let slug = base;
    for (let i = 0; await this.prisma.organization.findUnique({ where: { slug } }); i++) slug = `${base}-${shortCode(4).toLowerCase()}`;
    return slug;
  }

  /** Creates a broker firm for the user and makes them BROKER_ADMIN with the default plan. */
  async createBrokerOrg(userId: string, firmName: string, tx = this.prisma, invite: BrokerInvite | null = null) {
    const org = await tx.organization.create({ data: { name: firmName, slug: await this.uniqueOrgSlug(firmName) } });
    const granted = await this.invites.grantedPlan(invite, tx);
    if (granted) {
      await tx.subscription.create({ data: { organizationId: org.id, planId: granted.plan.id, status: 'ACTIVE', currentPeriodEnd: granted.periodEnd } });
    }
    if (invite) await this.invites.consume(invite, org.id, tx);
    const plan = granted ? null : (await tx.plan.findFirst({ where: { isActive: true, priceMonthly: 0 }, orderBy: { sortOrder: 'asc' } })) ?? (await tx.plan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }));
    if (plan) {
      await tx.subscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: plan.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
          trialEndsAt: plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 86400_000) : null,
        },
      });
    }
    await tx.user.update({ where: { id: userId }, data: { organizationId: org.id, role: 'BROKER_ADMIN' } });
    return org;
  }

  /** Open signup or a valid invite code; returns the invite to consume (if any). */
  brokerGate(inviteCode?: string | null) {
    return this.invites.gate(inviteCode);
  }

  // ------------------------------------------------------------------ flows
  async register(input: RegisterInput, meta: ClientMeta) {
    await this.access.assertNotBlocked({ email: input.email, phone: input.phone, ip: meta.ip });
    const app = await this.settings.getAppConfig();
    if (!app.auth.allowPasswordLogin) throw new ForbiddenException('Password signup बंद है — Email OTP से login करें।');
    const invite = input.accountType === 'BROKER' ? await this.brokerGate(input.inviteCode) : null;
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'इस email से account पहले से है — login करें।');
    const user = await this.prisma.user.create({
      data: { name: input.name, email: input.email, phone: input.phone, passwordHash: await bcrypt.hash(input.password, 12) },
    });
    if (input.accountType === 'BROKER') await this.createBrokerOrg(user.id, input.firmName || `${input.name} Realty`, this.prisma, invite);
    await this.audit.log({ id: user.id, role: user.role }, 'auth.register', 'User', user.id, { accountType: input.accountType }, meta.ip);
    this.requestOtp(input.email, 'VERIFY_EMAIL').catch(() => undefined);
    return this.issue((await this.findUser({ id: user.id }))!, meta);
  }

  async login(email: string, password: string, meta: ClientMeta) {
    await this.access.assertNotBlocked({ email, ip: meta.ip });
    const user = await this.findUser({ email });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email या password गलत है');
    }
    await this.audit.log({ id: user.id, role: user.role, orgId: user.organizationId }, 'auth.login', 'User', user.id, { method: 'password' }, meta.ip);
    return this.issue(user, meta);
  }

  async requestOtp(email: string, purpose: 'LOGIN' | 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
    await this.access.assertNotBlocked({ email });
    const recent = await this.prisma.otpCode.count({ where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
    if (recent >= 5) throw new AppException(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, 'बहुत ज़्यादा OTP requests — 15 मिनट बाद try करें।');
    if (purpose === 'RESET_PASSWORD' && !(await this.prisma.user.findUnique({ where: { email } }))) return { sent: true };

    const code = randomOtp();
    const smtpReady = await this.settings.isConfigured('smtp');
    const devMode = env().NODE_ENV !== 'production';
    if (!smtpReady && !devMode) {
      throw new IntegrationNotConfiguredException('smtp', 'Email OTP अभी उपलब्ध नहीं है — Super Admin → Settings → Integrations → Email (SMTP) configure करें। तब तक password से login करें।');
    }
    await this.prisma.otpCode.create({ data: { email, purpose, codeHash: sha256(`${email}:${code}`), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    if (smtpReady) {
      await this.mail.sendTemplate(purpose === 'RESET_PASSWORD' ? 'auth.reset' : 'auth.otp', email, { code });
      return { sent: true };
    }
    this.logger.warn(`[dev] OTP for ${email}: ${code} (SMTP not configured)`);
    return { sent: true, devCode: code };
  }

  private async consumeOtp(email: string, code: string, purposes: string[]) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { email, purpose: { in: purposes }, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('OTP expire हो गया — नया OTP मँगाएँ');
    if (otp.attempts >= 5) throw new UnauthorizedException('बहुत ज़्यादा गलत कोशिशें — नया OTP मँगाएँ');
    if (otp.codeHash !== sha256(`${email}:${code}`)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('OTP गलत है');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  }

  async verifyOtp(input: { email: string; code: string; name?: string; accountType?: 'USER' | 'BROKER'; inviteCode?: string }, meta: ClientMeta) {
    await this.consumeOtp(input.email, input.code, ['LOGIN', 'VERIFY_EMAIL']);
    let user = await this.findUser({ email: input.email });
    if (!user) {
      const invite = input.accountType === 'BROKER' ? await this.brokerGate(input.inviteCode) : null;
      const created = await this.prisma.user.create({ data: { email: input.email, name: input.name || input.email.split('@')[0], emailVerified: true } });
      if (input.accountType === 'BROKER') await this.createBrokerOrg(created.id, `${created.name} Realty`, this.prisma, invite);
      user = await this.findUser({ id: created.id });
    } else if (!user.emailVerified) {
      await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      user.emailVerified = true;
    }
    await this.audit.log({ id: user!.id, role: user!.role, orgId: user!.organizationId }, 'auth.login', 'User', user!.id, { method: 'otp' }, meta.ip);
    return this.issue(user!, meta);
  }

  async google(idToken: string, accountType: 'USER' | 'BROKER' | undefined, meta: ClientMeta, inviteCode?: string) {
    const cfg = await this.settings.require('google_oauth');
    const audience = [cfg.webClientId, cfg.androidClientId, cfg.iosClientId].filter(Boolean).map(String);
    const client = new OAuth2Client();
    let payload;
    try {
      payload = (await client.verifyIdToken({ idToken, audience })).getPayload();
    } catch {
      throw new UnauthorizedException('Google login verify नहीं हो सका');
    }
    if (!payload?.email || !payload.email_verified) throw new UnauthorizedException('Google email verified नहीं है');
    const email = payload.email.toLowerCase();
    await this.access.assertNotBlocked({ email, ip: meta.ip });
    let user = (await this.findUser({ googleId: payload.sub })) ?? (await this.findUser({ email }));
    if (!user) {
      const invite = accountType === 'BROKER' ? await this.brokerGate(inviteCode) : null;
      const created = await this.prisma.user.create({
        data: { email, name: payload.name ?? email.split('@')[0], googleId: payload.sub, avatarUrl: payload.picture, emailVerified: true },
      });
      if (accountType === 'BROKER') await this.createBrokerOrg(created.id, `${created.name} Realty`, this.prisma, invite);
      user = await this.findUser({ id: created.id });
    } else if (!user.googleId) {
      await this.prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub, emailVerified: true, avatarUrl: user.avatarUrl ?? payload.picture } });
    }
    await this.audit.log({ id: user!.id, role: user!.role, orgId: user!.organizationId }, 'auth.login', 'User', user!.id, { method: 'google' }, meta.ip);
    return this.issue(user!, meta);
  }

  async refresh(refreshToken: string, meta: ClientMeta) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!row) throw new UnauthorizedException('Session expired');
    if (row.revokedAt) {
      // Token reuse — likely theft. Revoke every session of this user.
      await this.prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Session expired');
    }
    if (row.expiresAt < new Date()) throw new UnauthorizedException('Session expired');
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    const user = await this.findUser({ id: row.userId });
    if (!user) throw new UnauthorizedException('Session expired');
    return this.issue(user, meta);
  }

  async logout(refreshToken?: string) {
    if (refreshToken) await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  /**
   * Deletes an account (by the user, or by Super Admin): personal data, saved items, requirements,
   * location/contacts, push tokens and KYC files are removed; own (owner) listings are archived; the
   * user row stays anonymised so brokers' enquiries, deals and invoices remain consistent.
   */
  async deleteAccount(id: string) {
    await this.prisma.$transaction([
      this.prisma.userLocation.deleteMany({ where: { userId: id } }),
      this.prisma.userContact.deleteMany({ where: { userId: id } }),
      this.prisma.pushToken.deleteMany({ where: { userId: id } }),
      this.prisma.savedListing.deleteMany({ where: { userId: id } }),
      this.prisma.recentView.deleteMany({ where: { userId: id } }),
      this.prisma.savedSearch.deleteMany({ where: { userId: id } }),
      this.prisma.notification.deleteMany({ where: { userId: id } }),
      this.prisma.tenantRequirement.deleteMany({ where: { userId: id } }),
      this.prisma.flatmateConnect.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
      this.prisma.flatmateProfile.deleteMany({ where: { userId: id } }),
      this.prisma.kycDocument.deleteMany({ where: { userId: id } }),
      this.prisma.listing.updateMany({ where: { postedById: id, organizationId: null, deletedAt: null }, data: { status: 'ARCHIVED' } }),
      this.prisma.user.update({
        where: { id },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          name: 'Deleted user',
          email: `deleted+${id}@brokeriq.invalid`,
          phone: null,
          googleId: null,
          passwordHash: null,
          avatarUrl: null,
          occupation: null,
          employer: null,
          workEmail: null,
          workEmailVerifiedAt: null,
          tenantVerifiedAt: null,
        },
      }),
    ]);
    await this.revokeAll(id);
  }

  async revokeAll(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async resetPassword(email: string, code: string, password: string) {
    await this.consumeOtp(email, code, ['RESET_PASSWORD']);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Account नहीं मिला');
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12), emailVerified: true } });
    await this.revokeAll(user.id);
    return { ok: true };
  }

  async changePassword(userId: string, current: string | undefined, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash && !(current && (await bcrypt.compare(current, user.passwordHash)))) throw new UnauthorizedException('Current password गलत है');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.findUser({ id: userId });
    if (!user) throw new UnauthorizedException();
    return this.toAuthUser(user);
  }
}
