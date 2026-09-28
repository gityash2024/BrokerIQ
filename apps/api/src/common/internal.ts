import { randomBytes } from 'crypto';

/**
 * Per-process secret for the AI assistant's loopback calls into this same API (made with
 * the user's own bearer token). It only exempts those calls from IP rate limiting — every
 * guard, role check and validation still applies. Never leaves the process.
 */
export const INTERNAL_CALL_HEADER = 'x-biq-internal';
export const INTERNAL_CALL_TOKEN = randomBytes(24).toString('hex');

export const isInternalCall = (req: { headers?: Record<string, unknown> } | undefined) => req?.headers?.[INTERNAL_CALL_HEADER] === INTERNAL_CALL_TOKEN;
