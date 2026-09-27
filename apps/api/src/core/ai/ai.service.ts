import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { IntegrationFailedException, IntegrationNotConfiguredException } from '../../common/exceptions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface Provider {
  name: 'groq' | 'gemini';
  apiKey: string;
  textModel: string;
  visionModel: string;
}

const NOT_CONFIGURED = 'AI configured नहीं है। Super Admin → Settings → Integrations में Groq (या Gemini) API key जोड़ें।';

/** Provider-agnostic AI client (Groq primary, Gemini fallback) using plain fetch. */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  async provider(): Promise<Provider> {
    const groq = await this.settings.resolve('groq');
    if (groq) return { name: 'groq', apiKey: String(groq.apiKey), textModel: String(groq.textModel), visionModel: String(groq.visionModel) };
    const gemini = await this.settings.resolve('gemini');
    if (gemini) return { name: 'gemini', apiKey: String(gemini.apiKey), textModel: String(gemini.model), visionModel: String(gemini.model) };
    throw new IntegrationNotConfiguredException('groq', NOT_CONFIGURED);
  }

  async isAvailable() {
    return (await this.settings.isConfigured('groq')) || (await this.settings.isConfigured('gemini'));
  }

  async chat(messages: ChatMessage[], opts: { json?: boolean; feature: string; orgId?: string | null; userId?: string; maxTokens?: number; temperature?: number }): Promise<string> {
    const p = await this.provider();
    try {
      const out = p.name === 'groq' ? await this.groqChat(p, p.textModel, messages, opts) : await this.geminiChat(p, messages, undefined, opts);
      await this.track(p, opts, true, out.tokens);
      return out.text;
    } catch (e) {
      await this.track(p, opts, false, 0);
      if (e instanceof IntegrationFailedException) throw e;
      throw new IntegrationFailedException(p.name, (e as Error).message);
    }
  }

  async vision(imageDataUrl: string, prompt: string, opts: { json?: boolean; feature: string; orgId?: string | null; userId?: string; maxTokens?: number }): Promise<string> {
    const p = await this.provider();
    try {
      let out: { text: string; tokens: number };
      if (p.name === 'groq') {
        out = await this.groqChat(p, p.visionModel, [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } }] as any }], opts);
      } else {
        out = await this.geminiChat(p, [{ role: 'user', content: prompt }], imageDataUrl, opts);
      }
      await this.track(p, opts, true, out.tokens);
      return out.text;
    } catch (e) {
      await this.track(p, opts, false, 0);
      throw new IntegrationFailedException(p.name, (e as Error).message);
    }
  }

  async json<T = any>(messages: ChatMessage[], opts: { feature: string; orgId?: string | null; userId?: string; maxTokens?: number }): Promise<T> {
    const text = await this.chat(messages, { ...opts, json: true });
    return parseJsonLoose<T>(text);
  }

  private async groqChat(p: Provider, model: string, messages: any[], opts: { json?: boolean; maxTokens?: number; temperature?: number }) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1500,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? `Groq HTTP ${res.status}`);
    return { text: data.choices?.[0]?.message?.content ?? '', tokens: data.usage?.total_tokens ?? 0 };
  }

  private async geminiChat(p: Provider, messages: ChatMessage[], imageDataUrl: string | undefined, opts: { json?: boolean; maxTokens?: number; temperature?: number }) {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m, i, arr) => {
        const parts: any[] = [{ text: m.content }];
        if (imageDataUrl && i === arr.length - 1) {
          const [meta, b64] = imageDataUrl.split(',');
          parts.push({ inline_data: { mime_type: meta.match(/data:(.*?);/)?.[1] ?? 'image/jpeg', data: b64 } });
        }
        return { role: m.role === 'assistant' ? 'model' : 'user', parts };
      });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.textModel)}:generateContent?key=${p.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: { temperature: opts.temperature ?? 0.3, maxOutputTokens: opts.maxTokens ?? 1500, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message ?? `Gemini HTTP ${res.status}`);
    const text = data.candidates?.[0]?.content?.parts?.map((x: any) => x.text).join('') ?? '';
    return { text, tokens: data.usageMetadata?.totalTokenCount ?? 0 };
  }

  private async track(p: Provider, opts: { feature: string; orgId?: string | null; userId?: string }, success: boolean, tokens: number) {
    await this.prisma.aiUsage
      .create({ data: { provider: p.name, model: p.textModel, feature: opts.feature, organizationId: opts.orgId ?? null, userId: opts.userId, success, tokens } })
      .catch(() => undefined);
  }

  /** Used by the Credentials Center "Test connection" button. */
  async test(key: 'groq' | 'gemini', values: Record<string, unknown>) {
    const p: Provider =
      key === 'groq'
        ? { name: 'groq', apiKey: String(values.apiKey), textModel: String(values.textModel ?? 'llama-3.3-70b-versatile'), visionModel: String(values.visionModel ?? '') }
        : { name: 'gemini', apiKey: String(values.apiKey), textModel: String(values.model ?? 'gemini-2.5-flash'), visionModel: '' };
    const out = p.name === 'groq' ? await this.groqChat(p, p.textModel, [{ role: 'user', content: 'Reply with the single word OK' }], { maxTokens: 5 }) : await this.geminiChat(p, [{ role: 'user', content: 'Reply with the single word OK' }], undefined, { maxTokens: 5 });
    return out.text.trim();
  }
}

export function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error('AI returned invalid JSON');
  }
}
