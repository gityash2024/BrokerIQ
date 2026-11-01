import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { User } from '@prisma/client';
import { ErrorCode, type LoginOtpChallenge } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import { AccessService } from '../../core/access/access.service';
import { AppException, IntegrationNotConfiguredException } from '../../common/exceptions';
import { randomOtp, randomToken, sha256 } from '../../common/utils';
import { env } from '../../config/env';

type Meta = { ip?: string; userAgent?: string };
const credentialHash = (user: User) => sha256(`${user.id}:${user.email}:${user.passwordHash ?? ''}:${user.sessionVersion}`);
const clientHash = (meta: Meta) => sha256(meta.userAgent?.slice(0, 250) ?? '');
const mask = (email: string) => {
  const [name, host] = email.split('@');
  return name.slice(0, 1) + '***@' + host;
};
const invalid = () => new UnauthorizedException('Login OTP गलत है या expire हो गया। दोबारा login करें।');

/** A factor challenge is not an access/session token. Codes are bound to a random login nonce. */
@Injectable()
export class LoginVerificationService {
  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailService,
    private readonly access: AccessService,
  ) {}

  private async deliver(id: string, email: string, code: string) {
    try {
      if (await this.mail.isConfigured()) {
        await this.mail.sendTemplate('auth.otp', email, { code });
        await this.db.loginVerification.update({ where: { id }, data: { sentAt: new Date() } });
        return undefined;
      }
      if (env().NODE_ENV === 'production')
        throw new IntegrationNotConfiguredException(
          await this.mail.provider(),
          'Login OTP भेजने के लिए email delivery उपलब्ध नहीं है। Support से संपर्क करें।',
        );
      await this.db.loginVerification.update({ where: { id }, data: { sentAt: new Date() } });
      return code; // Explicit local/test delivery only; never logged or returned in production.
    } catch (error) {
      await this.db.loginVerification.update({ where: { id }, data: { consumedAt: new Date() } });
      throw error;
    }
  }

  async start(user: User, method: 'PASSWORD' | 'GOOGLE' | 'SIGNUP', meta: Meta): Promise<never> {
    await this.access.assertNotBlocked({ email: user.email, phone: user.phone, ip: meta.ip });
    const token = randomToken(32),
      code = randomOtp();
    const now = new Date(),
      expiresAt = new Date(now.getTime() + 10 * 60_000),
      resendAt = new Date(now.getTime() + 60_000);
    const row = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id + ':login-otp'}))`;
      const count = await tx.loginVerification.count({ where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 15 * 60_000) } } });
      if (count >= 10) throw new AppException(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, 'बहुत ज़्यादा login OTP requests। 15 मिनट बाद try करें।');
      return tx.loginVerification.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          channel: 'EMAIL',
          method,
          email: user.email,
          credentialHash: credentialHash(user),
          clientHash: clientHash(meta),
          codeHash: sha256(`${token}:${code}`),
          expiresAt,
          resendAt,
        },
      });
    });
    const devCode = await this.deliver(row.id, row.email, code);
    const details: LoginOtpChallenge = {
      challenge: token,
      requiredFactors: ['EMAIL'],
      destination: mask(user.email),
      expiresAt: expiresAt.toISOString(),
      resendAt: resendAt.toISOString(),
      ...(devCode ? { devCode } : {}),
    };
    throw new AppException(
      HttpStatus.PRECONDITION_REQUIRED,
      ErrorCode.LOGIN_OTP_REQUIRED,
      'OTP आपके registered email पर भेजा गया। OTP पूरा करें; पुराने app में नया update आवश्यक है।',
      details,
    );
  }

  async resend(token: string, meta: Meta): Promise<LoginOtpChallenge> {
    let code = randomOtp();
    const row = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LoginVerification" WHERE "tokenHash"=${sha256(token)} FOR UPDATE`;
      const current = await tx.loginVerification.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
      if (
        !current ||
        current.consumedAt ||
        current.expiresAt <= new Date() ||
        current.attempts >= 5 ||
        current.channel !== 'EMAIL' ||
        current.clientHash !== clientHash(meta) ||
        current.credentialHash !== credentialHash(current.user)
      )
        throw invalid();
      if (current.user.status !== 'ACTIVE' || current.user.deletedAt) throw invalid();
      if (current.sends >= 3 || current.resendAt > new Date())
        throw new AppException(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, 'Resend की सीमा पूरी हुई या थोड़ा रुकना जरूरी है।');
      while (sha256(`${token}:${code}`) === current.codeHash) code = randomOtp();
      return tx.loginVerification.update({
        where: { id: current.id },
        data: { codeHash: sha256(`${token}:${code}`), sentAt: null, sends: { increment: 1 }, resendAt: new Date(Date.now() + 60_000) },
      });
    });
    await this.access.assertNotBlocked({ email: row.email, ip: meta.ip });
    const devCode = await this.deliver(row.id, row.email, code);
    return {
      challenge: token,
      requiredFactors: ['EMAIL'],
      destination: mask(row.email),
      expiresAt: row.expiresAt.toISOString(),
      resendAt: row.resendAt.toISOString(),
      ...(devCode ? { devCode } : {}),
    };
  }

  async consume(token: string, code: string, meta: Meta) {
    // Return a failed result from the transaction: throwing after increment would roll back attempts.
    const result = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LoginVerification" WHERE "tokenHash"=${sha256(token)} FOR UPDATE`;
      const row = await tx.loginVerification.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { include: { organization: true } } } });
      if (
        !row ||
        row.consumedAt ||
        !row.sentAt ||
        row.expiresAt <= new Date() ||
        row.attempts >= 5 ||
        row.channel !== 'EMAIL' ||
        row.clientHash !== clientHash(meta) ||
        row.credentialHash !== credentialHash(row.user)
      )
        return null;
      const matches = timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(sha256(`${token}:${code}`)));
      if (!matches) {
        await tx.loginVerification.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
        return null;
      }
      if (row.user.status !== 'ACTIVE' || row.user.deletedAt) return null;
      await tx.loginVerification.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
      await tx.user.update({ where: { id: row.userId }, data: { emailVerified: true } });
      return { user: { ...row.user, emailVerified: true }, method: row.method };
    });
    if (!result) throw invalid();
    await this.access.assertNotBlocked({ email: result.user.email, phone: result.user.phone, ip: meta.ip });
    return result;
  }
}
