import { createHmac } from 'crypto';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService webhook signature verification', () => {
  const service = Object.create(WhatsAppService.prototype) as WhatsAppService;
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const secret = 'meta-app-secret';
  const signed = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('fails closed without an app secret', () => {
    expect(service.verifySignature(undefined, body, signed)).toBe(false);
  });

  it('accepts only a valid Meta HMAC', () => {
    expect(service.verifySignature(secret, body, signed)).toBe(true);
    expect(service.verifySignature(secret, body, 'sha256:not-a-valid-signature')).toBe(false);
    expect(service.verifySignature(secret, undefined, signed)).toBe(false);
  });
});
