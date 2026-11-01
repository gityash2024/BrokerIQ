import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { renderTemplate } from '@brokeriq/shared';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZohoMailService } from './zoho-mail.service';
import { DEFAULT_TEMPLATES } from './default-templates';

export interface MailInput {
  /** Hidden recipients (bulk sends must never expose addresses to each other) */
  bcc?: string | string[];
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
    private readonly zoho: ZohoMailService,
  ) {}

  async provider(): Promise<'smtp' | 'zoho_mail'> {
    const selected = await this.settings.getJson<string>('email.provider');
    if (selected && !['smtp', 'zoho_mail'].includes(selected)) throw new Error('Select a valid email delivery provider');
    return selected === 'zoho_mail' ? 'zoho_mail' : 'smtp';
  }
  async configuration() {
    const key = await this.provider();
    return { key, values: await this.settings.require(key) };
  }
  async isConfigured() { return this.settings.isConfigured(await this.provider()); }

  private async transport(values?: Record<string, unknown>) {
    const v = values ?? (await this.settings.require('smtp'));
    const port = Number(v.port ?? 587);
    return {
      tx: nodemailer.createTransport({
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
        requireTLS: !(v.secure === true || port === 465),
        host: String(v.host),
        port,
        secure: v.secure === true || port === 465,
        auth: { user: String(v.user), pass: String(v.pass) },
      }),
      from: `"${v.fromName ?? 'BrokerIQ'}" <${v.fromEmail}>`,
    };
  }

  async send(input: MailInput) {
    const { key, values } = await this.configuration();
    const app = await this.settings.getAppConfig();
    const count = [input.to, input.bcc].flat().filter(Boolean).length;
    try {
      if (key === 'zoho_mail') await this.zoho.send(values, { ...input, html: wrapHtml(input.html, app.siteName, app.primaryColor) });
      else {
      const { tx, from } = await this.transport(values);
      await tx.sendMail({
        from,
        to: input.to,
        bcc: input.bcc,
        subject: input.subject,
        html: wrapHtml(input.html, app.siteName, app.primaryColor),
        text: input.text,
        replyTo: input.replyTo,
      });
      }
      // Counted for Admin → Cost & usage (free SMTP plans have daily limits).
      await this.prisma.integrationLog
        .create({ data: { integration: key, action: 'send', success: true, meta: { recipients: count } } })
        .catch(() => undefined);
    } catch (e) {
      await this.prisma.integrationLog
        .create({ data: { integration: key, action: 'send', success: false, message: (e as Error).message.slice(0, 300) } })
        .catch(() => undefined);
      throw e;
    }
  }

  /** Send using an admin-editable template (Template table, falling back to built-in defaults). */
  async sendTemplate(key: string, to: string | string[], vars: Record<string, unknown>) {
    const tpl = await this.prisma.template.findUnique({ where: { key } });
    const def = DEFAULT_TEMPLATES.find((t) => t.key === key);
    const subject = tpl?.isActive ? tpl.subject : def?.subject;
    const body = tpl?.isActive ? tpl.body : def?.body;
    if (!body) throw new Error(`Template ${key} not found`);
    const app = await this.settings.getAppConfig();
    const all = { app, ...vars };
    await this.send({ to, subject: renderTemplate(subject ?? app.siteName, all), html: renderTemplate(body, all) });
  }

  /** Best effort — never throws (used for notifications). */
  async trySendTemplate(key: string, to: string | string[], vars: Record<string, unknown>) {
    try {
      if (!(await this.isConfigured())) return false;
      await this.sendTemplate(key, to, vars);
      return true;
    } catch (e) {
      this.logger.warn(`mail ${key} failed: ${(e as Error).message}`);
      return false;
    }
  }

  async testZoho(values: Record<string, unknown>, to: string) {
    await this.zoho.send(values, { to, subject: 'BrokerIQ Zoho HTTPS email test', html: '<p>यह BrokerIQ का Zoho HTTPS sender test है। इस email की inbox में प्राप्ति delivery का प्रमाण है; production workflows की acceptance अलग से होगी।</p>' });
  }

  async test(values: Record<string, unknown>, to: string) {
    const { tx, from } = await this.transport(values);
    await tx.verify();
    await tx.sendMail({ from, to, subject: 'BrokerIQ SMTP test ✔', html: '<p>SMTP सही से configure हो गया है। 🎉</p>' });
  }
}

function wrapHtml(inner: string, siteName: string, color: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5fb;font-family:Inter,Segoe UI,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${color};padding:20px 28px;color:#fff;font-size:20px;font-weight:700">${siteName}</td></tr>
<tr><td style="padding:28px;color:#1e293b;font-size:15px;line-height:1.6">${inner}</td></tr>
<tr><td style="padding:16px 28px;color:#94a3b8;font-size:12px;border-top:1px solid #eef0f6">© ${new Date().getFullYear()} ${siteName}</td></tr>
</table></td></tr></table></body></html>`;
}
