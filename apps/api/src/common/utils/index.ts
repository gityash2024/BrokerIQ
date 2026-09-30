import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../decorators';
import { env } from '../../config/env';

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const randomOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const shortCode = (len = 8) => randomBytes(len).toString('base64url').replace(/[-_]/g, '').slice(0, len);

export function paginate(page = 1, pageSize = 20) {
  const take = Math.min(Math.max(pageSize, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;
  return { take, skip, page: Math.max(page, 1), pageSize: take };
}

export function paged<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Returns the caller's organization id or throws. */
export function requireOrg(user: RequestUser | undefined): string {
  if (!user?.orgId) throw new ForbiddenException('Broker account required. पहले broker profile पूरा करें।');
  return user.orgId;
}

export const isBrokerAdmin = (u: RequestUser) => u.role === 'BROKER_ADMIN' || u.role === 'SUPER_ADMIN';

export const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Calendar day in India (YYYY-MM-DD) — daily caps reset at IST midnight. */
export const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

const signature = (purpose: string, id: string) =>
  createHmac('sha256', env().ENCRYPTION_MASTER_KEY).update(`${purpose}:${id}`).digest('base64url').slice(0, 22);

/** Tamper-proof public token for an id (unsubscribe links etc.): "<id>.<sig>". */
export const signId = (purpose: string, id: string) => `${id}.${signature(purpose, id)}`;

/** Returns the id when the token was made by signId for the same purpose, else null. */
export function verifySignedId(purpose: string, token: string): string | null {
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(signature(purpose, id));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}
