import { BadRequestException } from '@nestjs/common';
import { randomOtp, sha256 } from '../../common/utils';

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_TRIES = 5;

export interface OtpState {
  hash: string;
  exp: number;
  tries: number;
}

/** New 6-digit OTP bound to a context (document + party), stored only as a hash. */
export function issueOtp(context: string): { otp: string; state: OtpState } {
  const otp = randomOtp();
  return { otp, state: { hash: sha256(`${context}:${otp}`), exp: Date.now() + OTP_TTL_MS, tries: 0 } };
}

/** Throws a user-facing error when the OTP is wrong/expired; returns the updated tries count otherwise. */
export function verifyOtp(state: OtpState | null | undefined, context: string, otp: string) {
  if (!state) throw new BadRequestException('पहले OTP मँगवाएँ');
  if (state.exp < Date.now()) throw new BadRequestException('OTP expire हो गया — नया OTP मँगवाएँ');
  if (state.tries >= OTP_MAX_TRIES) throw new BadRequestException('बहुत बार गलत OTP — नया OTP मँगवाएँ');
  return state.hash === sha256(`${context}:${otp}`);
}

/** "r***@gmail.com" / "******3210" — tells the party where the OTP went without exposing it. */
export const maskContact = (v: string) =>
  v.includes('@')
    ? v.replace(/^(.)(.*)(@.*)$/, (_, a: string, b: string, c: string) => `${a}${'*'.repeat(Math.min(6, b.length))}${c}`)
    : `******${v.slice(-4)}`;
