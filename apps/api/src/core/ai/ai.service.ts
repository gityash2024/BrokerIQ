import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { toJSONSchema, z, type ZodType } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { IntegrationFailedException, IntegrationNotConfiguredException } from '../../common/exceptions';
import { env } from '../../config/env';
import { transcribeLocalRecording } from './local-transcription';
import { AiTelemetry } from './ai-telemetry';
import { isFreeOpenRouterModel, openRouterFreeRouting, OPENROUTER_DAILY_LIMIT } from './openrouter-policy';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type ProviderName = 'qwen_local' | 'openrouter' | 'groq' | 'gemini';

/** One provider = one OpenAI-compatible endpoint + an ordered list of models to try. */
interface Provider {
  name: ProviderName;
  apiKey: string;
  url: string;
  textModels: string[];
  visionModels: string[];
  structuredApproved?: boolean;
  disableReasoning?: boolean;
  allowPrivateData?: boolean;
  dailyLimit?: number;
}

interface CallOpts {
  feature: string;
  orgId?: string | null;
  userId?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Reuse an identical earlier answer for this long (ms). Off by default. */
  cacheMs?: number;
  /** Internal constrained-generation contract; output is still validated independently. */
  responseSchema?: ZodType;
  strictSchema?: boolean;
  openRouterOnly?: boolean;
  preferFreeRouter?: boolean;
  /** The calling service constructs the input entirely from non-identifying known values. */
  dataScope?: 'non-sensitive';
  deferWhenRateLimited?: boolean;
  deadlineAt?: number;
  onFallback?: () => void;
}

const PROVIDERS: ProviderName[] = ['groq', 'openrouter', 'gemini', 'qwen_local'];
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GEMINI_FLASH = 'gemini-3.8-flash';
const FREE_ROUTER = 'openrouter/free';
const URLS: Record<ProviderName, string> = {
  qwen_local: 'http://127.0.0.1:18080/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
};
const assistantMessage = z.object({
  content: z.string().max(40_000).nullable().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string().min(1).max(160),
        type: z.literal('function'),
        function: z.object({ name: z.string().min(1).max(80), arguments: z.string().max(20_000) }),
      }),
    )
    .max(8)
    .optional(),
});
const TEXT_TIMEOUT_MS = 45_000;
const VISION_TIMEOUT_MS = 90_000;
const CACHE_MAX = 300;
function nextPacificDay(now: number) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', dateStyle: 'short' });
  const today = date.format(now);
  let end = now;
  while (date.format(end) === today) end += 3_600_000;
  return Math.floor(end / 3_600_000) * 3_600_000 + 10_000;
}
const NOT_CONFIGURED = 'AI configured नहीं है। Super Admin → Settings → Credentials में Local Qwen या सक्षम free AI provider configure करें।';

const list = (v: unknown) =>
  String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Errors worth trying the next model/provider for (busy, rate limited, model gone, bad output). */
class RetryableError extends Error {
  constructor(
    message: string,
    readonly transient = false,
  ) {
    super(message);
  }
}
/** The provider itself is unusable (bad key, no credit) — skip all its models. */
class ProviderError extends Error {}

export class AiQuotaDeferred extends Error {
  constructor(
    readonly until: Date,
    readonly daily = false,
    readonly provider: ProviderName = 'openrouter',
  ) {
    super(daily ? 'Free AI daily request limit reached' : 'Free AI capacity is temporarily unavailable');
  }
}
export { AiQuotaDeferred as OpenRouterQuotaDeferred };

function nextUtcDay() {
  const day = new Date();
  day.setUTCHours(24, 0, 10, 0);
  return day;
}

