import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import type { IntegrationValues } from '../settings/settings.service';

const ROOT = 'https://api.textbee.dev/api/v1';
const configSchema = z.object({
  apiKey: z.string().min(16),
  deviceId: z.string().regex(/^[a-f0-9]{24}$/i),
  senderPhone: z.string().regex(/^\+\d{10,15}$/),
  simSubscriptionId: z.coerce.number().int().nonnegative(),
});
export type TextbeeConfig = z.infer<typeof configSchema>;
export function textbeeConfig(values: IntegrationValues): TextbeeConfig {
  const result = configSchema.safeParse(values);
  if (!result.success)
    throw new IntegrationNotConfiguredException('textbee', 'Textbee API key, device, business phone और current SIM subscription ID configure करें।');
  return result.data;
}
export class TextbeeRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly ambiguous: boolean,
  ) {
    super(
      status === 429
        ? 'SMS free quota exhausted. No paid fallback or automatic retry.'
        : ambiguous
          ? 'SMS provider response uncertain. Check delivery history before sending again.'
          : `Textbee request failed (${status}). Check the configured device and credentials.`,
    );
  }
}
async function request(config: TextbeeConfig, path: string, body?: unknown): Promise<any> {
  let response: Response;
  try {
    response = await fetch(`${ROOT}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { 'x-api-key': config.apiKey, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new TextbeeRequestError(0, body !== undefined);
  }
  if (!response.ok) throw new TextbeeRequestError(response.status, body !== undefined && response.status >= 500);
  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new TextbeeRequestError(response.status, body !== undefined);
  }
  if (!json || !Object.hasOwn(json, 'data')) throw new TextbeeRequestError(response.status, body !== undefined);
  return json.data;
}
/** Strict explicit device/SIM selection: Textbee otherwise silently falls back to the default SIM. */
export async function inspectTextbeeDevice(values: IntegrationValues) {
  const config = textbeeConfig(values);
  const device = await request(config, `/gateway/devices/${config.deviceId}`);
  if (device?._id !== config.deviceId || device.enabled !== true) throw new TextbeeRequestError(400, false);
  const sims = device.simInfo?.sims;
  const selected = Array.isArray(sims) ? sims.find((sim: any) => sim.subscriptionId === config.simSubscriptionId) : null;
  if (!selected)
    throw new IntegrationNotConfiguredException(
      'textbee',
      'Configured SMS SIM is no longer present. Recheck the Textbee app SIM Cards section before sending.',
    );
  return { config, device, selected };
}
export async function sendTextbeeSms(values: IntegrationValues, recipient: string, text: string, beforeSend?: () => Promise<void>) {
  if (!/^\+\d{10,15}$/.test(recipient) || !text.trim() || text.length > 1600) throw new Error('Invalid SMS recipient or message');
  const { config } = await inspectTextbeeDevice(values);
  await beforeSend?.();
  const sent = await request(config, '/gateway/send-sms', {
    recipients: [recipient],
    message: text,
    deviceId: config.deviceId,
    simSubscriptionId: config.simSubscriptionId,
  });
  // A stable batch id is required to reconcile delivery. Never retry an ambiguous accepted response.
  if (sent?.success === false || typeof sent?.smsBatchId !== 'string' || !/^[a-f0-9]{24}$/i.test(sent.smsBatchId)) throw new TextbeeRequestError(200, true);
  return { batchId: sent.smsBatchId as string, warning: typeof sent.warning?.code === 'string' ? sent.warning.code : null };
}
export async function readTextbeeBatch(values: IntegrationValues, batchId: string) {
  const config = textbeeConfig(values);
  if (!/^[a-f0-9]{24}$/i.test(batchId)) throw new Error('Invalid SMS batch');
  return request(config, `/gateway/devices/${config.deviceId}/sms-batch/${batchId}`);
}
export function verifyTextbeeSignature(secret: unknown, raw: Buffer | undefined, signature: unknown) {
  if (typeof secret !== 'string' || secret.length < 20 || !raw || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export const textbeeEventSchema = z
  .object({
    smsId: z.string().regex(/^[a-f0-9]{24}$/i),
    deviceId: z.string().regex(/^[a-f0-9]{24}$/i),
    webhookSubscriptionId: z.string().regex(/^[a-f0-9]{24}$/i),
    idempotencyKey: z.string().min(1).max(128),
    webhookEvent: z.enum(['MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_DELIVERED', 'MESSAGE_FAILED', 'UNKNOWN_STATE']),
    message: z.string().max(16000),
    sender: z.string().max(50).optional(),
    recipient: z.string().max(50).optional(),
    smsBatchId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    receivedAt: z.string().datetime().optional(),
    sentAt: z.string().datetime().optional(),
    deliveredAt: z.string().datetime().optional(),
    failedAt: z.string().datetime().optional(),
    simUsed: z.object({ subscriptionId: z.number().int().optional() }).optional(),
  })
  .superRefine((event, ctx) => {
    const required =
      event.webhookEvent === 'MESSAGE_RECEIVED'
        ? 'receivedAt'
        : event.webhookEvent === 'MESSAGE_SENT'
          ? 'sentAt'
          : event.webhookEvent === 'MESSAGE_DELIVERED'
            ? 'deliveredAt'
            : event.webhookEvent === 'MESSAGE_FAILED'
              ? 'failedAt'
              : null;
    if (required && !event[required]) ctx.addIssue({ code: 'custom', path: [required], message: 'Provider event time required' });
    if (event.webhookEvent === 'MESSAGE_RECEIVED' && !event.sender) ctx.addIssue({ code: 'custom', path: ['sender'], message: 'Sender required' });
  });
/** OTPs/system senders never become CRM content, even if the phone was misconfigured. Phone allowlists remain mandatory before enabling inbound. */
export function allowedInboundSms(event: z.infer<typeof textbeeEventSchema>, allowedPhones: Set<string>) {
  return (
    event.webhookEvent === 'MESSAGE_RECEIVED' &&
    !!event.sender &&
    /^\+\d{10,15}$/.test(event.sender) &&
    allowedPhones.has(event.sender) &&
    !/\b(?:otp|one[ -]?time|verification code|security code|password|pin code)\b|ओटीपी|वन.?टाइम|सत्यापन.?कोड/i.test(event.message)
  );
}
