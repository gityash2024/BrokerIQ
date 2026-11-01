import { createHmac } from 'node:crypto';
import { allowedInboundSms, inspectTextbeeDevice, sendTextbeeSms, TextbeeRequestError, textbeeEventSchema, verifyTextbeeSignature } from './textbee.client';

const values = { apiKey: 'isolated-provider-boundary-key', deviceId: '012345678901234567890123', senderPhone: '+919899980802', simSubscriptionId: 4 };
const device = { _id: values.deviceId, enabled: true, simInfo: { sims: [{ subscriptionId: 4 }] } };
const response = (data: unknown, status = 200) => ({ ok: status === 200, status, json: async () => ({ data }) }) as Response;
afterEach(() => jest.restoreAllMocks());
it('uses the explicit current device/SIM and preserves queue acceptance rather than claiming delivery', async () => {
  const call = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(response(device))
    .mockResolvedValueOnce(response({ success: true, smsBatchId: '123456789012345678901234' }));
  await expect(sendTextbeeSms(values, '+919876543210', 'Visit at 11')).resolves.toMatchObject({ batchId: '123456789012345678901234' });
  const [url, options] = call.mock.calls[1];
  expect(url).toBe('https://api.textbee.dev/api/v1/gateway/send-sms');
  expect(JSON.parse(String(options?.body))).toMatchObject({ recipients: ['+919876543210'], deviceId: values.deviceId, simSubscriptionId: 4 });
  expect(options?.redirect).toBe('error');
});
it('does not let the provider fall back to an unrelated default SIM', async () => {
  const call = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ...device, simInfo: { sims: [{ subscriptionId: 9 }] } }));
  await expect(sendTextbeeSms(values, '+919876543210', 'Visit')).rejects.toThrow('Configured SMS SIM');
  expect(call).toHaveBeenCalledTimes(1);
});
it('connection inspection sends no SMS and rejects a disabled device', async () => {
  const call = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ...device, enabled: false }));
  await expect(inspectTextbeeDevice(values)).rejects.toBeInstanceOf(TextbeeRequestError);
  expect(call).toHaveBeenCalledTimes(1);
  expect(call.mock.calls[0][1]?.method).toBe('GET');
});
it('quota errors fail explicitly without retry, paid fallback, or provider credential leakage', async () => {
  const call = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(response(device))
    .mockResolvedValueOnce(response({ secret: 'must-not-leak' }, 429));
  await expect(sendTextbeeSms(values, '+919876543210', 'Visit')).rejects.toMatchObject({ status: 429, ambiguous: false });
  expect(call).toHaveBeenCalledTimes(2);
});
it.each(['timeout', 'missing-batch'])('marks an uncertain send as ambiguous (%s) without retry', async (kind) => {
  const call = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(device));
  if (kind === 'timeout') call.mockRejectedValueOnce(new Error('secret-provider-message'));
  else call.mockResolvedValueOnce(response({ success: true }));
  await expect(sendTextbeeSms(values, '+919876543210', 'Visit')).rejects.toMatchObject({ ambiguous: true });
  expect(call).toHaveBeenCalledTimes(2);
});
it('checks HMAC over exact raw bytes and rejects missing secrets or changed JSON whitespace', () => {
  const key = 'isolated-signature-secret-123';
  const raw = Buffer.from('{"message": "hi"}');
  const signed = createHmac('sha256', key).update(raw).digest('hex');
  expect(verifyTextbeeSignature(key, raw, signed)).toBe(true);
  expect(verifyTextbeeSignature(key, Buffer.from('{"message":"hi"}'), signed)).toBe(false);
  expect(verifyTextbeeSignature('', raw, signed)).toBe(false);
  expect(verifyTextbeeSignature(key, raw, 'nothex')).toBe(false);
});
it('inbound filtering requires a known numeric business contact and excludes OTP/system content', () => {
  const event = textbeeEventSchema.parse({
    smsId: '123456789012345678901234',
    deviceId: values.deviceId,
    webhookSubscriptionId: values.deviceId,
    idempotencyKey: 'isolated-event',
    webhookEvent: 'MESSAGE_RECEIVED',
    message: 'Is the flat available?',
    receivedAt: '2026-11-01T10:00:00Z',
    sender: '+919876543210',
  });
  const contacts = new Set(['+919876543210']);
  expect(allowedInboundSms(event, contacts)).toBe(true);
  expect(allowedInboundSms({ ...event, sender: '+919876543211' }, contacts)).toBe(false);
  expect(allowedInboundSms({ ...event, sender: 'BANK-OTP' }, contacts)).toBe(false);
  expect(allowedInboundSms({ ...event, message: 'OTP is 123456' }, contacts)).toBe(false);
  expect(allowedInboundSms({ ...event, message: 'सत्यापन कोड 123456' }, contacts)).toBe(false);
});
