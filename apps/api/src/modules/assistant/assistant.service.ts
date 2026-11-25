import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Prisma, Role } from '@prisma/client';
import { assistantDestination, languageOf, type AssistantPhase } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../core/settings/crypto.service';
import { sha256 } from '../../common/utils';
import { AiService } from '../../core/ai/ai.service';
import { AuditService } from '../../core/audit/audit.service';
import { env } from '../../config/env';
import { INTERNAL_CALL_HEADER, INTERNAL_CALL_TOKEN } from '../../common/internal';
import type { RequestUser } from '../../common/decorators';
import { toOpenAi, toolsFor, type Call, type ToolCtx } from './tools';
import { assistantSystem } from '../../core/ai/prompts';

export interface AssistantReply {
  reply: string;
  pending?: { token: string; tool: string; summary: string };
  /** Structured results for rich UI cards (listings, leads). */
  cards?: { type: 'listings' | 'leads'; items: any[] };
  used?: string[];
  actionSucceeded?: boolean;
  receipt?: Record<string, string | number | boolean | null>;
}

const MAX_ROUNDS = 5;
const TURN_BUDGET_MS = 32_000;
type ReportProgress = (phase: AssistantPhase) => void;

function asksForModerationCount(message: string) {
  const question = message
    .trim()
    .toLowerCase()
    .replace(/[?.!।]+$/, '')
    .trim();
  return /^(how many (?:listings (?:are )?pending(?: (?:review|approval))?|pending (?:review |approval )?listings)(?: (?:are there|do (?:i|we) have))?|(?:approval|review) के लिए कितनी listings pending (?:हैं|है)|कितनी listings (?:approval के लिए )?pending (?:हैं|है)|approval ke liye kitni listings pending (?:hain|hai))$/u.test(
    question,
  );
}
const PENDING_TTL = 5 * 60_000;

