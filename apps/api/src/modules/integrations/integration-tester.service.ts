import { BadRequestException, Injectable } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { getIntegration } from '@brokeriq/shared';
import { SettingsService } from '../../core/settings/settings.service';
import { MailService } from '../../core/mail/mail.service';
import { AiService } from '../../core/ai/ai.service';
import { MediaService } from '../../core/media/media.service';
import { PrismaService } from '../../prisma/prisma.service';
import { fetchHousingLeads } from '../connectors/portals/housing.client';
import { exotelAuth, exotelBase } from '../calls/calls.service';

export const GRAPH = 'https://graph.facebook.com/v21.0';

/** Runs a real, harmless API call against a provider to verify saved credentials. */
@Injectable()
export class IntegrationTesterService {
  constructor(
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly ai: AiService,
    private readonly media: MediaService,
    private readonly prisma: PrismaService,
  ) {}

  async test(key: string, orgId: string | null, actorEmail: string): Promise<{ ok: boolean; message: string }> {
    const def = getIntegration(key);
    if (!def) throw new BadRequestException('Unknown integration');
    const values = await this.settings.resolve(key, orgId);
    if (!values) {
      const r = { ok: false, message: 'पहले सारे required fields भरकर Save करें।' };
      await this.settings.recordTest(key, orgId, false, r.message).catch(() => undefined);
      return r;
    }
    let result: { ok: boolean; message: string };
    try {
      result = { ok: true, message: await this.run(key, values, actorEmail) };
    } catch (e) {
      result = { ok: false, message: (e as Error).message || 'Test failed' };
    }
    await this.settings.recordTest(key, orgId, result.ok, result.message);
    await this.prisma.integrationLog.create({ data: { organizationId: orgId, integration: key, action: 'test', success: result.ok, message: result.message.slice(0, 500) } });
    return result;
  }

  private async run(key: string, v: Record<string, any>, actorEmail: string): Promise<string> {
    switch (key) {
      case 'smtp':
        await this.mail.test(v, actorEmail);
        return `SMTP connected — test email ${actorEmail} पर भेजा गया`;
      case 'groq':
      case 'gemini':
        return `AI response: ${await this.ai.test(key, v)}`;
      case 'cloudinary':
        return `Cloudinary: ${await this.media.testCloudinary(v)}`;
      case 's3':
        await this.media.testS3(v);
        return 'Bucket reachable';
      case 'razorpay': {
        const res = await fetch('https://api.razorpay.com/v1/orders?count=1', { headers: { Authorization: 'Basic ' + Buffer.from(`${v.keyId}:${v.keySecret}`).toString('base64') } });
        if (!res.ok) throw new Error(`Razorpay ${res.status}: ${(await res.json().catch(() => ({})) as any)?.error?.description ?? 'invalid keys'}`);
        return `Razorpay keys valid (${String(v.keyId).startsWith('rzp_live') ? 'LIVE' : 'TEST'} mode)`;
      }
      case 'whatsapp':
      case 'whatsapp_platform': {
        const res = await fetch(`${GRAPH}/${v.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${v.accessToken}` } });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message ?? `Meta ${res.status}`);
        return `Connected: ${data.verified_name ?? ''} ${data.display_phone_number ?? ''} (quality: ${data.quality_rating ?? 'n/a'})`;
      }
      case 'meta_leads': {
        const res = await fetch(`${GRAPH}/${v.pageId}?fields=name&access_token=${encodeURIComponent(v.pageAccessToken)}`);
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message ?? `Meta ${res.status}`);
        return `Page connected: ${data.name}`;
      }
      case 'email_inbox': {
        const client = new ImapFlow({ host: v.host, port: Number(v.port), secure: v.secure !== false, auth: { user: v.user, pass: v.pass }, logger: false });
        await client.connect();
        const box = await client.mailboxOpen('INBOX');
        await client.logout();
        return `Inbox connected — ${box.exists} emails`;
      }
      case 'housing_api': {
        const now = Math.floor(Date.now() / 1000);
        const rows = await fetchHousingLeads({ profileId: v.profileId, encryptionKey: v.encryptionKey, accountType: v.accountType, listingIds: v.listingIds }, now - 7 * 86400, now);
        return `Housing connected — पिछले 7 दिन में ${rows.length} leads`;
      }
      case 'exotel': {
        const res = await fetch(`${exotelBase(v as any)}.json`, { headers: { Authorization: exotelAuth(v as any) } });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`Exotel ${res.status}: ${data?.RestException?.Message ?? 'API key / token / SID गलत है'}`);
        return `Exotel connected: ${data?.Account?.FriendlyName ?? v.accountSid} (${data?.Account?.Status ?? 'active'})`;
      }
      case 'maptiler': {
        const res = await fetch(`https://api.maptiler.com/maps/${v.style ?? 'streets-v2'}/style.json?key=${v.apiKey}`);
        if (!res.ok) throw new Error(`MapTiler ${res.status}`);
        return 'MapTiler key valid';
      }
      default:
        return 'Saved (इस integration का automatic test उपलब्ध नहीं है)';
    }
  }
}
