import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, type AutomationRule, type AutomationTrigger, type Lead } from '@prisma/client';
import { LEAD_SOURCE_LABELS, renderTemplate, type AutomationRuleInput } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../core/events/events.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { MailService } from '../../core/mail/mail.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { UsageService } from '../../core/usage/usage.service';
import { SettingsService } from '../../core/settings/settings.service';
import { LeadsService } from '../leads/leads.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { env } from '../../config/env';

interface Action {
  type: string;
  delayMinutes: number;
  params: Record<string, any>;
}
interface Conditions {
  sources?: string[];
  stages?: string[];
  toStage?: string | null;
  noActivityHours?: number | null;
}
interface BusinessHours {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
}

const IST_OFFSET_MIN = 330;

/** Rule engine: LEAD_CREATED / STAGE_CHANGED / NO_ACTIVITY / VISIT_SCHEDULED / VISIT_REMINDER → actions. */
@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly logger = new Logger(AutomationService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly jobs: JobsService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly usage: UsageService,
    private readonly settings: SettingsService,
    private readonly leads: LeadsService,
    private readonly wa: WhatsAppService,
  ) {}

  onModuleInit() {
    this.events.on('lead.created', (e) => (e.isNew ? this.trigger('LEAD_CREATED', e.orgId, e.leadId) : undefined));
    this.events.on('lead.stage_changed', (e) => this.trigger('STAGE_CHANGED', e.orgId, e.leadId, { toStage: e.to }));
    this.events.on('visit.scheduled', (e) => this.trigger('VISIT_SCHEDULED', e.orgId, e.leadId, { visitId: e.visitId }));
    this.jobs.register('automation.action', (p) => this.runAction(p.ruleId, p.leadId, p.index, p.context ?? {}));
  }

  // ------------------------------------------------------------------ CRUD
  list(orgId: string) {
    return this.prisma.automationRule.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
  }

  async create(orgId: string, input: AutomationRuleInput) {
    const count = await this.prisma.automationRule.count({ where: { organizationId: orgId, isActive: true } });
    if (input.isActive) await this.usage.assert(orgId, 'automations', count);
    this.validate(input);
    return this.prisma.automationRule.create({ data: { organizationId: orgId, ...input, conditions: input.conditions as Prisma.InputJsonValue, actions: input.actions as Prisma.InputJsonValue } });
  }

  async update(orgId: string, id: string, input: Partial<AutomationRuleInput>) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, organizationId: orgId } });
    if (!rule) throw new NotFoundException();
    if (input.isActive && !rule.isActive) {
      const count = await this.prisma.automationRule.count({ where: { organizationId: orgId, isActive: true } });
      await this.usage.assert(orgId, 'automations', count);
    }
    if (input.actions) this.validate({ ...(rule as any), ...input });
    return this.prisma.automationRule.update({
      where: { id },
      data: { ...input, conditions: (input.conditions ?? undefined) as Prisma.InputJsonValue | undefined, actions: (input.actions ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  }

  async remove(orgId: string, id: string) {
    await this.prisma.automationRule.deleteMany({ where: { id, organizationId: orgId } });
    return { ok: true };
  }

  runs(orgId: string, ruleId: string) {
    return this.prisma.automationRun.findMany({ where: { ruleId, rule: { organizationId: orgId } }, orderBy: { createdAt: 'desc' }, take: 100, include: { lead: { select: { id: true, name: true } } } });
  }

  private validate(input: Pick<AutomationRuleInput, 'actions'>) {
    for (const a of input.actions) {
      if (a.type === 'SEND_WHATSAPP_TEXT' && !a.params?.text) throw new BadRequestException('WhatsApp text action में message लिखें');
      if (a.type === 'SEND_WHATSAPP_TEMPLATE' && !a.params?.templateName) throw new BadRequestException('Template name चुनें');
      if (a.type === 'SEND_EMAIL' && (!a.params?.subject || !a.params?.body)) throw new BadRequestException('Email subject और body लिखें');
      if (a.type === 'ASSIGN_TO' && !a.params?.userId) throw new BadRequestException('Assign के लिए team member चुनें');
      if (a.type === 'SET_STAGE' && !a.params?.stage) throw new BadRequestException('Stage चुनें');
    }
  }

  /** Ready-made rules the broker can add with one click. */
  presets() {
    return [
      {
        key: 'welcome_whatsapp',
        name: 'नई lead को तुरंत WhatsApp welcome',
        trigger: 'LEAD_CREATED',
        conditions: { sources: [], stages: [] },
        actions: [{ type: 'SEND_WHATSAPP_TEXT', delayMinutes: 0, params: { text: 'नमस्ते {{lead.name}} 👋\n{{org.name}} से बात कर रहे हैं। आपकी enquiry मिल गई है — {{agent.name}} जल्दी ही आपसे संपर्क करेंगे। अपना budget, BHK और preferred location यहीं भेज दीजिए।' } }],
        respectBusinessHours: false,
      },
      {
        key: 'round_robin',
        name: 'Leads को team में बारी-बारी assign करें',
        trigger: 'LEAD_CREATED',
        conditions: { sources: [], stages: [] },
        actions: [{ type: 'ASSIGN_ROUND_ROBIN', delayMinutes: 0, params: {} }, { type: 'CREATE_FOLLOW_UP', delayMinutes: 0, params: { inMinutes: 15, type: 'CALL', note: 'नई lead — 15 मिनट में call करें' } }],
        respectBusinessHours: false,
      },
      {
        key: 'portal_drip',
        name: 'Portal leads — 3 दिन की drip',
        trigger: 'LEAD_CREATED',
        conditions: { sources: ['HOUSING', 'ACRES99', 'MAGICBRICKS', 'NOBROKER'], stages: [] },
        actions: [
          { type: 'SEND_WHATSAPP_TEXT', delayMinutes: 0, params: { text: 'Hi {{lead.name}}, {{source}} पर आपकी enquiry के लिए धन्यवाद! मैं {{agent.name}}, {{org.name}} से। क्या आज बात करने का सही समय बता सकते हैं?' } },
          { type: 'CREATE_FOLLOW_UP', delayMinutes: 60 * 24, params: { inMinutes: 0, type: 'CALL', note: 'Day-1 follow-up call' } },
          { type: 'SEND_WHATSAPP_TEXT', delayMinutes: 60 * 72, params: { text: '{{lead.name}} जी, आपकी requirement के हिसाब से कुछ नए options आए हैं — site visit plan करें?' } },
        ],
        respectBusinessHours: true,
      },
      {
        key: 'stale_alert',
        name: '48 घंटे तक कोई activity नहीं तो alert',
        trigger: 'NO_ACTIVITY',
        conditions: { sources: [], stages: ['NEW', 'CONTACTED', 'INTERESTED'], noActivityHours: 48 },
        actions: [{ type: 'NOTIFY_TEAM', delayMinutes: 0, params: { message: '⏰ {{lead.name}} पर 48 घंटे से कोई activity नहीं हुई' } }, { type: 'ADD_TAG', delayMinutes: 0, params: { tag: 'stale' } }],
        respectBusinessHours: false,
      },
      {
        key: 'visit_confirm',
        name: 'Site visit schedule होते ही confirmation',
        trigger: 'VISIT_SCHEDULED',
        conditions: { sources: [], stages: [] },
        actions: [{ type: 'SEND_WHATSAPP_TEXT', delayMinutes: 0, params: { text: 'नमस्ते {{lead.name}}, आपकी site visit {{visit.time}} पर confirm है। 📍 {{visit.address}}\n— {{agent.name}}, {{org.name}}' } }],
        respectBusinessHours: false,
      },
    ];
  }

  // ------------------------------------------------------------------ engine
  private matches(rule: AutomationRule, lead: Lead, ctx: Record<string, any>) {
    const c = (rule.conditions ?? {}) as Conditions;
    if (c.sources?.length && !c.sources.includes(lead.source)) return false;
    if (c.stages?.length && !c.stages.includes(lead.stage)) return false;
    if (rule.trigger === 'STAGE_CHANGED' && c.toStage && c.toStage !== ctx.toStage) return false;
    return true;
  }

  async trigger(trigger: AutomationTrigger, orgId: string, leadId: string, ctx: Record<string, any> = {}) {
    const rules = await this.prisma.automationRule.findMany({ where: { organizationId: orgId, trigger, isActive: true } });
    if (!rules.length) return;
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.deletedAt) return;
    for (const rule of rules) {
      if (!this.matches(rule, lead, ctx)) continue;
      await this.prisma.automationRule.update({ where: { id: rule.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
      await this.schedule(rule, leadId, ctx);
    }
  }

  private async schedule(rule: AutomationRule, leadId: string, ctx: Record<string, any>) {
    const actions = (rule.actions ?? []) as unknown as Action[];
    const org = await this.prisma.organization.findUnique({ where: { id: rule.organizationId } });
    const hours = (org?.businessHours as BusinessHours | null) ?? null;
    for (let i = 0; i < actions.length; i++) {
      let runAt = new Date(Date.now() + (actions[i].delayMinutes ?? 0) * 60_000);
      if (rule.respectBusinessHours && hours?.enabled) runAt = nextBusinessTime(runAt, hours);
      if (runAt.getTime() - Date.now() < 5_000) await this.runAction(rule.id, leadId, i, ctx);
      else await this.jobs.enqueue('automation.action', { ruleId: rule.id, leadId, index: i, context: ctx }, { runAt, key: `auto:${rule.id}:${leadId}:${i}:${ctx.visitId ?? ''}${ctx.toStage ?? ''}` });
    }
  }

  async runAction(ruleId: string, leadId: string, index: number, ctx: Record<string, any>) {
    const rule = await this.prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule?.isActive) return;
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, include: { assignedTo: true, organization: true, listing: true } });
    if (!lead || lead.deletedAt) return;
    const action = ((rule.actions ?? []) as unknown as Action[])[index];
    if (!action) return;
    // Delayed drip steps stop once the lead is closed.
    if (action.delayMinutes > 0 && ['WON', 'LOST'].includes(lead.stage)) {
      await this.prisma.automationRun.create({ data: { ruleId, leadId, status: 'SKIPPED', log: { action: action.type, reason: 'lead closed' } } });
      return;
    }
    const visit = ctx.visitId ? await this.prisma.siteVisit.findUnique({ where: { id: ctx.visitId }, include: { listing: true } }) : null;
    const vars = {
      lead: { name: lead.name.split(' ')[0] || lead.name, fullName: lead.name, phone: lead.phone },
      org: { name: lead.organization.name, phone: lead.organization.phone },
      agent: { name: lead.assignedTo?.name ?? lead.organization.name },
      listing: { title: lead.listing?.title ?? '', link: lead.listing ? `${env().PUBLIC_WEB_URL}/property/${lead.listing.slug}` : '' },
      source: LEAD_SOURCE_LABELS[lead.source],
      visit: visit ? { time: visit.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }), address: visit.address ?? visit.listing?.address ?? visit.listing?.title ?? '' } : {},
    };
    let status: 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'SUCCESS';
    let message = '';
    try {
      const p = action.params ?? {};
      switch (action.type) {
        case 'SEND_WHATSAPP_TEXT':
        case 'SEND_WHATSAPP_TEMPLATE': {
          const flag = await this.prisma.featureFlag.findUnique({ where: { key: 'whatsapp_automation' } });
          if (flag && !flag.enabled) {
            status = 'SKIPPED';
            message = 'WhatsApp automation disabled by admin';
            break;
          }
          if (!(await this.wa.creds(lead.organizationId))) {
            status = 'SKIPPED';
            message = 'WhatsApp not connected';
            break;
          }
          if (action.type === 'SEND_WHATSAPP_TEXT') await this.wa.send(lead.organizationId, lead.phone, { type: 'text', text: renderTemplate(String(p.text), vars) }, { leadId, contactName: lead.name, meta: { automation: ruleId } });
          else
            await this.wa.send(
              lead.organizationId,
              lead.phone,
              { type: 'template', name: String(p.templateName), language: String(p.language ?? 'en'), params: ((p.params as string[]) ?? []).map((x) => renderTemplate(String(x), vars)) },
              { leadId, contactName: lead.name, meta: { automation: ruleId } },
            );
          message = 'WhatsApp sent';
          break;
        }
        case 'SEND_EMAIL':
          if (!lead.email) {
            status = 'SKIPPED';
            message = 'lead has no email';
            break;
          }
          await this.mail.send({ to: lead.email, subject: renderTemplate(String(p.subject), vars), html: renderTemplate(String(p.body), vars).replace(/\n/g, '<br/>'), replyTo: lead.organization.email ?? undefined });
          message = 'Email sent';
          break;
        case 'ASSIGN_ROUND_ROBIN':
          if (lead.assignedToId && !p.reassign) {
            status = 'SKIPPED';
            message = 'already assigned';
            break;
          }
          message = `Assigned to ${await this.leads.assignRoundRobin(leadId, lead.organizationId, p.memberIds)}`;
          break;
        case 'ASSIGN_TO':
          await this.leads.assign(leadId, String(p.userId), null, { viaAutomation: true });
          message = 'Assigned';
          break;
        case 'CREATE_FOLLOW_UP': {
          const fresh = await this.prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
          await this.prisma.followUp.create({
            data: { organizationId: lead.organizationId, leadId, type: p.type ?? 'CALL', dueAt: new Date(Date.now() + Number(p.inMinutes ?? 0) * 60_000), note: p.note ? renderTemplate(String(p.note), vars) : 'Automation follow-up', assignedToId: fresh.assignedToId },
          });
          await this.leads.refreshNextFollowUp(leadId);
          message = 'Follow-up created';
          break;
        }
        case 'ADD_TAG':
          if (!lead.tags.includes(String(p.tag))) await this.prisma.lead.update({ where: { id: leadId }, data: { tags: { push: String(p.tag) } } });
          message = `Tag ${p.tag}`;
          break;
        case 'SET_STAGE':
          if (lead.stage !== p.stage) await this.prisma.lead.update({ where: { id: leadId }, data: { stage: p.stage, stageChangedAt: new Date() } });
          message = `Stage ${p.stage}`;
          break;
        case 'NOTIFY_TEAM': {
          const text = renderTemplate(String(p.message ?? '{{lead.name}}'), vars);
          if (lead.assignedToId) await this.notifications.notify(lead.assignedToId, { kind: 'SYSTEM', title: text, link: `/broker/leads/${leadId}` });
          else await this.notifications.notifyOrg(lead.organizationId, { kind: 'SYSTEM', title: text, link: `/broker/leads/${leadId}` }, { adminsOnly: true });
          message = 'Team notified';
          break;
        }
        default:
          status = 'SKIPPED';
          message = `Unknown action ${action.type}`;
      }
    } catch (e) {
      status = 'FAILED';
      message = (e as any)?.response?.message ?? (e as Error).message;
    }
    await this.prisma.automationRun.create({ data: { ruleId, leadId, status, log: { action: action.type, message } } });
    if (status === 'SUCCESS' && action.type.startsWith('SEND_')) {
      await this.prisma.activity.create({ data: { organizationId: lead.organizationId, leadId, type: 'AUTOMATION', content: `⚡ ${rule.name}: ${message}` } });
    }
  }

  // ------------------------------------------------------------------ scheduled triggers & reminders
  @Cron('0 */30 * * * *')
  async noActivityScan() {
    if (!env().JOBS_ENABLED) return;
    const rules = await this.prisma.automationRule.findMany({ where: { trigger: 'NO_ACTIVITY', isActive: true } });
    for (const rule of rules) {
      const c = (rule.conditions ?? {}) as Conditions;
      const hours = c.noActivityHours ?? 48;
      const cutoff = new Date(Date.now() - hours * 3600_000);
      const leads = await this.prisma.lead.findMany({
        where: {
          organizationId: rule.organizationId,
          deletedAt: null,
          stage: c.stages?.length ? { in: c.stages as any } : { notIn: ['WON', 'LOST'] },
          ...(c.sources?.length ? { source: { in: c.sources as any } } : {}),
          OR: [{ lastActivityAt: { lt: cutoff } }, { lastActivityAt: null, createdAt: { lt: cutoff } }],
          automationRuns: { none: { ruleId: rule.id, createdAt: { gt: cutoff } } },
        },
        take: 100,
        select: { id: true },
      });
      for (const l of leads) await this.schedule(rule, l.id, {});
    }
  }

  @Cron('0 * * * * *')
  async followUpReminders() {
    if (!env().JOBS_ENABLED) return;
    const soon = new Date(Date.now() + 10 * 60_000);
    const due = await this.prisma.followUp.findMany({ where: { status: 'PENDING', reminderSentAt: null, dueAt: { lte: soon } }, include: { lead: true }, take: 200 });
    for (const f of due) {
      await this.prisma.followUp.update({ where: { id: f.id }, data: { reminderSentAt: new Date() } });
      if (f.dueAt.getTime() < Date.now() - 6 * 3600_000) continue; // don't spam very old ones
      const who = f.assignedToId ?? f.lead.assignedToId;
      const input = { kind: 'FOLLOW_UP_DUE', title: `⏰ Follow-up: ${f.lead.name}`, body: `${f.type}${f.note ? ` — ${f.note}` : ''}`, link: `/broker/leads/${f.leadId}`, data: { leadId: f.leadId, phone: f.lead.phone } };
      if (who) await this.notifications.notify(who, input);
      else await this.notifications.notifyOrg(f.organizationId, input, { adminsOnly: true });
    }
  }

  @Cron('0 */5 * * * *')
  async visitReminders() {
    if (!env().JOBS_ENABLED) return;
    const inHour = new Date(Date.now() + 60 * 60_000);
    const visits = await this.prisma.siteVisit.findMany({ where: { status: { in: ['SCHEDULED', 'CONFIRMED'] }, reminderSentAt: null, scheduledAt: { lte: inHour, gte: new Date() } }, include: { lead: true, listing: true } });
    for (const v of visits) {
      await this.prisma.siteVisit.update({ where: { id: v.id }, data: { reminderSentAt: new Date() } });
      const who = v.assignedToId ?? v.lead.assignedToId;
      const input = { kind: 'VISIT_REMINDER', title: `🏠 Site visit 1 घंटे में: ${v.lead.name}`, body: v.listing?.title ?? v.address ?? '', link: `/broker/leads/${v.leadId}` };
      if (who) await this.notifications.notify(who, input);
      else await this.notifications.notifyOrg(v.organizationId, input, { adminsOnly: true });
      await this.trigger('VISIT_REMINDER', v.organizationId, v.leadId, { visitId: v.id });
    }
  }
}

/** Shift a date into the org's business hours (IST). */
export function nextBusinessTime(date: Date, hours: BusinessHours): Date {
  const [sh, sm] = hours.start.split(':').map(Number);
  const [eh, em] = hours.end.split(':').map(Number);
  let d = new Date(date);
  for (let i = 0; i < 8; i++) {
    const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
    const dow = ist.getUTCDay();
    const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (hours.days.includes(dow) && minutes >= startMin && minutes < endMin) return d;
    // move to today's start (if before) or next day's start
    const base = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
    const target = minutes < startMin && hours.days.includes(dow) ? base : new Date(base.getTime() + 86400_000);
    d = new Date(target.getTime() + startMin * 60_000 - IST_OFFSET_MIN * 60_000);
    const check = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
    if (hours.days.includes(check.getUTCDay())) return d;
  }
  return d;
}
