import { ForbiddenException } from '@nestjs/common';
import { normalizeIndianPhone } from '@brokeriq/shared';
import type { MailInput, MailService } from '../../src/core/mail/mail.service';
import type { WhatsAppService } from '../../src/modules/whatsapp/whatsapp.service';

export const qaPhones = ['+919700000091', '+919700000092'] as const;

export type QaDelivery = {
  channel: 'email' | 'whatsapp';
  to: string;
  subject?: string;
  body: string;
  code?: string;
  receivedAt: string;
};

/** This adapter is only imported by the test runner and the local QA entry point. */
export function qaMail(record: (delivery: QaDelivery) => void): Pick<MailService, 'provider' | 'isConfigured' | 'send' | 'sendTemplate' | 'trySendTemplate'> {
  async function send(input: MailInput) {
    const recipients = [input.to, input.bcc ?? []].flat();
    if (!recipients.length || recipients.some((email) => !/^[^@\s]+@(?:[a-z0-9-]+\.)+test$/i.test(email))) {
      throw new ForbiddenException('QA mail requires a .test recipient');
    }
    const body = input.text || input.html;
    const code = /^OTP\s+(\d{6})\b/.exec(input.subject)?.[1];
    for (const to of recipients) record({ channel: 'email', to, subject: input.subject, body, code, receivedAt: new Date().toISOString() });
  }

  async function sendTemplate(key: string, to: string | string[], variables: Record<string, unknown>) {
    const code = variables.code;
    await send({
      to,
      subject: typeof code === 'string' && /^\d{6}$/.test(code) ? `OTP ${code} — ${key}` : key,
      html: Object.entries(variables).filter(([, value]) => typeof value === 'string').map(([name, value]) => `${name} ${value}`).join('\n'),
    });
  }

  return {
    provider: async () => 'smtp',
    isConfigured: async () => true,
    send,
    sendTemplate,
    async trySendTemplate(key, to, variables) {
      try {
        await sendTemplate(key, to, variables);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function captureQaWhatsApp(
  service: WhatsAppService,
  record: (delivery: QaDelivery) => void,
  organizationId: string,
) {
  service.send = async (orgId, number, message, options) => {
    const phone = normalizeIndianPhone(number);
    if (orgId !== organizationId || !phone || !qaPhones.some((candidate) => candidate === phone) || message.type !== 'text' || !options?.ownNumberOnly) {
      throw new ForbiddenException('QA WhatsApp is restricted to the isolated firm and fixture recipients');
    }
    const code = options.storedBody ? /\bOTP:\s*(\d{6})\b/.exec(message.text)?.[1] : undefined;
    record({ channel: 'whatsapp', to: phone, body: message.text, code, receivedAt: new Date().toISOString() });
    return { status: 'SENT' } as Awaited<ReturnType<WhatsAppService['send']>>;
  };
}
