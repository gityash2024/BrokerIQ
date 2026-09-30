import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../core/events/events.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { SettingsService } from '../../core/settings/settings.service';
import { FeaturesService } from '../../core/features/features.service';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import { ShareKitService } from '../listings/share-kit.service';
import { GRAPH } from '../integrations/integration-tester.service';

type Platform = 'FACEBOOK' | 'INSTAGRAM';

/**
 * Posts live listings to the firm's own Facebook Page / Instagram (Graph API, free).
 * The image is the branded share-kit card, the caption links back to the listing (tracked short link).
 */
@Injectable()
export class SocialService implements OnModuleInit {
  private readonly logger = new Logger(SocialService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly jobs: JobsService,
    private readonly settings: SettingsService,
    private readonly features: FeaturesService,
    private readonly kit: ShareKitService,
  ) {}

  onModuleInit() {
    this.jobs.register('social.post', async (p) => void (await this.post(p.listingId)));
    this.events.on('listing.published', async ({ listingId }) => {
      const l = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { organization: { select: { id: true, socialAutoPost: true } } } });
      if (!l?.organization?.socialAutoPost || !(await this.features.isEnabled('social_autopost'))) return;
      if (!(await this.settings.resolve('meta_pages', l.organization.id))) return;
      await this.jobs.enqueue('social.post', { listingId }, { key: `social:${listingId}`, maxAttempts: 2 });
    });
  }

  list(orgId: string) {
    return this.prisma.socialPost.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /** Posts one listing now (auto-post job or the broker's "Post करें" button). Already-posted platforms are skipped. */
  async post(listingId: string, orgId?: string) {
    const l = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null, status: 'ACTIVE', ...(orgId ? { organizationId: orgId } : {}) },
      select: { id: true, organizationId: true, postedById: true },
    });
    if (!l?.organizationId) throw new NotFoundException('Live listing नहीं मिली');
    const creds = await this.settings.resolve('meta_pages', l.organizationId);
    if (!creds) throw new IntegrationNotConfiguredException('meta_pages');
    const kit = await this.kit.create(l.organizationId, l.postedById, l.id);
    const token = String(creds.accessToken);
    const targets: Platform[] = ['FACEBOOK', ...(creds.igUserId ? (['INSTAGRAM'] as const) : [])];
    const done = await this.prisma.socialPost.findMany({ where: { listingId, status: 'POSTED' }, select: { platform: true } });
    const results: { platform: Platform; ok: boolean; error?: string }[] = [];
    for (const platform of targets.filter((t) => !done.some((d) => d.platform === t))) {
      try {
        const externalId =
          platform === 'FACEBOOK'
            ? await this.graph(`${creds.pageId}/photos`, { url: kit.images.post, caption: kit.caption }, token)
            : await this.instagram(String(creds.igUserId), `${kit.images.post}&type=jpg`, kit.caption, token);
        await this.record(l.organizationId, listingId, platform, 'POSTED', externalId);
        results.push({ platform, ok: true });
      } catch (e) {
        const msg = (e as Error).message.slice(0, 400);
        await this.record(l.organizationId, listingId, platform, 'FAILED', null, msg);
        this.logger.warn(`social ${platform} ${listingId}: ${msg}`);
        results.push({ platform, ok: false, error: msg });
      }
    }
    return results;
  }

  private async instagram(igUserId: string, imageUrl: string, caption: string, token: string) {
    const creation = await this.graph(`${igUserId}/media`, { image_url: imageUrl, caption }, token);
    return this.graph(`${igUserId}/media_publish`, { creation_id: creation }, token);
  }

  private async graph(path: string, body: Record<string, string>, token: string): Promise<string> {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: token }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const e = data?.error;
      const hint =
        e?.code === 190
          ? 'Token expire/गलत है — Connectors में नया token डालें'
          : e?.code === 10 || e?.code === 200
            ? 'Permission नहीं है (pages_manage_posts / instagram_content_publish) — token दोबारा बनाएँ'
            : (e?.error_user_msg ?? e?.message ?? `Meta ${res.status}`);
      throw new Error(hint);
    }
    return String(data.post_id ?? data.id);
  }

  private record(orgId: string, listingId: string, platform: Platform, status: string, externalId: string | null, error?: string) {
    return this.prisma.socialPost.upsert({
      where: { listingId_platform: { listingId, platform } },
      create: { organizationId: orgId, listingId, platform, status, externalId, error: error ?? null },
      update: { status, externalId, error: error ?? null, createdAt: new Date() },
    });
  }
}