/**
 * Role-aware AI agent. The model can only call tools allowed for the user's role, every tool
 * runs through this same API with the user's own token (so the user's permissions apply), and
 * anything that changes data waits for the user's explicit confirmation.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly ai: AiService,
    private readonly audit: AuditService,
    private readonly db: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private base() {
    return (process.env.INTERNAL_API_URL || `http://127.0.0.1:${env().PORT}`).replace(/\/$/, '') + '/api';
  }

  /** Loopback call as the user (same guards/validation as the app). */
  private ctx(auth: string, ip?: string, deadlineAt = Infinity): ToolCtx {
    const call = async (c: Call) => {
      const timeLeft = Math.min(15_000, deadlineAt - Date.now());
      if (timeLeft < 1) throw new Error('Assistant request timed out');
      const res = await fetch(this.base() + c.path, {
        method: c.method,
        redirect: 'error',
        signal: AbortSignal.timeout(timeLeft),
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          [INTERNAL_CALL_HEADER]: INTERNAL_CALL_TOKEN,
          ...(ip ? { 'X-Forwarded-For': ip } : {}),
        },
        body: c.body === undefined ? undefined : JSON.stringify(c.body),
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
      return data;
    };
    let meCache: any;
    return { call, me: async () => (meCache ??= await call({ method: 'GET', path: '/auth/me' })) };
  }

  private system(user: RequestUser & { name?: string }, lang: string, context?: { path?: string; entityId?: string }) {
    const L = languageOf(lang);
    const roleText: Record<Role, string> = {
      PROPERTY_OWNER: 'a property owner linked to a broker firm',
      USER: 'a renter / property owner using the BrokerIQ marketplace',
      SUB_BROKER_ADMIN: 'Delegated broker administrator',
      BROKER_ADMIN: 'a broker firm admin using the BrokerIQ CRM',
      BROKER_AGENT: 'a broker agent using the BrokerIQ CRM',
      SUPER_ADMIN: 'the BrokerIQ platform Super Admin',
      MODERATOR: 'a BrokerIQ moderator (reviews listings, reviews and reports)',
      SUPPORT: 'a BrokerIQ support team member (helps users and brokers)',
    };
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });
    return assistantSystem({
      userName: user.name ?? 'the user',
      roleText: roleText[user.role],
      now,
      languageName: L.name,
      languageNative: L.code === 'en' ? undefined : L.native,
      path: context?.path,
      entityId: context?.entityId,
    });
  }

  private availableTools(user: RequestUser) {
    const tools = toolsFor(user.role).filter(
      (tool) =>
        (!user.delegatedActor || !/broadcast/.test(tool.name)) &&
        (user.agentChatEnabled !== false || tool.name !== 'send_whatsapp') &&
        (user.role !== 'PROPERTY_OWNER' ||
          [
            'my_workspace',
            'owner_properties',
            'report_owner_availability',
            'search_properties',
            'search_rentals',
            'get_listing',
            'list_localities',
            'rent_budget',
            'move_in_cost',
          ].includes(tool.name)),
    );
    const grants = user.delegatedActor ? (user.delegatedPermissions ?? []) : user.rolePermissions;
    if (!grants) return tools;
    const requirements: Record<string, string[]> = {
      list_localities: [],
      search_rentals: [],
      search_properties: [],
      get_listing: [],
      broker_dashboard: ['today:view'],
      search_inventory: ['inventory:view'],
      get_inventory: ['inventory:view'],
      create_inventory: ['inventory:view', 'inventory:create'],
      edit_inventory: ['inventory:view', 'inventory:edit'],
      list_requirements: ['leads:view'],
      send_whatsapp: ['inbox:view', 'inbox:send'],
      list_broadcast_groups: ['inbox:view'],
      import_broadcast_contacts: ['inbox:view', 'inbox:create'],
      create_broadcast_group: ['inbox:view', 'inbox:create'],
      prepare_whatsapp_broadcast: ['inbox:view', 'inbox:send'],
      queue_whatsapp_broadcast: ['inbox:view', 'inbox:send'],
      list_pdf_inventory: ['inventory:view'],
      lead_matches: ['leads:view', 'inventory:view'],
      rent_budget: [],
      move_in_cost: [],
      my_notifications: [],
      search_leads: ['leads:view'],
      get_lead: ['leads:view'],
      create_lead: ['leads:create'],
      change_lead_stage: ['leads:edit'],
      add_lead_note: ['leads:edit'],
      schedule_follow_up: ['leads:create'],
      schedule_site_visit: ['leads:create'],
      todays_agenda: ['leads:view'],
      assign_lead: ['leads:assign'],
      team_members: ['team:view'],
    };
    return tools.filter(
      (tool) => (tool.grants ?? requirements[tool.name])?.every((grant) => grants.includes(grant)) && (!tool.write || grants.includes('assistant:edit')),
    );
  }

  async chat(
    user: RequestUser & { name?: string },
    auth: string,
    body: { messages: { role: 'user' | 'assistant'; content: string }[]; lang: string; context?: { path?: string; entityId?: string } },
    ip?: string,
    progress?: ReportProgress,
  ): Promise<AssistantReply> {
    const deadlineAt = Date.now() + TURN_BUDGET_MS;
    progress?.('understanding');
    const allowed = this.availableTools(user);
    const ctx = this.ctx(auth, ip, deadlineAt);
    const latest = body.messages.at(-1);
    const moderation = allowed.find((tool) => tool.name === 'moderation_queue');
    if (moderation && latest?.role === 'user' && asksForModerationCount(latest.content)) {
      progress?.('retrieving');
      const queue = (await moderation.run({}, ctx)) as { total?: number };
      if (typeof queue.total === 'number' && Number.isSafeInteger(queue.total) && queue.total >= 0) {
        progress?.('composing');
        const count = new Intl.NumberFormat(body.lang === 'hi' ? 'hi-IN' : 'en-IN').format(queue.total);
        const reply =
          body.lang === 'hi'
            ? `Approval के लिए **${count}** listings pending हैं।`
            : `**${count}** ${queue.total === 1 ? 'listing is' : 'listings are'} pending approval.`;
        return { reply: reply + '\n\n[Moderation queue](/admin/moderation)', used: [moderation.name], cards: this.cardsFor(moderation.name, queue) };
      }
    }
    const msgs: any[] = [{ role: 'system', content: this.system(user, body.lang, body.context) }, ...body.messages.slice(-16)];
    const used: string[] = [];
    let cards: AssistantReply['cards'];

    const tools = toOpenAi(allowed);
    const results = new Map<string, unknown>();
    const fallback = () => ({
      reply: cards
        ? body.lang === 'hi'
          ? 'मिले हुए records नीचे हैं।'
          : 'Here are the records I found.'
        : body.lang === 'hi'
          ? 'यह request पूरी नहीं हुई। इसे छोटे हिस्से में पूछकर फिर कोशिश करें।'
          : 'This request didn’t finish. Try asking for one part at a time.',
      cards,
      used,
    });
    for (let round = 0; round < MAX_ROUNDS && Date.now() < deadlineAt; round++) {
      if (round > 0) progress?.('composing');
      let m;
      try {
        m = await this.ai.chatWithTools(msgs, tools, {
          feature: 'assistant',
          openRouterOnly: true,
          orgId: user.orgId,
          userId: user.id,
          deadlineAt,
          onFallback: () => progress?.('retrying'),
        });
      } catch (error) {
        if (cards) return fallback();
        throw error;
      }
      if (!m.tool_calls?.length) {
        const reply = (m.content ?? '').trim();
        return reply ? { reply, cards, used } : fallback();
      }
      msgs.push({ role: 'assistant', content: m.content ?? '', tool_calls: m.tool_calls });
      for (const tc of m.tool_calls) {
        const tool = allowed.find((t) => t.name === tc.function.name);
        let args: Record<string, unknown> | undefined;
        try {
          const parsed: unknown = JSON.parse(tc.function.arguments || '{}');
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
        } catch {
          /* model sent bad JSON */
        }
        if (!tool) {
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: 'This action is not available for this user.' }) });
          continue;
        }
        if (!args) {
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: '{"error":"Provide a valid argument object."}' });
          continue;
        }
        if (tool.write) {
          progress?.('confirming');
          let summary: string;
          try {
            summary = tool.summary?.(args) ?? tool.name;
          } catch {
            msgs.push({ role: 'tool', tool_call_id: tc.id, content: '{"error":"Some required fields are missing or invalid."}' });
            continue;
          }
          const token = randomBytes(18).toString('base64url');
          await this.db.$transaction([
            this.db.assistantConfirmation.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
            this.db.assistantConfirmation.create({
              data: {
                ...this.confirmationOwner(user),
                tokenHash: sha256(token),
                tool: tool.name,
                expiresAt: new Date(Date.now() + PENDING_TTL),
                encryptedArgs: this.crypto.encrypt(JSON.stringify(args)),
              },
            }),
          ]);
          const reply = (m.content ?? '').trim() || `${summary} — क्या मैं यह कर दूँ?`;
          return { reply, pending: { token, tool: tool.name, summary }, cards, used };
        }
        const key = tool.name + JSON.stringify(Object.entries(args).sort(([a], [b]) => a.localeCompare(b)));
        let result = results.get(key);
        if (!results.has(key)) {
          progress?.('retrieving');
          if (!used.includes(tool.name)) used.push(tool.name);
          try {
            result = await tool.run(args, ctx);
            cards = this.cardsFor(tool.name, result) ?? cards;
          } catch (e) {
            result = { error: (e as Error).message };
          }
          results.set(key, result);
        }
        const content = JSON.stringify(result ?? null);
        msgs.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: content.length <= 6000 ? content : JSON.stringify({ preview: content.slice(0, 2800), truncated: true }),
        });
      }
    }
    return fallback();
  }

  /** Runs a confirmed write and returns the actual outcome without a provider call. */
  async confirm(
    user: RequestUser & { name?: string },
    auth: string,
    token: string,
    _lang: string,
    ip?: string,
    progress?: ReportProgress,
  ): Promise<AssistantReply> {
    progress?.('applying');
    const where = { ...this.confirmationOwner(user), tokenHash: sha256(token), expiresAt: { gt: new Date() } };
    const pending = await this.db.assistantConfirmation.findUnique({ where: { tokenHash: where.tokenHash } });
    if (!pending || pending.expiresAt <= new Date()) throw new BadRequestException('यह request expire हो गई — दोबारा बोलें');
    if (pending.userId !== user.id || pending.organizationId !== user.orgId || pending.role !== where.role) throw new ForbiddenException();
    const tool = this.availableTools(user).find((item) => item.name === pending.tool && item.write);
    if (!tool) throw new ForbiddenException();
    const consumed = await this.db.assistantConfirmation.deleteMany({ where });
    if (!consumed.count) throw new BadRequestException('यह confirmation पहले इस्तेमाल हो चुका है');
    const args: unknown = JSON.parse(this.crypto.decrypt(pending.encryptedArgs));
    let result: unknown;
    let ok = true;
    try {
      result = await tool.run(args, this.ctx(auth, ip));
    } catch (e) {
      ok = false;
      result = { error: (e as Error).message };
    }
    await this.audit.log(user, `assistant.${tool.name}`, 'Assistant', null, { ok }, ip);
    const reply = ok ? (_lang === 'hi' ? 'हो गया।' : 'Confirmed action completed.') : `⚠️ ${(result as { error: string }).error}`;
    const receipt =
      ok && result && typeof result === 'object'
        ? (Object.fromEntries(
            Object.entries(result).filter(
              ([key, value]) =>
                ['id', 'name', 'status', 'canQueue', 'queued', 'estimatedCost', 'saved'].includes(key) &&
                (value === null || ['number', 'string', 'boolean'].includes(typeof value)),
            ),
          ) as AssistantReply['receipt'])
        : undefined;
    return { reply, actionSucceeded: ok, used: ok ? [tool.name] : [], cards: this.cardsFor(tool.name, result), receipt };
  }

  async cancel(user: RequestUser, token: string) {
    await this.db.assistantConfirmation.deleteMany({ where: { ...this.confirmationOwner(user), tokenHash: sha256(token) } });
    return { ok: true };
  }

  private confirmationOwner(user: RequestUser): Pick<Prisma.AssistantConfirmationUncheckedCreateInput, 'userId' | 'organizationId' | 'role'> {
    return { userId: user.id, organizationId: user.orgId, role: user.delegatedActor ? 'SUB_BROKER_ADMIN' : user.role };
  }

  transcribe(user: RequestUser, audio: string, mime: string, lang?: string) {
    return this.ai.transcribe(audio, mime, lang, { userId: user.id, orgId: user.orgId }).then((text) => ({ text }));
  }

  private cardsFor(tool: string, result: any): AssistantReply['cards'] | undefined {
    const listings = Array.isArray(result) ? (tool.includes('lead') ? null : result) : result?.listings;
    if (Array.isArray(listings)) {
      const items = listings.filter((item) => assistantDestination(item?.url)).slice(0, 8);
      if (items.length) return { type: 'listings', items };
    }
    if (Array.isArray(result?.leads)) {
      const items = result.leads.filter((item: any) => assistantDestination(item?.url)).slice(0, 8);
      if (items.length) return { type: 'leads', items };
    }
    return undefined;
  }
}
