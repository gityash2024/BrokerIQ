import { createHash, randomBytes, randomInt } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../decorators';

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
