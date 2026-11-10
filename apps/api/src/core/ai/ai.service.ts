import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { toJSONSchema, type ZodType } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { IntegrationFailedException, IntegrationNotConfiguredException } from '../../common/exceptions';
import { env } from '../../config/env';
import { isFreeOpenRouterModel, openRouterFreeRouting } from './openrouter-policy';

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
  captureVisionApprovedModel?: string;
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
}

const PROVIDERS: ProviderName[] = ['qwen_local', 'openrouter', 'groq', 'gemini'];
const URLS: Record<ProviderName, string> = {
  qwen_local: 'http://127.0.0.1:18080/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
};
const TEXT_TIMEOUT_MS = 45_000;
const VISION_TIMEOUT_MS = 90_000;
const CACHE_MAX = 300;
const NOT_CONFIGURED = 'AI configured नहीं है। Super Admin → Settings → Credentials में Local Qwen या सक्षम free AI provider configure करें।';

const list = (v: unknown) =>
  String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Errors worth trying the next model/provider for (busy, rate limited, model gone, bad output). */
class RetryableError extends Error {}
/** The provider itself is unusable (bad key, no credit) — skip all its models. */
class ProviderError extends Error {}

/**
 * Provider-agnostic AI client. Tries providers in the admin-set order (default OpenRouter → Groq → Gemini)
 * and, inside each, the primary then backup models — so a busy free model or a rate limit falls through to
 * the next one. JSON answers can be checked against a zod schema with one automatic repair attempt.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly cache = new Map<string, { at: number; ttl: number; text: string }>();
  private localBusy = false;
  private localRetryAt = 0;
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

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
        textModels: [...new Set([...list(v.textModel), ...list(v.fallbackModels)].filter(isFreeOpenRouterModel))],
        visionModels: [...new Set([...list(v.visionModel), ...list(v.visionFallbackModels)].filter(isFreeOpenRouterModel))],
        captureVisionApprovedModel:
          /^[a-f0-9]{64}$/.test(String(v.captureVisionEvaluationSha256 ?? '')) && typeof v.captureVisionApprovedModel === 'string'
            ? v.captureVisionApprovedModel
            : undefined,
      };
    if (name === 'groq')
      return { name, apiKey, url: URLS[name], textModels: list(v.textModel || 'llama-3.3-70b-versatile'), visionModels: list(v.visionModel) };
    return { name, apiKey, url: URLS[name], textModels: list(v.model || 'gemini-2.5-flash'), visionModels: list(v.model || 'gemini-2.5-flash') };
  }

  /** Configured providers in the admin-chosen order. */
  async providers(): Promise<Provider[]> {
    const app = await this.settings.getAppConfig();
    const order = [...new Set(['qwen_local', ...list(app.ai.providerOrder), ...PROVIDERS])].filter((p): p is ProviderName =>
      (PROVIDERS as string[]).includes(p),
    );
    const out: Provider[] = [];
    for (const name of order) {
      const v = await this.settings.resolve(name).catch(() => null);
      if (v && (v.apiKey || (name === 'qwen_local' && v.textModel))) {
        const provider = this.toProvider(name, v);
        // Paid fallback is never used by the broker-first launch.
        if (env().BROKER_FIRST && name !== 'openrouter' && name !== 'qwen_local') continue;
        if (provider.textModels.length || provider.visionModels.length) out.push(provider);
      }
    }
    return out;
  }

  private visionModels(provider: Provider, feature?: string) {
    if (feature !== 'capture' || !env().BROKER_FIRST) return provider.visionModels;
    // A generic router or fallback can change the underlying model after evaluation.
    return provider.visionModels.filter((model) => model.endsWith(':free') && model === provider.captureVisionApprovedModel);
  }

  async isAvailable(kind: 'text' | 'vision' | 'tools' | 'json' = 'text', feature?: string) {
    return (await this.providers()).some((p) =>
      kind === 'vision'
        ? this.visionModels(p, feature).length > 0
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
      if (opts.json) parseJsonLoose(out.text); // throws → next model
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
        TEXT_TIMEOUT_MS,
      );
      const m = data.choices?.[0]?.message;
      if (!m || (!m.content && !m.tool_calls?.length)) throw new RetryableError('empty answer');
      message = m;
      return { text: m.content ?? '', tokens: data.usage?.total_tokens ?? 0 };
    });
    return message;
  }

  /** Speech → text for the assistant's voice input (Groq Whisper, else Gemini audio). OpenRouter has no audio. */
  async transcribe(audioBase64: string, mime: string, lang: string | undefined, opts: { userId?: string; orgId?: string | null }) {
    const bytes = Buffer.from(audioBase64.replace(/^data:[^,]+,/, ''), 'base64');
    const providers = (await this.providers()).filter((p) => p.name === 'groq' || p.name === 'gemini');
    if (!providers.length)
      throw new IntegrationNotConfiguredException('groq', 'Voice input के लिए Groq या Gemini key चाहिए — तब तक phone का voice typing इस्तेमाल करें।');
    let lastError = '';
    for (const p of providers) {
      try {
        let text: string;
        if (p.name === 'groq') {
          const form = new FormData();
          const ext = mime.includes('webm')
            ? 'webm'
            : mime.includes('ogg')
              ? 'ogg'
              : mime.includes('wav')
                ? 'wav'
                : mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')
                  ? 'm4a'
                  : 'mp3';
          form.append('file', new Blob([bytes], { type: mime }), `voice.${ext}`);
          form.append('model', 'whisper-large-v3-turbo');
          form.append('response_format', 'json');
          if (lang && lang !== 'en') form.append('language', lang);
          const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${p.apiKey}` },
            body: form,
            signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
          });
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error?.message ?? `Groq HTTP ${res.status}`);
          text = String(data.text ?? '').trim();
        } else {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.textModels[0])}:generateContent?key=${p.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [
                      { text: 'Transcribe this voice note exactly, in the language spoken. Reply with the transcript only.' },
                      { inline_data: { mime_type: mime, data: bytes.toString('base64') } },
                    ],
                  },
                ],
              }),
              signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
            },
          );
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error?.message ?? `Gemini HTTP ${res.status}`);
          text = (data.candidates?.[0]?.content?.parts ?? [])
            .map((x: any) => x.text)
            .join('')
            .trim();
        }
        await this.track(p.name, p.name === 'groq' ? 'whisper-large-v3-turbo' : p.textModels[0], { feature: 'assistant-voice', ...opts }, true, 0);
        return text;
      } catch (e) {
        lastError = (e as Error).message;
        await this.track(p.name, 'voice', { feature: 'assistant-voice', ...opts }, false, 0);
      }
    }
    throw new IntegrationFailedException(providers[0].name, lastError);
  }

  // ------------------------------------------------------------------ core loop
  private async run(
    opts: CallOpts,
    kind: 'text' | 'vision' | 'tools' | 'json',
    attempt: (p: Provider, model: string) => Promise<{ text: string; tokens: number }>,
  ): Promise<string> {
    const providers = (await this.providers()).filter((p) =>
      kind === 'vision'
        ? this.visionModels(p, opts.feature).length > 0
        : (kind !== 'tools' || p.name !== 'qwen_local') &&
          (kind !== 'json' || p.name !== 'qwen_local' || p.structuredApproved === true) &&
          p.textModels.length > 0,
    );
    if (!providers.length) throw new IntegrationNotConfiguredException('openrouter', NOT_CONFIGURED);
    const errors: string[] = [];
    for (const p of providers) {
      const models = kind === 'vision' ? this.visionModels(p, opts.feature) : p.textModels;
      for (const model of models) {
        try {
          const out = await attempt(p, model);
          await this.track(p.name, model, opts, true, out.tokens);
          return out.text;
        } catch (e) {
          await this.track(p.name, model, opts, false, 0);
          errors.push(`${p.name}/${model}: ${(e as Error).message}`.slice(0, 200));
          if (e instanceof ProviderError) break; // skip this provider's other models
        }
      }
    }
    this.logger.warn(`AI ${opts.feature} failed on all models: ${errors.join(' | ')}`);
    throw new IntegrationFailedException(providers[0].name, `AI अभी busy है — थोड़ी देर में फिर कोशिश करें। (${errors.length} models tried)`);
  }

  private async complete(p: Provider, model: string, messages: any[], opts: CallOpts, timeoutMs: number) {
    let responseFormat: Record<string, unknown> | undefined = opts.json ? { type: 'json_object' } : undefined;
    if (p.name === 'qwen_local' && opts.responseSchema) {
      let schema;
      try {
        schema = toJSONSchema(opts.responseSchema, { target: 'draft-7', io: 'input', reused: 'ref' });
      } catch {
        throw new RetryableError('local JSON schema cannot be represented safely');
      }
      if (Buffer.byteLength(JSON.stringify(schema), 'utf8') > 16000) throw new RetryableError('local JSON schema exceeds bounded grammar size');
      responseFormat = { type: 'json_object', schema };
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
    const text = String(data.choices?.[0]?.message?.content ?? '');
    if (key && text.trim()) this.remember(key, text, opts.cacheMs!);
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
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}) };
    if (p.name === 'openrouter') {
      if (typeof body.model !== 'string' || !isFreeOpenRouterModel(body.model)) throw new ProviderError('OpenRouter requires a free model');
      headers['HTTP-Referer'] = env().PUBLIC_WEB_URL;
      headers['X-Title'] = 'BrokerIQ';
      // A :free model name alone does not pin endpoint pricing or data policy.
      // Fail when no compliant endpoint exists; never relax these on fallback.
      body = {
        ...body,
        provider: openRouterFreeRouting,
      };
    }
    let res: Response;
    try {
      res = await fetch(p.url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      throw new RetryableError(`network/timeout: ${(e as Error).message}`);
    }
    const data: any = await res.json().catch(() => ({}));
    const msg = data?.error?.message ?? data?.[0]?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new ProviderError(`key rejected: ${msg}`);
    if (res.status === 402) throw new ProviderError(`no credit: ${msg}`);
    if (!res.ok) throw new RetryableError(msg); // 400 (e.g. model can't do tools/json/images), 404, 429, 5xx
    if (data?.error) throw new RetryableError(String(data.error.message ?? 'provider error'));
    return data;
  }

  private remember(key: string, text: string, ttl: number) {
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { at: Date.now(), ttl, text });
  }

  private async track(provider: string, model: string, opts: { feature: string; orgId?: string | null; userId?: string }, success: boolean, tokens: number) {
    await this.prisma.aiUsage
      .create({ data: { provider, model, feature: opts.feature, organizationId: opts.orgId ?? null, userId: opts.userId, success, tokens } })
      .catch(() => undefined);
  }

  // ------------------------------------------------------------------ admin
  /** Credentials Center "Test": one tiny call, plus (OpenRouter) the free models available right now. */
  async test(key: ProviderName, values: Record<string, unknown>) {
    const p = this.toProvider(key, values);
    if (env().BROKER_FIRST) {
      if (key !== 'openrouter' && key !== 'qwen_local')
        throw new IntegrationNotConfiguredException('openrouter', 'Launch AI uses local Qwen or OpenRouter free models only.');
    }
    const errors: string[] = [];
    for (const model of p.textModels) {
      try {
        const data = await this.post(p, { model, messages: [{ role: 'user', content: 'Reply with the single word OK' }], max_tokens: 5 }, 20_000);
        const ok = String(data.choices?.[0]?.message?.content ?? '').trim();
        if (!ok) throw new RetryableError('empty diagnostic response');
        const free = key === 'openrouter' ? await this.freeModels(p.apiKey).catch(() => []) : [];
        const missing = key === 'openrouter' && free.length ? [...p.textModels, ...p.visionModels].filter((m) => m !== 'openrouter/free' && !free.includes(m)) : [];
        return [
          `${model}: ${ok}`,
          missing.length ? `⚠️ अभी free list में नहीं: ${missing.join(', ')}` : '',
          free.length ? `Free models (${free.length}): ${free.slice(0, 12).join(', ')}${free.length > 12 ? ' …' : ''}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      } catch (e) {
        errors.push(`${model}: ${(e as Error).message}`);
        if (e instanceof ProviderError) break;
      }
    }
    throw new Error(errors.join(' | ') || 'No model configured');
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
