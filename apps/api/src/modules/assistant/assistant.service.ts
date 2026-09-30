import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Role } from '@prisma/client';
import { languageOf } from '@brokeriq/shared';
import { AiService } from '../../core/ai/ai.service';
import { AuditService } from '../../core/audit/audit.service';
import { env } from '../../config/env';
import { INTERNAL_CALL_HEADER, INTERNAL_CALL_TOKEN } from '../../common/internal';
import type { RequestUser } from '../../common/decorators';
import { TOOLS, toOpenAi, toolsFor, type Call, type Tool, type ToolCtx } from './tools';

interface Pending {
  userId: string;
  tool: string;
  args: any;
  auth: string;
  ip?: string;
  expires: number;
}
export interface AssistantReply {
  reply: string;
  pending?: { token: string; tool: string; summary: string };
  /** Structured results for rich UI cards (listings, leads). */
  cards?: { type: 'listings' | 'leads'; items: any[] };
  used?: string[];
}

const MAX_ROUNDS = 5;
const PENDING_TTL = 5 * 60_000;

/**
 * Role-aware AI agent. The model can only call tools allowed for the user's role, every tool
 * runs through this same API with the user's own token (so the user's permissions apply), and
 * anything that changes data waits for the user's explicit confirmation.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly pending = new Map<string, Pending>();

  constructor(
    private readonly ai: AiService,
    private readonly audit: AuditService,
  ) {}

  private base() {
    return (process.env.INTERNAL_API_URL || `http://127.0.0.1:${env().PORT}`).replace(/\/$/, '') + '/api';
  }

  /** Loopback call as the user (same guards/validation as the app). */
  private ctx(auth: string, ip?: string): ToolCtx {
    const call = async (c: Call) => {
      const res = await fetch(this.base() + c.path, {
        method: c.method,
        headers: { Authorization: auth, 'Content-Type': 'application/json', [INTERNAL_CALL_HEADER]: INTERNAL_CALL_TOKEN, ...(ip ? { 'X-Forwarded-For': ip } : {}) },
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
      USER: 'a renter / property owner using the BrokerIQ marketplace',
      BROKER_ADMIN: 'a broker firm admin using the BrokerIQ CRM',
      BROKER_AGENT: 'a broker agent using the BrokerIQ CRM',
      SUPER_ADMIN: 'the BrokerIQ platform Super Admin',
      MODERATOR: 'a BrokerIQ moderator (reviews listings, reviews and reports)',
      SUPPORT: 'a BrokerIQ support team member (helps users and brokers)',
    };
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });
    return [
      `You are "BrokerIQ Assistant", the in-app AI agent of BrokerIQ — a rental property & brokerage platform for Gurgaon (Gurugram), Haryana, India. Only rentals (flats, builder floors, PG, offices…), no property sales.`,
      `You are helping ${user.name ?? 'the user'}, ${roleText[user.role]}. Current date/time (IST): ${now}.${context?.path ? ` They are on the screen "${context.path}"${context.entityId ? ` (id ${context.entityId})` : ''}.` : ''}`,
      `Reply in ${L.name}${L.code === 'en' ? '' : ` (${L.native} script)`} — short, friendly, practical. Money in ₹ with Indian formatting.`,
      `Use the tools to look things up and to act for THIS user only. Never invent listings, leads, numbers or ids — use tool results. If something needs more details (e.g. locality or rent), ask a short question.`,
      `Tools that change data are confirmed by the user before they run: call them with complete arguments and tell the user what will happen; never claim an action is done until it is confirmed.`,
      `Every listing goes live only after admin approval. You cannot see or share anyone's private contacts or locations, other firms' data, or anything outside this user's own permissions — say so politely if asked.`,
      `When you list properties or leads, mention the key facts (rent, BHK, locality / stage) — the app shows them as tappable cards.`,
    ].join('\n');
  }

  async chat(user: RequestUser & { name?: string }, auth: string, body: { messages: { role: 'user' | 'assistant'; content: string }[]; lang: string; context?: { path?: string; entityId?: string } }, ip?: string): Promise<AssistantReply> {
    const allowed = toolsFor(user.role);
    const ctx = this.ctx(auth, ip);
    const msgs: any[] = [{ role: 'system', content: this.system(user, body.lang, body.context) }, ...body.messages.slice(-16)];
    const used: string[] = [];
    let cards: AssistantReply['cards'];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const m = await this.ai.chatWithTools(msgs, toOpenAi(allowed), { feature: 'assistant', orgId: user.orgId, userId: user.id });
      if (!m.tool_calls?.length) return { reply: (m.content ?? '').trim() || '🙂', cards, used };
      msgs.push({ role: 'assistant', content: m.content ?? '', tool_calls: m.tool_calls });
      for (const tc of m.tool_calls) {
        const tool = allowed.find((t) => t.name === tc.function.name);
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          /* model sent bad JSON */
        }
        if (!tool) {
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: 'This action is not available for this user.' }) });
          continue;
        }
        if (tool.write) {
          const token = randomBytes(18).toString('base64url');
          this.pending.set(token, { userId: user.id, tool: tool.name, args, auth, ip, expires: Date.now() + PENDING_TTL });
          this.gc();
          const summary = tool.summary?.(args) ?? tool.name;
          const reply = (m.content ?? '').trim() || `${summary} — क्या मैं यह कर दूँ?`;
          return { reply, pending: { token, tool: tool.name, summary }, cards, used };
        }
        used.push(tool.name);
        let result: unknown;
        try {
          result = await tool.run(args, ctx);
          cards = this.cardsFor(tool.name, result) ?? cards;
        } catch (e) {
          result = { error: (e as Error).message };
        }
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 6000) });
      }
    }
    return { reply: 'माफ़ कीजिए, यह काम पूरा नहीं हो पाया — थोड़ा और साफ़ बताइए।', cards, used };
  }

  /** Runs a confirmed write action, then lets the model phrase the outcome in the user's language. */
  async confirm(user: RequestUser & { name?: string }, token: string, lang: string, ip?: string): Promise<AssistantReply> {
    const p = this.pending.get(token);
    if (!p || p.expires < Date.now()) throw new BadRequestException('यह request expire हो गई — दोबारा बोलें');
    if (p.userId !== user.id) throw new ForbiddenException();
    this.pending.delete(token);
    const tool = TOOLS.find((t) => t.name === p.tool) as Tool;
    if (!tool.roles.includes(user.role)) throw new ForbiddenException();
    let result: unknown;
    let ok = true;
    try {
      result = await tool.run(p.args, this.ctx(p.auth, ip ?? p.ip));
    } catch (e) {
      ok = false;
      result = { error: (e as Error).message };
    }
    await this.audit.log(user, `assistant.${tool.name}`, 'Assistant', null, { ok, args: p.args }, ip);
    let reply = ok ? '✅ हो गया' : `⚠️ ${(result as any).error}`;
    try {
      const m = await this.ai.chatWithTools(
        [
          { role: 'system', content: `${this.system(user, lang)}\nThe user confirmed and the action "${tool.name}" was executed. Tell them the outcome in one or two short sentences.` },
          { role: 'user', content: `Result: ${JSON.stringify(result).slice(0, 3000)}` },
        ],
        [],
        { feature: 'assistant', orgId: user.orgId, userId: user.id, maxTokens: 300 },
      );
      if (m.content?.trim()) reply = m.content.trim();
    } catch (e) {
      this.logger.warn(`confirm phrasing failed: ${(e as Error).message}`);
    }
    return { reply, used: [tool.name], cards: this.cardsFor(tool.name, result) };
  }

  cancel(user: RequestUser, token: string) {
    const p = this.pending.get(token);
    if (p && p.userId === user.id) this.pending.delete(token);
    return { ok: true };
  }

  transcribe(user: RequestUser, audio: string, mime: string, lang?: string) {
    return this.ai.transcribe(audio, mime, lang, { userId: user.id, orgId: user.orgId }).then((text) => ({ text }));
  }

  private cardsFor(tool: string, result: any): AssistantReply['cards'] | undefined {
    const listings = Array.isArray(result) ? (tool.includes('lead') ? null : result) : result?.listings;
    if (listings?.length && listings[0]?.url?.startsWith('/property/')) return { type: 'listings', items: listings.slice(0, 8) };
    const leads = Array.isArray(result?.leads) ? result.leads : null;
    if (leads?.length) return { type: 'leads', items: leads.slice(0, 8) };
    return undefined;
  }

  private gc() {
    const now = Date.now();
    for (const [k, v] of this.pending) if (v.expires < now) this.pending.delete(k);
  }
}
