import { ConflictException, ForbiddenException, HttpStatus, Injectable, Logger, OnApplicationBootstrap, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import type { Organization, User, Prisma } from '@prisma/client';
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
import { NotificationsService } from '../../core/notifications/notifications.service';
import { ModulesService } from '../../core/features/modules.service';
import { CryptoService } from '../../core/settings/crypto.service';
import { RealtimeGateway } from '../../core/realtime/realtime.gateway';
import { LoginVerificationService } from './login-verification.service';
import { hasAnotherActiveBrokerAdmin, releaseFirmAssignments } from '../../common/firm-membership';

type UserWithOrg = User & { organization: Organization | null };
interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly modules: ModulesService,
    private readonly access: AccessService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly invites: BrokerInvitesService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
    private readonly crypto: CryptoService,
    private readonly loginVerification: LoginVerificationService,
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
      organization: u.organization
        ? { id: u.organization.id, name: u.organization.name, slug: u.organization.slug, logoUrl: u.organization.logoUrl, onboarded: u.organization.onboarded }
        : null,
    };
  }

  private assertEligible(user: UserWithOrg) {
    if (
      env().BROKER_FIRST &&
      (!['SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT', 'USER'].includes(user.role) ||
        (['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) && !user.organizationId))
    )
      throw new ForbiddenException('यह account अभी broker launch के लिए सक्षम नहीं है।');
    if (user.deletedAt) throw new ForbiddenException('यह account active नहीं है। Support से संपर्क करें।');
    if (user.status !== 'ACTIVE') throw new ForbiddenException('यह account suspend है। Support से संपर्क करें।');
    if (user.organization?.status === 'SUSPENDED' && user.role !== 'SUPER_ADMIN')
      throw new ForbiddenException('आपकी firm का account suspend है। Support से संपर्क करें।');
  }

  private response(user: UserWithOrg, sessionId: string, refreshToken: string): AuthResponse {
    const accessToken = this.jwt.sign({
      sub: user.id,
      sid: sessionId,
      role: user.role,
      orgId: user.organizationId,
      email: user.email,
      sessionVersion: user.sessionVersion,
    });
    const decoded: any = this.jwt.decode(accessToken);
    return { accessToken, refreshToken, expiresIn: decoded.exp - decoded.iat, user: this.toAuthUser(user) };
  }

  private async createSession(tx: Prisma.TransactionClient, user: UserWithOrg, meta: ClientMeta, loginChallengeHash?: string) {
    const refreshToken = randomToken(48);
    const session = await tx.refreshToken.create({
      data: {
        userId: user.id,
        sessionVersion: user.sessionVersion,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + env().REFRESH_TTL_DAYS * 86400_000),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 250),
        loginChallengeHash,
      },
    });
    const response = this.response(user, session.id, refreshToken);
    if (loginChallengeHash)
      await tx.refreshToken.update({
        where: { id: session.id },
        data: {
          rotationResponse: this.crypto.encrypt(JSON.stringify(response)),
          rotationExpiresAt: new Date(Date.now() + 15_000),
        },
      });
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return response;
  }

  async issue(user: UserWithOrg, meta: ClientMeta = {}, existingSessionId?: string, emailOtpVerified = false): Promise<AuthResponse> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id + ':sessions'}))`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id }, include: { organization: true } });
      if (current.sessionVersion !== user.sessionVersion) throw new UnauthorizedException('Session changed. Please authenticate again.');
      this.assertEligible(current);
      if (existingSessionId) {
        const session = await tx.refreshToken.findFirst({
          where: { id: existingSessionId, userId: current.id, sessionVersion: current.sessionVersion, revokedAt: null, expiresAt: { gt: new Date() } },
        });
        if (!session) throw new UnauthorizedException('Session expired');
        const token = randomToken(48);
        const response = this.response(current, session.id, token);
        await tx.refreshToken.update({
          where: { id: session.id },
          data: {
            tokenHash: sha256(token),
            previousTokenHash: session.tokenHash,
            lastUsedAt: new Date(),
            rotationExpiresAt: new Date(Date.now() + 15_000),
            rotationResponse: this.crypto.encrypt(JSON.stringify(response)),
          },
        });
        return response;
      }
      const active = await tx.refreshToken.findMany({
        where: { userId: user.id, sessionVersion: current.sessionVersion, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
      });
      if (active.length >= 5) {
        const challenge = this.jwt.sign(
          { sub: current.id, purpose: 'replace-device-session', sessionVersion: current.sessionVersion, nonce: randomToken(24), emailOtpVerified },
          { secret: env().JWT_REFRESH_SECRET, expiresIn: '5m' },
        );
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.SESSION_LIMIT_REACHED, 'पाँच devices पर login है। जारी रखने के लिए एक device चुनें।', {
          challenge,
          sessions: active,
        });
      }
      return this.createSession(tx, current, meta);
    });
  }

  async replaceSession(challenge: string, sessionId: string, meta: ClientMeta): Promise<AuthResponse> {
    let payload: any;
    try {
      payload = this.jwt.verify(challenge, { secret: env().JWT_REFRESH_SECRET });
      if (payload.purpose !== 'replace-device-session' || !payload.sub || !payload.nonce) throw new Error();
    } catch {
      throw new UnauthorizedException('Login selection expired. Please log in again.');
    }
    if ((await this.settings.getAppConfig()).auth.requireLoginEmailOtp && payload.emailOtpVerified !== true)
      throw new UnauthorizedException('Email OTP पूरा करने के लिए दोबारा login करें।');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payload.sub + ':sessions'}))`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: payload.sub }, include: { organization: true } });
      this.assertEligible(user);
      if (user.sessionVersion !== payload.sessionVersion) throw new UnauthorizedException('Session changed');
      const challengeHash = sha256(challenge);
      const consumed = await tx.refreshToken.findUnique({ where: { loginChallengeHash: challengeHash } });
      if (consumed) {
        if (!consumed.revokedAt && consumed.rotationResponse && consumed.rotationExpiresAt && consumed.rotationExpiresAt > new Date())
          return JSON.parse(this.crypto.decrypt(consumed.rotationResponse)) as AuthResponse;
        throw new UnauthorizedException('Login selection already used. Please log in again.');
      }
      const selected = await tx.refreshToken.findFirst({
        where: { id: sessionId, userId: user.id, sessionVersion: user.sessionVersion, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!selected) throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'यह device अब active नहीं है। दोबारा login करें।');
      await tx.refreshToken.update({ where: { id: selected.id }, data: { revokedAt: new Date(), rotationResponse: null } });
      // Legacy accounts may already have more than five rows. One selection must never silently evict others.
      const remaining = await tx.refreshToken.count({
        where: { userId: user.id, sessionVersion: user.sessionVersion, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      if (remaining >= 5) throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'पहले Sessions में पुराने devices हटाएँ।');
      return this.createSession(tx, user, meta, challengeHash);
    });
    this.realtime.disconnectSession(sessionId);
    return result;
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
  async createBrokerOrg(userId: string, firmName: string, tx: Prisma.TransactionClient | PrismaService = this.prisma, invite: BrokerInvite | null = null) {
    const org = await tx.organization.create({ data: { name: firmName, slug: await this.uniqueOrgSlug(firmName) } });
    const granted = await this.invites.grantedPlan(invite, tx);
    if (granted) {
      await tx.subscription.create({ data: { organizationId: org.id, planId: granted.plan.id, status: 'ACTIVE', currentPeriodEnd: granted.periodEnd } });
    }
    if (invite) await this.invites.consume(invite, org.id, tx);
    const plan = granted
      ? null
      : ((await tx.plan.findFirst({ where: { isActive: true, priceMonthly: 0 }, orderBy: { sortOrder: 'asc' } })) ??
        (await tx.plan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })));
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
    if (input.accountType !== 'BROKER') await this.modules.assertPath('/me/dashboard', 'USER');
    await this.access.assertNotBlocked({ email: input.email, phone: input.phone, ip: meta.ip });
    const app = await this.settings.getAppConfig();
    if (!app.auth.allowPasswordLogin) throw new ForbiddenException('Password signup बंद है — Email OTP से login करें।');
    if (env().BROKER_FIRST && input.accountType === 'BROKER' && !input.inviteCode)
      throw new ForbiddenException('Public signup is disabled. Ask Super Admin for an invitation.');
    const invite = input.accountType === 'BROKER' ? await this.brokerGate(input.inviteCode) : null;
    if (invite?.email && invite.email.toLowerCase() !== input.email.toLowerCase()) throw new ForbiddenException('Invitation belongs to another email');
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'इस email से account पहले से है — login करें।');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name: input.name, email: input.email, phone: input.phone, passwordHash } });
      if (input.accountType === 'BROKER') await this.createBrokerOrg(created.id, input.firmName || `${input.name} Realty`, tx, invite);
      return created;
    });
    await this.linkReferral(user.id, input.ref);
    await this.audit.log({ id: user.id, role: user.role }, 'auth.register', 'User', user.id, { accountType: input.accountType }, meta.ip);
    const current = (await this.findUser({ id: user.id }))!;
    if (app.auth.requireLoginEmailOtp) return this.loginVerification.start(current, 'SIGNUP', meta);
    this.requestOtp(input.email, 'VERIFY_EMAIL').catch(() => undefined);
    return this.issue(current, meta);
  }

  /** New account came from a friend's invite link: remember who invited them and say thanks (no money involved). */
  private async linkReferral(userId: string, ref?: string | null) {
    const code = ref?.trim().toUpperCase();
    if (!code) return;
    const by = await this.prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!by || by.id === userId) return;
    const u = await this.prisma.user.update({ where: { id: userId }, data: { referredById: by.id }, select: { name: true } });
    await this.notifications
      .notify(by.id, {
        kind: 'REFERRAL',
        title: '🎉 आपके invite से कोई जुड़ा',
        body: `${u.name.split(' ')[0]} ने BrokerIQ join किया — धन्यवाद!`,
        link: '/account/invite',
      })
      .catch(() => undefined);
  }

  async login(email: string, password: string, meta: ClientMeta) {
    const app = await this.settings.getAppConfig();
    if (!app.auth.allowPasswordLogin) throw new ForbiddenException('Password login बंद है।');
    await this.access.assertNotBlocked({ email, ip: meta.ip });
    const user = await this.findUser({ email });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email या password गलत है');
    }
    this.assertEligible(user);
    if (app.auth.requireLoginEmailOtp) return this.loginVerification.start(user, 'PASSWORD', meta);
    await this.audit.log({ id: user.id, role: user.role, orgId: user.organizationId }, 'auth.login', 'User', user.id, { method: 'password' }, meta.ip);
    return this.issue(user, meta);
  }

  async requestOtp(email: string, purpose: 'LOGIN' | 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
    const auth = (await this.settings.getAppConfig()).auth;
    if (purpose === 'LOGIN' && (auth.requireLoginEmailOtp || !auth.allowEmailOtp))
      throw new ForbiddenException('Email और password या Google से login शुरू करें; उसके बाद OTP पूरा करें।');
    await this.access.assertNotBlocked({ email });
    const recent = await this.prisma.otpCode.count({ where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
    if (recent >= 5) throw new AppException(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, 'बहुत ज़्यादा OTP requests — 15 मिनट बाद try करें।');
    if (purpose === 'RESET_PASSWORD' && !(await this.prisma.user.findUnique({ where: { email } }))) return { sent: true };

    const code = randomOtp();
    const emailReady = await this.mail.isConfigured();
    const devMode = env().NODE_ENV !== 'production';
    if (!emailReady && !devMode) {
      throw new IntegrationNotConfiguredException(
        await this.mail.provider(),
        'Email OTP अभी उपलब्ध नहीं है — Super Admin को selected email delivery provider configure करना है। तब तक password से login करें।',
      );
    }
    await this.prisma.otpCode.create({ data: { email, purpose, codeHash: sha256(`${email}:${code}`), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    if (emailReady) {
      await this.mail.sendTemplate(purpose === 'RESET_PASSWORD' ? 'auth.reset' : 'auth.otp', email, { code });
      return { sent: true };
    }
    this.logger.warn(`[dev] OTP for ${email}: ${code} (email provider not configured)`);
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
      await this.prisma.otpCode.updateMany({
        where: { id: otp.id, consumedAt: null, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('OTP गलत है');
    }
    // Checking and consuming must be one database operation: concurrent requests
    // may both have read the same unused code above.
    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException('OTP expire हो गया — नया OTP मँगाएँ');
  }

  async verifyOtp(input: { email: string; code: string; name?: string; accountType?: 'USER' | 'BROKER'; inviteCode?: string; ref?: string }, meta: ClientMeta) {
    const auth = (await this.settings.getAppConfig()).auth;
    if (auth.requireLoginEmailOtp || !auth.allowEmailOtp)
      throw new ForbiddenException('Email और password या Google से login शुरू करें; उसके बाद OTP पूरा करें।');
    await this.access.assertNotBlocked({ email: input.email, ip: meta.ip });
    await this.consumeOtp(input.email, input.code, ['LOGIN', 'VERIFY_EMAIL']);
    let user = await this.findUser({ email: input.email });
    if (!user) {
      if (input.accountType !== 'BROKER') await this.modules.assertPath('/me/dashboard', 'USER');
      const invite = input.accountType === 'BROKER' ? await this.brokerGate(input.inviteCode) : null;
      const created = await this.prisma.user.create({ data: { email: input.email, name: input.name || input.email.split('@')[0], emailVerified: true } });
      if (input.accountType === 'BROKER') await this.createBrokerOrg(created.id, `${created.name} Realty`, this.prisma, invite);
      await this.linkReferral(created.id, input.ref);
      user = await this.findUser({ id: created.id });
    } else if (!user.emailVerified) {
      await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      user.emailVerified = true;
    }
    await this.audit.log({ id: user!.id, role: user!.role, orgId: user!.organizationId }, 'auth.login', 'User', user!.id, { method: 'otp' }, meta.ip);
    return this.issue(user!, meta);
  }

  async google(idToken: string, accountType: 'USER' | 'BROKER' | undefined, meta: ClientMeta, inviteCode?: string, ref?: string) {
    const app = await this.settings.getAppConfig();
    if (!app.auth.allowGoogle) throw new ForbiddenException('Google login बंद है।');
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
      if (accountType !== 'BROKER') await this.modules.assertPath('/me/dashboard', 'USER');
      const invite = accountType === 'BROKER' ? await this.brokerGate(inviteCode) : null;
      const created = await this.prisma.user.create({
        data: { email, name: payload.name ?? email.split('@')[0], googleId: payload.sub, avatarUrl: payload.picture, emailVerified: true },
      });
      if (accountType === 'BROKER') await this.createBrokerOrg(created.id, `${created.name} Realty`, this.prisma, invite);
      await this.linkReferral(created.id, ref);
      user = await this.findUser({ id: created.id });
    } else if (!user.googleId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, emailVerified: true, avatarUrl: user.avatarUrl ?? payload.picture },
      });
    }
    this.assertEligible(user!);
    if (app.auth.requireLoginEmailOtp) return this.loginVerification.start(user!, 'GOOGLE', meta);
    await this.audit.log({ id: user!.id, role: user!.role, orgId: user!.organizationId }, 'auth.login', 'User', user!.id, { method: 'google' }, meta.ip);
    return this.issue(user!, meta);
  }

  async verifyLoginOtp(challenge: string, code: string, meta: ClientMeta) {
    const { user, method } = await this.loginVerification.consume(challenge, code, meta);
    this.assertEligible(user);
    await this.audit.log(
      { id: user.id, role: user.role, orgId: user.organizationId },
      'auth.login',
      'User',
      user.id,
      { method: method.toLowerCase() + '+email_otp' },
      meta.ip,
    );
    return this.issue(user, meta, undefined, true);
  }

  resendLoginOtp(challenge: string, meta: ClientMeta) {
    return this.loginVerification.resend(challenge, meta);
  }

  async refresh(refreshToken: string, meta: ClientMeta) {
    const hash = sha256(refreshToken);
    const original = await this.prisma.refreshToken.findFirst({ where: { OR: [{ tokenHash: hash }, { previousTokenHash: hash }] } });
    if (!original) throw new UnauthorizedException('Session expired');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${original.userId + ':sessions'}))`;
      const row = await tx.refreshToken.findUniqueOrThrow({ where: { id: original.id } });
      const user = await tx.user.findFirst({ where: { id: row.userId, deletedAt: null }, include: { organization: true } });
      if (!user || row.revokedAt || row.expiresAt <= new Date() || row.sessionVersion !== user.sessionVersion)
        throw new UnauthorizedException('Session expired');
      this.assertEligible(user);
      // Two browser tabs or retried network requests receive the same rotation within a bounded grace period.
      if (row.tokenHash !== hash) {
        if (row.previousTokenHash === hash && row.rotationExpiresAt && row.rotationExpiresAt > new Date() && row.rotationResponse)
          return JSON.parse(this.crypto.decrypt(row.rotationResponse)) as AuthResponse;
        throw new UnauthorizedException('Session expired');
      }
      const nextToken = randomToken(48);
      const response = this.response(user, row.id, nextToken);
      await tx.refreshToken.update({
        where: { id: row.id },
        data: {
          tokenHash: sha256(nextToken),
          previousTokenHash: hash,
          rotationExpiresAt: new Date(Date.now() + 15_000),
          rotationResponse: this.crypto.encrypt(JSON.stringify(response)),
          lastUsedAt: new Date(),
          ip: meta.ip ?? row.ip,
          userAgent: meta.userAgent?.slice(0, 250) ?? row.userAgent,
        },
      });
      return response;
    });
  }

  async listSessions(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId + ':sessions'}))`;
      await tx.refreshToken.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date(), rotationResponse: null } });
    });
    // A foreign session ID must not let an authenticated user disconnect somebody else.
    const own = await this.prisma.refreshToken.findFirst({ where: { id: sessionId, userId } });
    if (own) this.realtime.disconnectSession(sessionId);
    return { ok: true };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      const hash = sha256(refreshToken);
      const row = await this.prisma.refreshToken.findFirst({ where: { OR: [{ tokenHash: hash }, { previousTokenHash: hash }] } });
      if (row) await this.revokeSession(row.userId, row.id);
    }
    return { ok: true };
  }

  /**
   * Deletes an account (by the user, or by Super Admin): personal data, saved items, requirements,
   * location/contacts, push tokens and KYC files are removed; own (owner) listings are archived; the
   * user row stays anonymised so brokers' enquiries, deals and invoices remain consistent.
   */
  async deleteAccount(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({ where: { id }, select: { organizationId: true } });
      if (before.organizationId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${before.organizationId + ':membership'}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id + ':sessions'}))`;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id } });
      if (current.deletedAt) return;
      if (current.role === 'SUPER_ADMIN') throw new ForbiddenException('Super Admin account delete नहीं हो सकता');
      if (current.organizationId !== before.organizationId) throw new ConflictException('Membership changed. Reload your account.');
      if (current.organizationId) {
        if (current.role === 'BROKER_ADMIN' && current.status === 'ACTIVE' && !(await hasAnotherActiveBrokerAdmin(tx, current.organizationId, id)))
          throw new ConflictException('Firm must retain at least one active Broker Admin');
        await releaseFirmAssignments(tx, current.organizationId, id);
      }
      await Promise.all([
        tx.userLocation.deleteMany({ where: { userId: id } }),
        tx.userContact.deleteMany({ where: { userId: id } }),
        tx.pushToken.deleteMany({ where: { userId: id } }),
        tx.loginVerification.deleteMany({ where: { userId: id } }),
        tx.savedListing.deleteMany({ where: { userId: id } }),
        tx.recentView.deleteMany({ where: { userId: id } }),
        tx.savedSearch.deleteMany({ where: { userId: id } }),
        tx.notification.deleteMany({ where: { userId: id } }),
        tx.tenantRequirement.deleteMany({ where: { userId: id } }),
        tx.flatmateConnect.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
        tx.flatmateProfile.deleteMany({ where: { userId: id } }),
        tx.kycDocument.deleteMany({ where: { userId: id } }),
        tx.listing.updateMany({ where: { postedById: id, organizationId: null, deletedAt: null }, data: { status: 'ARCHIVED' } }),
        tx.user.update({
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
            sessionVersion: { increment: 1 },
          },
        }),
        tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      ]);
    });
    this.realtime.disconnectUser(id);
  }

  async revokeAll(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    this.realtime.disconnectUser(userId);
  }

  async resetPassword(email: string, code: string, password: string) {
    await this.consumeOtp(email, code, ['RESET_PASSWORD']);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Account नहीं मिला');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash, emailVerified: true, sessionVersion: { increment: 1 } } }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    this.realtime.disconnectUser(user.id);
    await this.audit.log({ id: user.id, role: user.role, orgId: user.organizationId }, 'auth.password_reset', 'User', user.id);
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
