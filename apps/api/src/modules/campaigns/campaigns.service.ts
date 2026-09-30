import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Campaign, Prisma } from '@prisma/client';
import type { CampaignInput, CampaignSegment } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { MailService } from '../../core/mail/mail.service';
import { SettingsService } from '../../core/settings/settings.service';
import { UsageService } from '../../core/usage/usage.service';
import { AuditService } from '../../core/audit/audit.service';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { istDay, paginate, paged, signId, verifySignedId } from '../../common/utils';
import type { RequestUser } from '../../common/decorators';
import { env } from '../../config/env';

/** Recipients handled per job run; the job re-queues itself, so a big campaign never blocks the queue. */
const BATCH = 20;
const BATCH_GAP_MS = 6_000;
/** Campaign emails go through the platform SMTP (free tiers ~300/day), so each firm gets a daily share. */
const EMAIL_DAILY_CAP = 200;
const MAX_RECIPIENTS = 5_000;
const UNSUBSCRIBE = 'unsub';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const fill = (text: string, name: string) => text.replace(/\{name\}/gi, firstName(name));
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

@Injectable()
export class CampaignsService implements OnModuleInit {
  private readonly logger = new Logger(CampaignsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly usage: UsageService,
    private readonly audit: AuditService,
    private readonly wa: WhatsAppService,
  ) {}

  onModuleInit() {
    this.jobs.register('campaign.batch', (p) => this.runBatch(p.campaignId));
  }

  // ------------------------------------------------------------------ audience
  audienceWhere(orgId: string, s: CampaignSegment): Prisma.LeadWhereInput {
    const req: Prisma.LeadRequirementWhereInput = {};
    if (s.bedrooms?.length) req.bedrooms = { hasSome: s.bedrooms };
    if (s.localityIds?.length) req.localityIds = { hasSome: s.localityIds };
    // Budget overlap: the lead's range touches the chosen range.
    if (s.minBudget) req.OR = [{ maxBudget: null }, { maxBudget: { gte: s.minBudget } }];
    if (s.maxBudget) req.AND = [{ OR: [{ minBudget: null }, { minBudget: { lte: s.maxBudget } }] }];
    return {
      organizationId: orgId,
      deletedAt: null,
      optedOutAt: null,
      ...(s.stages?.length ? { stage: { in: s.stages } } : {}),
      ...(s.sources?.length ? { source: { in: s.sources } } : {}),
      ...(s.temperatures?.length ? { temperature: { in: s.temperatures } } : {}),
      ...(s.tags?.length ? { tags: { hasSome: s.tags } } : {}),
      ...(Object.keys(req).length ? { requirement: req } : {}),
      ...(s.activeWithinDays ? { lastActivityAt: { gte: new Date(Date.now() - s.activeWithinDays * 86_400_000) } } : {}),
    };
  }

