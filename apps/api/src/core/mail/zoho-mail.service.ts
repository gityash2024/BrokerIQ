import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { IntegrationFailedException, IntegrationNotConfiguredException } from '../../common/exceptions';
import type { MailInput } from './mail.service';

const centers = {
  IN: { accounts: 'https://accounts.zoho.in', mail: 'https://mail.zoho.in' },
  US: { accounts: 'https://accounts.zoho.com', mail: 'https://mail.zoho.com' },
  EU: { accounts: 'https://accounts.zoho.eu', mail: 'https://mail.zoho.eu' },
  AU: { accounts: 'https://accounts.zoho.com.au', mail: 'https://mail.zoho.com.au' },
  JP: { accounts: 'https://accounts.zoho.jp', mail: 'https://mail.zoho.jp' },
  CA: { accounts: 'https://accounts.zohocloud.ca', mail: 'https://mail.zohocloud.ca' },
} as const;
const setupSchema = z.object({
  region: z.enum(['IN', 'US', 'EU', 'AU', 'JP', 'CA']).default('IN'),
  clientId: z.string().trim().min(1).max(500),
  clientSecret: z.string().trim().min(1).max(4096),
  fromEmail: z.string().email(),
  accountId: z.string().regex(/^\d+$/).optional(),
});
const configSchema = setupSchema.extend({ refreshToken: z.string().trim().min(1).max(4096) });
type Config = z.infer<typeof configSchema>;
type Token = { value: string; expires: number };
const addresses = (input: string | string[] | undefined) => {
  const values = input === undefined ? [] : Array.isArray(input) ? input : [input];
  return z.array(z.string().email()).max(100).parse(values).join(',');
};
const safeCode = (value: unknown) => (typeof value === 'string' && /^[A-Z_a-z0-9.-]{1,80}$/.test(value) ? value : 'provider_rejected_request');
const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Send-only provider. No message-read/delete or organization administrator API is used. */
@Injectable()
export class ZohoMailService {
  private tokens = new Map<string, Token>();
  private refreshing = new Map<string, Promise<Token>>();
  private key(config: Config) {
    return createHash('sha256').update(JSON.stringify(config)).digest('hex');
  }
  private async json(url: string, init: RequestInit) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(12_000) });
    } catch {
      throw new IntegrationFailedException('zoho_mail', 'Provider connection failed or timed out; no automatic resend was attempted.');
    }
    const data = await response.json().catch(() => null);
    return { response, data };
  }
  private async token(config: Config): Promise<Token> {
    const key = this.key(config);
    const existing = this.tokens.get(key);
    if (existing && existing.expires > Date.now() + 60_000) return existing;
    const pending = this.refreshing.get(key);
    if (pending) return pending;
    const refresh = (async () => {
      const { response, data } = await this.json(`${centers[config.region].accounts}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: config.refreshToken,
        }),
      });
      if (!response.ok || !data?.access_token || data.error)
        throw new IntegrationFailedException('zoho_mail', `OAuth refresh rejected (${safeCode(data?.error)}). Reconnect the authorized mailbox.`);
      const token = { value: String(data.access_token), expires: Date.now() + Math.min(Number(data.expires_in) || 3600, 3600) * 1000 };
      if (this.tokens.size > 8) this.tokens.clear();
      this.tokens.set(key, token);
      return token;
    })();
    this.refreshing.set(key, refresh);
    try {
      return await refresh;
    } finally {
      this.refreshing.delete(key);
    }
  }
  async authorize(values: Record<string, unknown>, code: string): Promise<string> {
    const parsed = setupSchema.safeParse(values);
    if (!parsed.success)
      throw new IntegrationNotConfiguredException('zoho_mail', 'Save Client ID, Client Secret, region and sender email before authorization.');
    if (!code.trim() || code.length > 4096) throw new IntegrationFailedException('zoho_mail', 'A valid short-lived authorization code is required.');
    const v = parsed.data;
    const { response, data } = await this.json(`${centers[v.region].accounts}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: v.clientId, client_secret: v.clientSecret, code: code.trim() }),
    });
    if (!response.ok || !data?.refresh_token || data.error)
      throw new IntegrationFailedException('zoho_mail', `Authorization rejected (${safeCode(data?.error)}). Generate a fresh code with the documented scopes.`);
    return String(data.refresh_token);
  }
  private async request(config: Config, path: string, init: RequestInit = {}) {
    let token = await this.token(config);
    let result = await this.json(`${centers[config.region].mail}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Zoho-oauthtoken ${token.value}` },
    });
    // Only an explicit authentication rejection is safe to retry. Never resend after timeout/5xx.
    if (result.response.status === 401 || result.data?.status?.code === 401) {
      if (this.tokens.get(this.key(config))?.value === token.value) this.tokens.delete(this.key(config));
      token = await this.token(config);
      result = await this.json(`${centers[config.region].mail}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Zoho-oauthtoken ${token.value}` },
      });
    }
    if (!result.response.ok || result.data?.status?.code !== 200)
      throw new IntegrationFailedException(
        'zoho_mail',
        `Mail API rejected request (HTTP ${result.response.status}, code ${safeCode(String(result.data?.status?.code || 'unknown'))}). Check account, sender alias, scopes and sending limits.`,
      );
    return result.data;
  }
  async send(values: Record<string, unknown>, input: MailInput) {
    const parsed = configSchema.safeParse(values);
    if (!parsed.success) throw new IntegrationNotConfiguredException('zoho_mail');
    const config = parsed.data;
    const toAddress = addresses(input.to),
      bccAddress = addresses(input.bcc);
    if (!toAddress) throw new IntegrationFailedException('zoho_mail', 'At least one valid recipient is required.');
    const accounts = await this.request(config, '/api/accounts');
    const account = Array.isArray(accounts.data)
      ? accounts.data.find(
          (row: any) =>
            (!config.accountId || String(row.accountId) === config.accountId) &&
            row.outgoingBlocked !== true &&
            row.enabled === true &&
            row.emailAddress?.some((alias: any) => String(alias.mailId).toLowerCase() === config.fromEmail.toLowerCase() && alias.isConfirmed === true),
        )
      : null;
    if (!account?.accountId || !/^\d+$/.test(String(account.accountId)))
      throw new IntegrationFailedException('zoho_mail', 'The configured sender is not a confirmed alias on an enabled authorized account.');
    let content = input.html;
    // Zoho's documented send API has no per-message Reply-To field. Keep the firm's reply destination explicit.
    if (input.replyTo && input.replyTo.toLowerCase() !== config.fromEmail.toLowerCase()) {
      const reply = z.string().email().parse(input.replyTo);
      const note = `<p>Reply to the firm: <a href="mailto:${escape(reply)}">${escape(reply)}</a></p>`;
      content = content.includes('</body>') ? content.replace('</body>', note + '</body>') : content + note;
    }
    const sent = await this.request(config, `/api/accounts/${account.accountId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAddress: config.fromEmail,
        toAddress,
        ...(bccAddress ? { bccAddress } : {}),
        subject: input.subject,
        content,
        mailFormat: 'html',
        encoding: 'UTF-8',
        askReceipt: 'no',
      }),
    });
    return { accepted: true, messageId: sent.data?.messageId ? String(sent.data.messageId) : null };
  }
}