/** Shared inference policy for Assistant, extraction, Connect and automation jobs. */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly cache = new Map<string, { at: number; ttl: number; text: string }>();
  private readonly retryAt = new Map<string, number>();
  private openRouterDailyResetAt = 0;
  private readonly openRouterMandatoryReasoning = new Set<string>();
  private localBusy = false;
  private localRetryAt = 0;
  private readonly telemetry: AiTelemetry;
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {
    this.telemetry = new AiTelemetry(this.settings);
  }

  // ------------------------------------------------------------------ providers
  private toProvider(name: ProviderName, v: Record<string, unknown>): Provider {
    const apiKey = String(v.apiKey ?? '');
    if (name === 'qwen_local')
      return {
        name,
        apiKey,
        url: URLS[name],
        textModels: list(v.textModel).slice(0, 1),
        visionModels: [],
        structuredApproved: v.structuredTextApprovedModel === list(v.textModel)[0] && /^[a-f0-9]{64}$/.test(String(v.structuredEvaluationSha256 ?? '')),
      };
    if (name === 'openrouter')
      return {
        name,
        apiKey,
        url: URLS[name],
        disableReasoning: v.disableReasoning === true || v.disableReasoning === 'true',
        allowPrivateData: true,
        textModels: [...new Set([...list(v.textModel), ...list(v.fallbackModels)].filter(isFreeOpenRouterModel))],
        visionModels: [...new Set([...list(v.visionModel), ...list(v.visionFallbackModels)].filter(isFreeOpenRouterModel))],
      };
    const freeTier = v.freeTierConfirmed === true || v.freeTierConfirmed === 'true';
    if (name === 'groq') {
      const privateData = v.zeroDataRetentionConfirmed === true || v.zeroDataRetentionConfirmed === 'true';
      return { name, apiKey, url: URLS[name], textModels: freeTier ? [GROQ_MODEL] : [], visionModels: [], dailyLimit: 1000, allowPrivateData: privateData };
    }
    const dailyLimit = Number(v.dailyRequestLimit);
    const enabled = freeTier && Number.isInteger(dailyLimit) && dailyLimit > 0 && dailyLimit <= 2_147_483_647;
    const models = enabled ? [GEMINI_FLASH] : [];
    return { name, apiKey, url: URLS[name], textModels: models, visionModels: models, dailyLimit };
  }

  async providers(captureVision = false, openRouterOnly = false, nonSensitive = false): Promise<Provider[]> {
    const configured = await Promise.all(
      PROVIDERS.map(async (name) => {
        if (openRouterOnly && name !== 'openrouter') return null;
        const values = await this.settings.resolve(name).catch(() => null);
        if (!values || !(values.apiKey || (name === 'qwen_local' && values.textModel))) return null;
        const provider = this.toProvider(name, values);
        if (name === 'gemini' && !nonSensitive) return null;
        if (name === 'groq' && !nonSensitive && !provider.allowPrivateData) return null;
        if (name === 'openrouter') {
          provider.allowPrivateData = !nonSensitive;
          if (openRouterOnly) provider.textModels = [...new Set([...provider.textModels, FREE_ROUTER])];
          if (captureVision || openRouterOnly) provider.visionModels = [...new Set([...provider.visionModels, FREE_ROUTER])];
          if (!provider.textModels.length && !values.textModel) provider.textModels = [FREE_ROUTER];
          if (!provider.visionModels.length && !values.visionModel && captureVision) provider.visionModels = [FREE_ROUTER];
        }
        return provider.textModels.length || provider.visionModels.length ? provider : null;
      }),
    );
    return configured.filter((provider): provider is Provider => provider !== null);
  }

  async isAvailable(kind: 'text' | 'vision' | 'tools' | 'json' = 'text', feature?: string) {
    return (await this.providers(kind === 'vision' && feature === 'capture')).some((p) =>
      kind === 'vision'
        ? p.visionModels.length > 0
        : (kind !== 'tools' || p.name !== 'qwen_local') &&
          (kind !== 'json' || p.name !== 'qwen_local' || p.structuredApproved === true) &&
          p.textModels.length > 0,
    );
  }

  // ------------------------------------------------------------------ public API
  async chat(messages: ChatMessage[], opts: CallOpts): Promise<string> {
    return this.run(opts, 'text', async (p, model) => {
      const out = await this.complete(p, model, messages, opts, TEXT_TIMEOUT_MS);
      if (!out.text.trim()) throw new RetryableError('empty answer');
      return out;
    });
  }

  async vision(imageDataUrl: string, prompt: string, opts: CallOpts & { system?: string }): Promise<string> {
    const messages = [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ];
    return this.run(opts, 'vision', async (p, model) => {
      const out = await this.complete(p, model, messages, opts, VISION_TIMEOUT_MS);
      if (!out.text.trim()) throw new RetryableError('empty answer');
      if (opts.json || opts.responseSchema) {
        const parsed = parseJsonLoose(out.text);
        if (opts.responseSchema && !opts.responseSchema.safeParse(parsed).success)
          throw new RetryableError('image response did not match the extraction schema');
      }
      return out;
    });
  }

  /**
   * JSON answer. With `schema`, the parsed value must match it; a mismatch gets one repair turn on the same
   * model, then the next model is tried. Returns the validated value.
   */
  async json<T = any>(messages: ChatMessage[], opts: CallOpts & { schema?: ZodType<T> }): Promise<T> {
    let value: T | undefined;
    const generation = { ...opts, json: true, responseSchema: opts.schema };
    await this.run(generation, 'json', async (p, model) => {
      const first = await this.complete(p, model, messages, generation, TEXT_TIMEOUT_MS);
      const check = (text: string) => {
        const parsed = parseJsonLoose<T>(text);
        if (!opts.schema) return { ok: true as const, data: parsed };
        const r = opts.schema.safeParse(parsed);
        return r.success
          ? { ok: true as const, data: r.data }
          : {
              ok: false as const,
              error: r.error.issues
                .slice(0, 5)
                .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
                .join('; '),
            };
      };
      let res: ReturnType<typeof check>;
      try {
        res = check(first.text);
      } catch {
        res = { ok: false, error: 'not valid JSON' };
      }
      if (!res.ok) {
        const repair = await this.complete(
          p,
          model,
          [
            ...messages,
            { role: 'assistant', content: first.text },
            { role: 'user', content: `Your answer did not match the required JSON (${res.error}). Reply again with ONLY the corrected JSON object, no prose.` },
          ],
          generation,
          TEXT_TIMEOUT_MS,
        );
        try {
          res = check(repair.text);
        } catch {
          res = { ok: false, error: 'not valid JSON' };
        }
        if (!res.ok) throw new RetryableError(`bad JSON: ${res.error}`);
      }
      value = res.data;
      return { text: JSON.stringify(res.data), tokens: first.tokens };
    });
    return value as T;
  }

  /**
   * OpenAI-style tool calling (all three providers are OpenAI-compatible). Models that can't use tools
   * are skipped automatically. Returns the assistant message — text or tool_calls to execute.
   */
  async chatWithTools(messages: any[], tools: any[], opts: CallOpts) {
    let message: { content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] } = { content: '' };
    await this.run(opts, 'tools', async (p, model) => {
      const timeout = opts.deadlineAt == null ? TEXT_TIMEOUT_MS : Math.min(12_000, opts.deadlineAt - Date.now());
      if (timeout <= 0) throw new RetryableError('Assistant turn deadline exceeded');
      const data = await this.post(
        p,
        {
          model,
          messages,
          tools: tools.length ? tools : undefined,
          tool_choice: tools.length ? 'auto' : undefined,
          temperature: 0.2,
          max_tokens: opts.maxTokens ?? 1200,
        },
        timeout,
      );
      const choice = data.choices?.[0];
      if (choice?.finish_reason === 'length') throw new RetryableError('incomplete assistant response');
      const parsed = assistantMessage.safeParse(choice?.message);
      if (!parsed.success || (!parsed.data.content && !parsed.data.tool_calls?.length)) throw new RetryableError('invalid assistant response');
      message = { content: parsed.data.content ?? null, tool_calls: parsed.data.tool_calls };
      return { text: message.content ?? '', tokens: data.usage?.total_tokens ?? 0 };
    });
    return message;
  }

  /** Keep raw voice recordings inside the existing Faster Whisper worker runtime. */
  async transcribe(audioBase64: string, mime: string, lang: string | undefined, opts: { userId?: string; orgId?: string | null }) {
    const bytes = Buffer.from(audioBase64.replace(/^data:[^,]+,/, ''), 'base64');
    try {
      const result = await transcribeLocalRecording(bytes, mime, {
        timeoutMs: 30_000,
        lang: lang && /^(?:en|hi)$/.test(lang) ? lang : undefined,
      });
      await this.track('faster_whisper', 'local', { feature: 'assistant-voice', ...opts }, true, 0);
      return result.segments.map(({ text }) => text).join(' ');
    } catch (error) {
      if (error instanceof IntegrationNotConfiguredException) throw error;
      await this.track('faster_whisper', 'local', { feature: 'assistant-voice', ...opts }, false, 0);
      throw new IntegrationFailedException('connect_transcription', 'Voice transcription अभी उपलब्ध नहीं है। फिर कोशिश करें।');
    }
  }

  // ------------------------------------------------------------------ core loop
  private async run(
    opts: CallOpts,
    kind: 'text' | 'vision' | 'tools' | 'json',
    attempt: (p: Provider, model: string) => Promise<{ text: string; tokens: number }>,
  ): Promise<string> {
    const providers = (await this.providers(kind === 'vision', opts.openRouterOnly, opts.dataScope === 'non-sensitive')).filter((p) =>
      kind === 'vision'
        ? p.visionModels.length > 0
        : (kind !== 'tools' || p.name !== 'qwen_local') &&
          (kind !== 'json' || p.name !== 'qwen_local' || p.structuredApproved === true) &&
          p.textModels.length > 0,
    );
    if (!providers.length) throw new IntegrationNotConfiguredException('openrouter', NOT_CONFIGURED);
    const errors: string[] = [];
    const rateLimited: Date[] = [];
    for (const p of providers) {
      const configured = kind === 'vision' ? p.visionModels : p.textModels;
      const models = p.name === 'openrouter' && opts.preferFreeRouter ? [...new Set([FREE_ROUTER, ...configured])] : configured;
      for (const model of models) {
        if (opts.deadlineAt != null && Date.now() >= opts.deadlineAt) break;
        const retryAt = this.retryAt.get(p.name + '/' + model) ?? 0;
        if (Date.now() < retryAt) {
          rateLimited.push(new Date(retryAt));
          errors.push(`${p.name}/${model}: waiting for capacity`);
          continue;
        }
        const started = Date.now();
        try {
          if (errors.length) opts.onFallback?.();
          let out;
          try {
            out = await attempt(p, model);
          } catch (error) {
            // One bounded retry for network/5xx glitches; rate limits immediately
            // follow the configured fallback chain and retain Retry-After.
            if (opts.deadlineAt != null || p.name !== 'openrouter' || !(error instanceof RetryableError) || !error.transient) throw error;
            await this.track(p.name, model, opts, false, 0, started);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            out = await attempt(p, model);
          }
          await this.track(p.name, model, opts, true, out.tokens, started);
          return out.text;
        } catch (e) {
          await this.track(p.name, model, opts, false, 0, started);
          errors.push(
            `${p.name}/${model}: ${e instanceof AiQuotaDeferred ? 'quota' : e instanceof ProviderError ? 'credential or billing rejection' : 'attempt failed'}`,
          );
          if ((p.name === 'groq' || p.name === 'gemini') && ((e instanceof RetryableError && e.transient) || e instanceof ProviderError)) {
            this.retryAt.set(p.name + '/' + model, Date.now() + 30_000);
          }
          if (e instanceof AiQuotaDeferred) {
            if (e.daily && opts.openRouterOnly && opts.deferWhenRateLimited) throw e;
            rateLimited.push(e.until);
          }
          if (e instanceof ProviderError || (e instanceof AiQuotaDeferred && e.daily)) break; // skip this provider's other models
        }
      }
    }
    if (opts.deferWhenRateLimited && rateLimited.length) {
      throw new AiQuotaDeferred(new Date(Math.min(...rateLimited.map((date) => date.valueOf()))));
    }
    this.logger.warn(`AI ${opts.feature} failed on all models: ${errors.join(' | ')}`);
    throw new IntegrationFailedException(providers[0].name, `AI अभी busy है — थोड़ी देर में फिर कोशिश करें। (${errors.length} models tried)`);
  }

  private async complete(p: Provider, model: string, messages: any[], opts: CallOpts, timeoutMs: number) {
    let responseFormat: Record<string, unknown> | undefined = opts.json ? { type: 'json_object' } : undefined;
    if ((p.name === 'qwen_local' || p.name === 'openrouter') && opts.responseSchema) {
      let schema;
      try {
        schema = toJSONSchema(opts.responseSchema, { target: 'draft-7', io: 'input', reused: 'ref' });
      } catch {
        throw new RetryableError('JSON schema cannot be represented safely');
      }
      if (Buffer.byteLength(JSON.stringify(schema), 'utf8') > 16000) throw new RetryableError('local JSON schema exceeds bounded grammar size');
      // Gemma 4 free endpoints advertise JSON mode, not server-side strict grammar.
      // Send the same bounded contract as instructions and retain independent Zod
      // validation/one repair below. No provider/pricing/privacy filter is relaxed.
      if (p.name === 'openrouter' && /^google\/gemma-4-(?:31b|26b-a4b)-it:free$/.test(model)) {
        responseFormat = { type: 'json_object' };
        messages = [
          { role: 'system', content: 'Return ONLY a JSON object matching this schema. Unknown facts must remain null. Schema: ' + JSON.stringify(schema) },
          ...messages,
        ];
      } else
        responseFormat =
          p.name === 'qwen_local'
            ? { type: 'json_object', schema }
            : { type: 'json_schema', json_schema: { name: 'brokeriq_response', strict: opts.strictSchema === true, schema } };
    }
    const key = opts.cacheMs
      ? createHash('sha256')
          .update(
            JSON.stringify([p.name, model, opts.orgId ?? null, opts.userId ?? null, opts.feature, responseFormat, opts.maxTokens, opts.temperature, messages]),
          )
          .digest('hex')
      : null;
    const hit = key ? this.cache.get(key) : undefined;
    if (hit && Date.now() - hit.at < hit.ttl) return { text: hit.text, tokens: 0 };
    const data = await this.post(
      p,
      {
        model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1500,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      },
      timeoutMs,
    );
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') throw new RetryableError('model exhausted its output token budget');
    const text = String(choice?.message?.content ?? '');
    if (!text.trim()) throw new RetryableError('model returned an empty answer');
    if (key) this.remember(key, text, opts.cacheMs!);
    return { text, tokens: data.usage?.total_tokens ?? 0 };
  }

  private async post(p: Provider, body: Record<string, unknown>, timeoutMs: number): Promise<any> {
    if (p.name === 'qwen_local') {
      // No in-process queue: a busy shared CPU fails over, rather than holding CRM requests indefinitely.
      if (this.localBusy || Date.now() < this.localRetryAt) throw new RetryableError('local generation busy/cooling down');
      const messages = body.messages;
      // UTF-8 bytes are a conservative upper bound on text tokens, including Hindi;
      // reserve room for the 768-token answer and the4K model's chat template.
      if (
        !Array.isArray(messages) ||
        messages.some((m) => typeof m?.content !== 'string') ||
        Buffer.byteLength(JSON.stringify(messages), 'utf8') > 2500 ||
        body.tools
      )
        throw new RetryableError('local model supports bounded text only');
      this.localBusy = true;
      try {
        return await this.postRequest(
          p,
          { ...body, max_tokens: Math.min(Number(body.max_tokens) || 512, 768), cache_prompt: false },
          Math.min(timeoutMs, 30000),
        );
      } catch (error) {
        this.localRetryAt = Date.now() + 60000;
        throw error;
      } finally {
        this.localBusy = false;
      }
    }
    return this.postRequest(p, body, timeoutMs);
  }

  private async postRequest(p: Provider, body: Record<string, unknown>, timeoutMs: number): Promise<any> {
    const startedAt = Date.now();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}) };
    if (p.name === 'openrouter') {
      if (typeof body.model !== 'string' || !isFreeOpenRouterModel(body.model)) throw new ProviderError('OpenRouter requires a free model');
      headers['HTTP-Referer'] = env().PUBLIC_WEB_URL;
      headers['X-Title'] = 'BrokerIQ';
      // A :free model name alone does not pin endpoint pricing or data policy.
      // Fail when no compliant endpoint exists; never relax these on fallback.
      body = {
        ...body,
        ...(p.disableReasoning && !this.openRouterMandatoryReasoning.has(body.model) ? { reasoning: { enabled: false } } : {}),
        provider: {
          ...openRouterFreeRouting,
          ...(p.allowPrivateData ? { zdr: true } : {}),
          ...(body.tools || (body.response_format as { type?: string } | undefined)?.type === 'json_schema' ? { require_parameters: true } : {}),
        },
      };
    }
    if (p.name === 'groq' || p.name === 'gemini') {
      const quotaZone = p.name === 'gemini' ? 'America/Los_Angeles' : 'UTC';
      const reserved = await this.prisma.$queryRaw<{ attempts: number }[]>`
        INSERT INTO "AiProviderDailyQuota" ("provider", "day", "attempts")
        VALUES (${p.name}, (CURRENT_TIMESTAMP AT TIME ZONE ${quotaZone})::date, 1)
        ON CONFLICT ("provider", "day") DO UPDATE SET "attempts" = "AiProviderDailyQuota"."attempts" + 1
        WHERE "AiProviderDailyQuota"."attempts" < ${p.dailyLimit}
        RETURNING "attempts"
      `;
      if (!reserved.length) {
        const now = Date.now();
        const until = p.name === 'gemini' ? nextPacificDay(now) : nextUtcDay().valueOf();
        throw new AiQuotaDeferred(new Date(until), true, p.name);
      }
      if (p.name === 'groq') {
        const { max_tokens, ...input } = body;
        body = { ...input, max_completion_tokens: max_tokens, reasoning_effort: 'low' };
      }
    }
    if (p.name === 'openrouter') {
      if (this.openRouterDailyResetAt > Date.now()) {
        throw new AiQuotaDeferred(new Date(this.openRouterDailyResetAt), true);
      }
      // Count upstream requests, including model fallbacks, retries and diagnostics.
      const reserved = await this.prisma.$queryRaw<{ attempts: number }[]>`
        INSERT INTO "OpenRouterDailyQuota" ("day", "attempts")
        VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 1)
        ON CONFLICT ("day") DO UPDATE SET "attempts" = "OpenRouterDailyQuota"."attempts" + 1
        WHERE "OpenRouterDailyQuota"."attempts" < ${OPENROUTER_DAILY_LIMIT}
        RETURNING "attempts"
      `;
      if (!reserved.length) {
        this.openRouterDailyResetAt = nextUtcDay().valueOf();
        throw new AiQuotaDeferred(new Date(this.openRouterDailyResetAt), true);
      }
    }
    let res: Response;
    try {
      res = await fetch(p.url, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      throw new RetryableError(`network/timeout: ${(e as Error).message}`, true);
    }
    if (res.status === 429 && typeof body.model === 'string') {
      const retryAfter = res.headers?.get('retry-after');
      const now = Date.now();
      const resetAt = Number(res.headers?.get('x-ratelimit-reset'));
      const remaining = res.headers?.get('x-ratelimit-remaining');
      const resetNearMidnight = Math.abs(resetAt - nextUtcDay().valueOf()) < 60_000;
      if (p.name === 'openrouter' && remaining === '0' && resetAt > now && resetNearMidnight) {
        this.openRouterDailyResetAt = Math.max(resetAt, nextUtcDay().valueOf());
        throw new AiQuotaDeferred(new Date(this.openRouterDailyResetAt), true);
      }
      const retryAt = !retryAfter ? NaN : /^\d+$/.test(retryAfter) ? now + Number(retryAfter) * 1000 : Date.parse(retryAfter);
      const until = Number.isFinite(retryAt) && retryAt > now ? Math.min(retryAt, now + 86_400_000) : now + 60_000;
      this.retryAt.set(p.name + '/' + body.model, until);
      throw new AiQuotaDeferred(new Date(until), false, p.name);
    }
    const data: any = await res.json().catch(() => ({}));
    const msg = data?.error?.message ?? data?.[0]?.error?.message ?? `HTTP ${res.status}`;
    if (
      p.name === 'openrouter' &&
      [400, 422].includes(res.status) &&
      typeof body.model === 'string' &&
      (body.reasoning as { enabled?: boolean } | undefined)?.enabled === false &&
      /reasoning is mandatory.*cannot be disabled/i.test(String(msg))
    ) {
      const { reasoning: _reasoning, ...retry } = body;
      // The setting applies to optional reasoning. Both requests use the same free price/privacy rules and quota.
      if (body.model !== 'openrouter/free') this.openRouterMandatoryReasoning.add(body.model);
      const remaining = timeoutMs - (Date.now() - startedAt);
      if (remaining < 1) throw new RetryableError('No time left for the reasoning retry');
      return this.postRequest({ ...p, disableReasoning: false }, retry, remaining);
    }
    if (res.status === 401 || res.status === 403) throw new ProviderError(`key rejected (HTTP ${res.status})`);
    if (res.status === 402) throw new ProviderError('billing rejected (HTTP 402)');
    if (!res.ok) throw new RetryableError(`model request rejected (HTTP ${res.status})`, res.status >= 500);
    if (data?.error) throw new RetryableError('provider returned an invalid completion');
    return data;
  }

  private remember(key: string, text: string, ttl: number) {
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { at: Date.now(), ttl, text });
  }

  private async track(
    provider: string,
    model: string,
    opts: { feature: string; orgId?: string | null; userId?: string },
    success: boolean,
    tokens: number,
    started = Date.now(),
  ) {
    await this.prisma.aiUsage
      .create({ data: { provider, model, feature: opts.feature, organizationId: opts.orgId ?? null, userId: opts.userId, success, tokens } })
      .catch(() => undefined);
    if (env().AI_LANGFUSE_LOCAL_ENABLED) this.telemetry.record({ provider, model, feature: opts.feature, started, success, tokens });
  }

  // ------------------------------------------------------------------ admin
  /** Credentials Center "Test": one tiny call, plus (OpenRouter) the free models available right now. */
  async test(key: ProviderName, values: Record<string, unknown>) {
    const p = this.toProvider(key, values);
    if (!p.textModels.length && (key === 'groq' || key === 'gemini')) {
      throw new IntegrationNotConfiguredException(key, 'Confirm the provider project is on the free tier and save its required quota settings.');
    }
    p.allowPrivateData = false; // The diagnostic sends only a fixed public prompt.
    const errors: string[] = [];
    for (const model of p.textModels) {
      try {
        const data = await this.post(p, { model, messages: [{ role: 'user', content: 'Reply with the single word OK' }], max_tokens: 128 }, 20_000);
        const ok = String(data.choices?.[0]?.message?.content ?? '').trim();
        if (!ok) throw new RetryableError('empty diagnostic response');
        const [free, quota] =
          key === 'openrouter'
            ? await Promise.all([this.freeModels(p.apiKey).catch((): string[] => []), this.freeDailyQuota(p.apiKey).catch(() => null)])
            : ([new Array<string>(), null] as const);
        const missing =
          key === 'openrouter' && free.length ? [...p.textModels, ...p.visionModels].filter((m) => m !== 'openrouter/free' && !free.includes(m)) : [];
        return [
          `${model}: ${ok}`,
          quota ? `OpenRouter free requests today: ${quota.used}/${quota.limit} (UTC). BrokerIQ cap: ${OPENROUTER_DAILY_LIMIT} attempts/day.` : '',
          missing.length ? `⚠️ अभी free list में नहीं: ${missing.join(', ')}` : '',
          free.length ? `Free models (${free.length}): ${free.slice(0, 12).join(', ')}${free.length > 12 ? ' …' : ''}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      } catch (e) {
        errors.push(`${model}: ${(e as Error).message}`);
        if (e instanceof ProviderError || (e instanceof AiQuotaDeferred && e.daily)) break;
      }
    }
    throw new Error(errors.join(' | ') || 'No model configured');
  }

  private async freeDailyQuota(apiKey: string) {
    const response = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data: { data?: { free_model_daily_requests?: { used?: number; limit?: number } } } = await response.json();
    const quota = data.data?.free_model_daily_requests;
    if (typeof quota?.used !== 'number' || typeof quota.limit !== 'number') return null;
    return { used: quota.used, limit: quota.limit };
  }

  /** Model ids on OpenRouter that are free right now (ids ending in ":free"). */
  async freeModels(apiKey: string): Promise<string[]> {
    const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
    const data: any = await res.json().catch(() => ({}));
    return (data.data ?? []).map((m: any) => String(m.id)).filter((id: string) => id.endsWith(':free'));
  }
}

export function parseJsonLoose<T>(text: string): T {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // reasoning models
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error('AI returned invalid JSON');
  }
}
