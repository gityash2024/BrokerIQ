import { createHash } from 'node:crypto';
import { z } from 'zod';
import { simpleParser } from 'mailparser';
import { IntegrationFailedException, IntegrationNotConfiguredException } from '../../common/exceptions';
import type { IntegrationValues } from '../settings/settings.service';

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'] as const;
const clientSchema = z.object({ clientId: z.string().regex(/^[A-Za-z0-9_.-]+\.apps\.googleusercontent\.com$/), clientSecret: z.string().min(8).max(4096) });
export function gmailClient(values: IntegrationValues | null) {
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) throw new IntegrationNotConfiguredException('gmail_oauth', 'Super Admin में Gmail OAuth client और exact callback URL configure करें।');
  return parsed.data;
}
export class GmailRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly ambiguous: boolean,
  ) {
    super(
      ambiguous
        ? 'Email send status uncertain. Check the Gmail Sent folder before sending again.'
        : `Gmail request failed (${status}). Reconnect or check provider limits.`,
    );
  }
}
async function json(url: string, init: RequestInit, mutation = false): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), redirect: 'error' });
  } catch {
    throw new GmailRequestError(0, mutation);
  }
  if (!res.ok) throw new GmailRequestError(res.status, mutation && res.status >= 500);
  // Bound email bodies/metadata; no attachment downloads or provider error text/credentials in logs.
  const reader = res.body?.getReader();
  let size = 0;
  const chunks: Buffer[] = [];
  if (!reader) throw new GmailRequestError(res.status, mutation);
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 5_000_000) {
        await reader.cancel();
        throw new Error('limit');
      }
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new GmailRequestError(res.status, mutation);
  }
}
export async function gmailExchange(values: IntegrationValues, code: string, verifier: string, redirectUri: string) {
  const client = gmailClient(values);
  const token = await json('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const granted = new Set(String(token.scope || '').split(' '));
  if (!GMAIL_SCOPES.every((scope) => granted.has(scope)) || typeof token.refresh_token !== 'string' || typeof token.access_token !== 'string')
    throw new IntegrationFailedException('gmail', 'Both read/send permissions and offline authorization are required. Reconnect explicitly.');
  return { accessToken: token.access_token as string, refreshToken: token.refresh_token as string };
}
export async function gmailToken(clientValues: IntegrationValues, refreshToken: string) {
  const client = gmailClient(clientValues);
  const token = await json('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: client.clientId, client_secret: client.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (typeof token.access_token !== 'string') throw new GmailRequestError(401, false);
  return token.access_token as string;
}
export async function gmailApi(token: string, path: string, body?: unknown) {
  if (!/^\/(?:profile|messages(?:[/?].*)?)$/.test(path) || /[\r\n]/.test(path)) throw new Error('Invalid Gmail API path');
  return json(
    `https://gmail.googleapis.com/gmail/v1/users/me${path}`,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    body !== undefined,
  );
}
export const canonicalEmail = (value: unknown): string | null => {
  const parsed = z.string().email().max(254).safeParse(value);
  return parsed.success && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(parsed.data) ? parsed.data.toLowerCase() : null;
};
export function gmailMime(input: { from: string; to: string; subject: string; text: string; requestKey: string; replyTo?: string }) {
  const from = canonicalEmail(input.from),
    to = canonicalEmail(input.to);
  if (!from || !to || /[\r\n]/.test(input.subject) || !input.subject.trim() || input.subject.length > 200 || !input.text.trim() || input.text.length > 20_000)
    throw new Error('Invalid email headers/content');
  const subject = `=?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`;
  const messageId = `<${createHash('sha256').update(input.requestKey).digest('hex')}@brokeriq.mymultimeds.com>`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (input.replyTo && /^<[^\r\n<>]{1,500}>$/.test(input.replyTo)) lines.push(`In-Reply-To: ${input.replyTo}`, `References: ${input.replyTo}`);
  return {
    raw: Buffer.from(
      lines.join('\r\n') +
        '\r\n\r\n' +
        Buffer.from(input.text)
          .toString('base64')
          .match(/.{1,76}/g)!
          .join('\r\n'),
    ).toString('base64url'),
    messageId,
  };
}
export function gmailContactQuery(email: string, since: Date) {
  const address = canonicalEmail(email);
  if (!address || !Number.isFinite(since.getTime())) throw new Error('Invalid Gmail contact');
  return `{from:${address} to:${address}} after:${Math.floor(since.getTime() / 1000)} -in:trash -in:spam`;
}
export function gmailPlainBody(payload: any): string {
  let bytes = 0;
  let nodes = 0;
  const parts: string[] = [];
  const visit = (part: any, depth: number) => {
    if (!part || depth > 8 || ++nodes > 100) return;
    if (part.mimeType === 'text/plain' && typeof part.body?.data === 'string' && !part.filename) {
      const text = Buffer.from(part.body.data.slice(0, 180_000), 'base64url').toString('utf8');
      bytes += text.length;
      if (bytes <= 128_000) parts.push(text);
    }
    if (Array.isArray(part.parts)) for (const child of part.parts.slice(0, 100)) visit(child, depth + 1);
  };
  visit(payload, 0);
  return parts.join('\n').slice(0, 128_000);
}
/** HTML-only messages are converted locally to text; HTML and remote images never reach the CRM renderer. */
export async function gmailBody(payload: any): Promise<string> {
  const plain = gmailPlainBody(payload);
  if (plain.trim()) return plain;
  let html = '';
  let nodes = 0;
  const visit = (part: any, depth: number) => {
    if (!part || depth > 8 || ++nodes > 100 || html || part.filename) return;
    if (part.mimeType === 'text/html' && typeof part.body?.data === 'string')
      html = Buffer.from(part.body.data.slice(0, 170_000), 'base64url').toString('utf8').slice(0, 128_000);
    if (Array.isArray(part.parts)) for (const child of part.parts.slice(0, 100)) visit(child, depth + 1);
  };
  visit(payload, 0);
  if (!html) return '';
  const parsed = await simpleParser(`Content-Type: text/html; charset=UTF-8\r\n\r\n${html}`, {
    skipHtmlToText: false,
    skipTextToHtml: true,
    skipImageLinks: true,
    maxHtmlLengthToParse: 128_000,
  });
  return (parsed.text || '').slice(0, 128_000);
}
