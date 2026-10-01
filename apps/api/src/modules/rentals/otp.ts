import { BadRequestException, HttpStatus } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ErrorCode, normalizeIndianPhone, whatsappLink } from '@brokeriq/shared';
import { AppException, WhatsAppWindowClosedException } from '../../common/exceptions';
import { randomOtp, sha256 } from '../../common/utils';
import { env } from '../../config/env';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';

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

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Stable 6-character code a party sends the firm on WhatsApp ("BrokerIQ OTP <code>") to get their OTP. */
export function otpRequestCode(kind: 'sign' | 'insp', id: string, party: string) {
  const h = createHmac('sha256', env().ENCRYPTION_MASTER_KEY).update(`otp-ask:${kind}:${id}:${party}`).digest();
  return Array.from(h.subarray(0, 6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export const samePhone = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && (normalizeIndianPhone(a) ?? a) === (normalizeIndianPhone(b) ?? b);

/**
 * Sends an OTP on WhatsApp from the firm's own number; the firm's inbox only ever shows it masked.
 * Meta blocks free-form messages to people who haven't written to the firm in 24 hours — then the client gets
 * WHATSAPP_WINDOW_CLOSED with a wa.me link: the person sends "BrokerIQ OTP <code>" and the OTP is sent back automatically.
 */
export async function sendOtpOnWhatsApp(
  wa: WhatsAppService,
  orgId: string,
  to: { name: string; phone: string },
  msg: { text: string; otp: string; code: string },
) {
  try {
    await wa.send(orgId, to.phone, { type: 'text', text: msg.text }, { contactName: to.name, ownNumberOnly: true, storedBody: msg.text.replace(msg.otp, '******') });
  } catch (e) {
    if (!(e instanceof WhatsAppWindowClosedException)) throw e;
    const firm = await wa.firmNumber(orgId);
    if (!firm) throw e;
    throw new AppException(HttpStatus.CONFLICT, ErrorCode.WHATSAPP_WINDOW_CLOSED, 'पहले firm को WhatsApp पर message भेजें — OTP उसी chat में जवाब में आ जाएगा', {
      waLink: whatsappLink(firm, `BrokerIQ OTP ${msg.code}`),
      code: msg.code,
    });
  }
}