  async preview(orgId: string, segment: CampaignSegment) {
    const where = this.audienceWhere(orgId, segment);
    const [total, withEmail, optedOut] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: { ...where, email: { not: null } } }),
      this.prisma.lead.count({ where: { ...where, optedOutAt: { not: null } } }),
    ]);
    const sample = await this.prisma.lead.findMany({ where, take: 5, orderBy: { score: 'desc' }, select: { id: true, name: true, stage: true } });
    return { total, withPhone: total, withEmail, optedOut, sample, whatsappConnected: !!(await this.settings.resolve('whatsapp', orgId)) };
  }

  // ------------------------------------------------------------------ CRUD
  list(orgId: string) {
    return this.prisma.campaign.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async get(orgId: string | null, id: string, page = 1) {
    const c = await this.prisma.campaign.findFirst({ where: { id, ...(orgId ? { organizationId: orgId } : {}) } });
    if (!c) throw new NotFoundException('Campaign नहीं मिला');
    const { skip, take } = paginate(page, 50);
    const [items, total] = await Promise.all([
      this.prisma.campaignRecipient.findMany({ where: { campaignId: id }, orderBy: [{ status: 'asc' }, { name: 'asc' }], skip, take }),
      this.prisma.campaignRecipient.count({ where: { campaignId: id } }),
    ]);
    return { ...c, recipients: paged(items, total, page, take) };
  }

  create(orgId: string, userId: string, input: CampaignInput) {
    return this.prisma.campaign.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        name: input.name,
        channel: input.channel,
        segment: input.segment as Prisma.InputJsonValue,
        templateName: input.templateName || null,
        templateLanguage: input.templateLanguage || null,
        params: input.params,
        emailSubject: input.emailSubject || null,
        emailBody: input.emailBody || null,
      },
    });
  }

  async update(orgId: string, id: string, input: CampaignInput) {
    const c = await this.draft(orgId, id);
    return this.prisma.campaign.update({
      where: { id: c.id },
      data: {
        name: input.name,
        channel: input.channel,
        segment: input.segment as Prisma.InputJsonValue,
        templateName: input.templateName || null,
        templateLanguage: input.templateLanguage || null,
        params: input.params,
        emailSubject: input.emailSubject || null,
        emailBody: input.emailBody || null,
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.draft(orgId, id);
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }

  private async draft(orgId: string, id: string) {
    const c = await this.prisma.campaign.findFirst({ where: { id, organizationId: orgId } });
    if (!c) throw new NotFoundException('Campaign नहीं मिला');
    if (c.status !== 'DRAFT') throw new BadRequestException('भेजा जा चुका campaign बदला नहीं जा सकता — नया बनाएँ');
    return c;
  }

  // ------------------------------------------------------------------ sending
  async start(user: RequestUser, orgId: string, id: string) {
    const c = await this.draft(orgId, id);
    const wantsWa = c.channel !== 'EMAIL';
    const wantsEmail = c.channel !== 'WHATSAPP';
    if (wantsWa) {
      if (!(await this.settings.resolve('whatsapp', orgId)))
        throw new IntegrationNotConfiguredException(
          'whatsapp',
          'Campaign आपके अपने WhatsApp Business number से जाते हैं — Broker panel → Connectors में "My WhatsApp Business number" जोड़ें।',
        );
      const tpl = await this.prisma.whatsAppTemplate.findFirst({
        where: { organizationId: orgId, name: c.templateName ?? '', ...(c.templateLanguage ? { language: c.templateLanguage } : {}) },
      });
      if (!tpl) throw new BadRequestException('WhatsApp template नहीं मिला — Inbox → Templates में "Sync" करें और approved template चुनें');
      if (tpl.status && tpl.status !== 'APPROVED') throw new BadRequestException(`Template "${tpl.name}" अभी approved नहीं है (${tpl.status})`);
      if (!c.templateLanguage) await this.prisma.campaign.update({ where: { id }, data: { templateLanguage: tpl.language } });
    }
    if (wantsEmail && !(await this.settings.resolve('smtp'))) throw new IntegrationNotConfiguredException('smtp');

    const leads = await this.prisma.lead.findMany({
      where: this.audienceWhere(orgId, c.segment as CampaignSegment),
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { score: 'desc' },
      take: MAX_RECIPIENTS,
    });
    if (!leads.length) throw new BadRequestException('इस segment में कोई lead नहीं है (STOP करने वाले leads अपने-आप हटते हैं)');
    await this.prisma.$transaction([
      this.prisma.campaignRecipient.createMany({
        data: leads.map((l) => ({ campaignId: id, leadId: l.id, name: l.name, phone: l.phone, email: l.email })),
      }),
      this.prisma.campaign.update({ where: { id }, data: { status: 'RUNNING', startedAt: new Date(), total: leads.length } }),
    ]);
    await this.audit.log(user, 'campaign.start', 'Campaign', id, { total: leads.length, channel: c.channel });
    await this.jobs.enqueue('campaign.batch', { campaignId: id }, { key: `campaign:${id}`, maxAttempts: 3 });
    return this.get(orgId, id);
  }

  async cancel(orgId: string | null, id: string, user: RequestUser) {
    const c = await this.prisma.campaign.findFirst({ where: { id, ...(orgId ? { organizationId: orgId } : {}) } });
    if (!c) throw new NotFoundException('Campaign नहीं मिला');
    if (c.status !== 'RUNNING' && c.status !== 'DRAFT') return c;
    const skipped = await this.prisma.campaignRecipient.updateMany({
      where: { campaignId: id, status: 'PENDING' },
      data: { status: 'SKIPPED', error: 'Cancelled' },
    });
    await this.jobs.cancel(`campaign:${id}`);
    await this.audit.log(user, 'campaign.cancel', 'Campaign', id);
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'CANCELLED', finishedAt: new Date(), skipped: { increment: skipped.count } },
    });
  }

  /** Sends the next BATCH recipients, then schedules itself again until none are left. */
  async runBatch(campaignId: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id: campaignId }, include: { organization: { select: { name: true, status: true } } } });
    if (!c || c.status !== 'RUNNING') return;
    if (c.organization.status !== 'ACTIVE') {
      await this.prisma.campaign.update({ where: { id: c.id }, data: { status: 'CANCELLED', finishedAt: new Date() } });
      return;
    }
    const batch = await this.prisma.campaignRecipient.findMany({ where: { campaignId, status: 'PENDING' }, take: BATCH, include: { lead: true } });
    if (!batch.length) {
      await this.prisma.campaign.update({ where: { id: c.id }, data: { status: 'DONE', finishedAt: new Date() } });
      return;
    }
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const r of batch) {
      const result = await this.deliver(c, r).catch((e: Error) => ({ status: 'FAILED' as const, error: e.message.slice(0, 300), channel: null }));
      await this.prisma.campaignRecipient.update({
        where: { id: r.id },
        data: { status: result.status, error: result.error ?? null, channel: result.channel, sentAt: result.status === 'SENT' ? new Date() : null },
      });
      if (result.status === 'SENT') sent++;
      else if (result.status === 'FAILED') failed++;
      else skipped++;
    }
    await this.prisma.campaign.update({
      where: { id: c.id },
      data: { sent: { increment: sent }, failed: { increment: failed }, skipped: { increment: skipped } },
    });
    // Next batch after a short pause (keeps Meta / SMTP rate limits happy).
    await this.jobs.enqueue('campaign.batch', { campaignId: c.id }, { runAt: new Date(Date.now() + BATCH_GAP_MS), maxAttempts: 3 });
  }

  private async deliver(
    c: Campaign & { organization: { name: string } },
    r: { id: string; name: string; phone: string | null; email: string | null; lead: { id: string; optedOutAt: Date | null; deletedAt: Date | null } | null },
  ): Promise<{ status: 'SENT' | 'FAILED' | 'SKIPPED'; error?: string; channel: string | null }> {
    if (!r.lead || r.lead.deletedAt) return { status: 'SKIPPED', error: 'Lead हट चुकी है', channel: null };
    if (r.lead.optedOutAt) return { status: 'SKIPPED', error: 'Lead ने STOP किया', channel: null };
    const channels: string[] = [];
    const errors: string[] = [];
    if (c.channel !== 'EMAIL' && r.phone && c.templateName) {
      try {
        await this.wa.send(
          c.organizationId,
          r.phone,
          { type: 'template', name: c.templateName, language: c.templateLanguage ?? 'en', params: c.params.map((p) => fill(p, r.name)) },
          { leadId: r.lead.id, contactName: r.name, meta: { campaignId: c.id }, ownNumberOnly: true },
        );
        channels.push('WHATSAPP');
      } catch (e) {
        errors.push(`WhatsApp: ${(e as Error).message}`);
      }
    }
    if (c.channel !== 'WHATSAPP' && r.email && c.emailSubject && c.emailBody) {
      const day = istDay();
      if ((await this.usage.count(c.organizationId, 'campaign-email-day', day)) >= EMAIL_DAILY_CAP) {
        errors.push(`Email: आज की email limit (${EMAIL_DAILY_CAP}) पूरी — बाकी कल भेजें`);
      } else {
        try {
          const unsub = `${env().PUBLIC_API_URL}/api/public/unsubscribe/${signId(UNSUBSCRIBE, r.lead.id)}`;
          const body = escapeHtml(fill(c.emailBody, r.name)).replace(/\n/g, '<br>');
          await this.mail.send({
            to: r.email,
            subject: fill(c.emailSubject, r.name),
            html: `<p>${body}</p><p style="color:#64748b;font-size:12px;margin-top:24px">— ${escapeHtml(c.organization.name)}<br><a href="${unsub}">ऐसे emails बंद करें (unsubscribe)</a></p>`,
          });
          await this.usage.increment(c.organizationId, 'campaign-email-day', 1, day);
          channels.push('EMAIL');
        } catch (e) {
          errors.push(`Email: ${(e as Error).message}`);
        }
      }
    }
    if (channels.length) return { status: 'SENT', channel: channels.join('+'), error: errors.join(' · ') || undefined };
    if (errors.length) return { status: 'FAILED', error: errors.join(' · '), channel: null };
    return { status: 'SKIPPED', error: c.channel === 'EMAIL' ? 'Email नहीं है' : 'Phone नहीं है', channel: null };
  }

  /** Public unsubscribe link from campaign emails. */
  async unsubscribe(token: string) {
    const leadId = verifySignedId(UNSUBSCRIBE, token);
    if (!leadId) throw new NotFoundException('Link गलत या पुराना है');
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, include: { organization: { select: { name: true } } } });
    if (!lead) throw new NotFoundException('Link गलत या पुराना है');
    if (!lead.optedOutAt) {
      await this.prisma.lead.update({ where: { id: leadId }, data: { optedOutAt: new Date() } });
      await this.prisma.activity.create({
        data: { organizationId: lead.organizationId, leadId, type: 'SYSTEM', content: '🔕 Lead ने campaign emails unsubscribe किए' },
      });
    }
    return lead.organization.name;
  }

  // ------------------------------------------------------------------ BrokerIQ team (kill switch)
  adminList(status?: string) {
    return this.prisma.campaign.findMany({
      where: status ? { status: status as Campaign['status'] } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });
  }
}
