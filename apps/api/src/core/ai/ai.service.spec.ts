import { z } from 'zod';
import { capturedEntitySchema } from '@brokeriq/shared';
import * as configuration from '../../config/env';
import { AiService, parseJsonLoose } from './ai.service';

/** Fallback chain: busy models and rejected keys fall through; JSON is validated and repaired once. */
describe('AiService', () => {
  const realFetch = global.fetch;
  let calls: { url: string; model: string; msgs: number }[];
  let respond: (url: string, body: any) => { status: number; json: any; headers?: Headers };

  const settings = (config: Record<string, Record<string, unknown> | null>, order = 'openrouter,groq,gemini') =>
    ({
      getAppConfig: async () => ({ ai: { providerOrder: order } }),
      resolve: async (key: string) => config[key] ?? null,
    }) as any;
  const prisma = { aiUsage: { create: jest.fn().mockResolvedValue({}) } } as any;
  const ok = (content: string) => ({ status: 200, json: { choices: [{ message: { content } }], usage: { total_tokens: 10 } } });

  beforeEach(() => {
    jest.spyOn(configuration, 'env').mockReturnValue({ ...configuration.env(), BROKER_FIRST: false });
    calls = [];
    global.fetch = jest.fn(async (url: any, init: any) => {
      const body = JSON.parse(init.body);
      calls.push({ url: String(url), model: body.model, msgs: body.messages.length });
      const r = respond(String(url), body);
      return { ok: r.status < 400, status: r.status, headers: r.headers, json: async () => r.json } as any;
    }) as any;
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('uses the next model when one is rate limited', async () => {
    respond = (_u, b) => (b.model === 'a:free' ? { status: 429, json: { error: { message: 'rate limited' } } } : ok('नमस्ते'));
    const ai = new AiService(settings({ openrouter: { apiKey: 'k', textModel: 'a:free', fallbackModels: 'b:free' } }), prisma);
    await expect(ai.chat([{ role: 'user', content: 'hi' }], { feature: 't' })).resolves.toBe('नमस्ते');
    expect(calls.map((c) => c.model)).toEqual(['a:free', 'b:free']);
  });

  it('honors a free model Retry-After without skipping available OpenRouter alternatives', async () => {
    respond = (_url, body) => (body.model === 'a:free' ? { status: 429, json: {}, headers: new Headers({ 'Retry-After': '60' }) } : ok('hosted'));
    const ai = new AiService(settings({ openrouter: { apiKey: 'k', textModel: 'a:free', fallbackModels: 'b:free' } }), prisma);
    const messages = [{ role: 'user' as const, content: 'hi' }];
    await expect(ai.chat(messages, { feature: 't' })).resolves.toBe('hosted');
    await expect(ai.chat(messages, { feature: 't' })).resolves.toBe('hosted');
    expect(calls.map((call) => call.model)).toEqual(['a:free', 'b:free', 'b:free']);
  });

  it.each(['partial answer', ''])('falls back from token exhaustion and caches the complete answer (%j)', async (content) => {
    respond = (_url, body) => {
      if (body.model === 'b:free') return ok('complete answer');
      const result = ok(content);
      return { ...result, json: { ...result.json, choices: [{ message: { content }, finish_reason: 'length' }] } };
    };
    const ai = new AiService(settings({ openrouter: { apiKey: 'k', textModel: 'a:free', fallbackModels: 'b:free' } }), prisma);
    const messages = [{ role: 'user' as const, content: 'Describe this property' }];
    const options = { feature: 'description', cacheMs: 60_000 };
    await expect(ai.chat(messages, options)).resolves.toBe('complete answer');
    await expect(ai.chat(messages, options)).resolves.toBe('complete answer');
    expect(calls.map((call) => call.model)).toEqual(['a:free', 'b:free', 'a:free']);
  });

  it('does not report an empty provider diagnostic as a successful connection', async () => {
    respond = () => ok(' ');
    const ai = new AiService(settings({}), prisma);
    await expect(ai.test('openrouter', { apiKey: 'k', textModel: 'openrouter/free' })).rejects.toThrow('empty diagnostic response');
  });

  it('uses only the exact approved image-import model and never falls back to an unapproved router', async () => {
    jest.spyOn(configuration, 'env').mockReturnValue({ ...configuration.env(), BROKER_FIRST: true });
    const values = {
      apiKey: 'k',
      visionModel: 'a:free',
      visionFallbackModels: 'openrouter/free,b:free',
      captureVisionApprovedModel: 'a:free',
      captureVisionEvaluationSha256: '',
    };
    const ai = new AiService(settings({ openrouter: values }), prisma);
    expect(await ai.isAvailable('vision')).toBe(true);
    expect(await ai.isAvailable('vision', 'capture')).toBe(false);
    await expect(ai.vision('data:image/png;base64,AA==', 'Extract', { feature: 'capture' })).rejects.toThrow();
    expect(calls).toHaveLength(0);

    values.captureVisionEvaluationSha256 = 'a'.repeat(64);
    respond = () => ({ status: 429, json: { error: { message: 'rate limited' } } });
    expect(await ai.isAvailable('vision', 'capture')).toBe(true);
    await expect(ai.vision('data:image/png;base64,AA==', 'Extract', { feature: 'capture' })).rejects.toThrow();
    expect(calls.map((call) => call.model)).toEqual(['a:free']);

    values.captureVisionApprovedModel = 'openrouter/free';
    expect(await ai.isAvailable('vision', 'capture')).toBe(false);
  });

  it('keeps no-training and zero-price endpoint constraints on every launch fallback', async () => {
    const configuration = require('../../config/env');
    const spy = jest.spyOn(configuration, 'env').mockReturnValue({ ...configuration.env(), BROKER_FIRST: true });
    const bodies: any[] = [];
    respond = (_url, body) => {
      bodies.push(body);
      return body.model === 'a:free' ? { status: 404, json: { error: { message: 'No eligible endpoint' } } } : ok('OK');
    };
    try {
      const ai = new AiService(settings({ openrouter: { apiKey: 'k', textModel: 'a:free', fallbackModels: 'b:free' } }), prisma);
      await expect(ai.chat([{ role: 'user', content: 'A reviewed draft' }], { feature: 't' })).resolves.toBe('OK');
      expect(bodies).toHaveLength(2);
      for (const body of bodies) expect(body.provider).toEqual({ data_collection: 'deny', max_price: { prompt: 0, completion: 0, image: 0, request: 0 } });
    } finally {
      spy.mockRestore();
    }
  });

  it('never calls a paid OpenRouter model, including when the full platform is active', async () => {
    respond = () => ok('OK');
    const ai = new AiService(settings({ openrouter: { apiKey: 'k', textModel: 'paid-model', fallbackModels: 'a:free,a:free' } }), prisma);
    await expect(ai.chat([{ role: 'user', content: 'Test' }], { feature: 'test' })).resolves.toBe('OK');
    expect(calls.map((call) => call.model)).toEqual(['a:free']);
    await expect(ai.test('openrouter', { apiKey: 'k', textModel: 'paid-model' })).rejects.toThrow('No model configured');
    expect(calls).toHaveLength(1);
  });

  it('skips a provider whose key is rejected and moves to the next provider', async () => {
    respond = (u) => (u.includes('openrouter') ? { status: 401, json: { error: { message: 'bad key' } } } : ok('from groq'));
    const ai = new AiService(
      settings({ openrouter: { apiKey: 'k', textModel: 'a:free', fallbackModels: 'b:free' }, groq: { apiKey: 'g', textModel: 'llama' } }),
      prisma,
    );
    await expect(ai.chat([{ role: 'user', content: 'hi' }], { feature: 't' })).resolves.toBe('from groq');
    expect(calls.map((c) => c.model)).toEqual(['a:free', 'llama']); // b:free not tried after 401
  });

  it('follows the admin provider order', async () => {
    respond = () => ok('x');
    const ai = new AiService(settings({ openrouter: { apiKey: 'k', textModel: 'or' }, gemini: { apiKey: 'g', model: 'gem' } }, 'gemini,openrouter'), prisma);
    await ai.chat([{ role: 'user', content: 'hi' }], { feature: 't' });
    expect(calls[0].model).toBe('gem');
  });

  it('sends OpenRouter the actual contract and keeps zero-cost routing on schema-capable endpoints', async () => {
    let body: any;
    respond = (_url, input) => {
      body = input;
      return ok('{"purpose":"RENT"}');
    };
    const ai = new AiService(settings({ openrouter: { apiKey: 'k', textModel: 'model:free' } }), prisma);
    await expect(
      ai.json([{ role: 'user', content: 'Rent' }], { feature: 'capture', schema: z.object({ purpose: z.enum(['RENT', 'SALE']) }) }),
    ).resolves.toEqual({ purpose: 'RENT' });
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.schema.properties.purpose.enum).toEqual(['RENT', 'SALE']);
    expect(body.provider).toEqual({ data_collection: 'deny', max_price: { prompt: 0, completion: 0, image: 0, request: 0 }, require_parameters: true });
  });

  it('repairs JSON that does not match the schema, then validates it', async () => {
    let n = 0;
    respond = () => (n++ === 0 ? ok('{"score": "high"}') : ok('```json\n{"score": 80, "label": "HOT"}\n```'));
    const ai = new AiService(settings({ groq: { apiKey: 'g', textModel: 'llama' } }), prisma);
    const out = await ai.json([{ role: 'user', content: 'rate' }], { feature: 't', schema: z.object({ score: z.number(), label: z.enum(['HOT', 'COLD']) }) });
    expect(out).toEqual({ score: 80, label: 'HOT' });
    expect(calls[1].msgs).toBe(3); // original + bad answer + repair request
  });

  it('gives a clear configure error when no provider has a key', async () => {
    const ai = new AiService(settings({}), prisma);
    await expect(ai.chat([{ role: 'user', content: 'hi' }], { feature: 't' })).rejects.toMatchObject({ status: 424 });
  });

  it('caches identical answers when asked', async () => {
    respond = () => ok('cached text');
    const ai = new AiService(settings({ groq: { apiKey: 'g', textModel: 'llama' } }), prisma);
    const msgs = [{ role: 'user' as const, content: 'same' }];
    await ai.chat(msgs, { feature: 'd', cacheMs: 60_000 });
    await ai.chat(msgs, { feature: 'd', cacheMs: 60_000 });
    expect(calls).toHaveLength(1);
  });

  it('parses JSON wrapped in reasoning tags or code fences', () => {
    expect(parseJsonLoose('<think>let me see</think>\n{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonLoose('Sure! {"a":2} hope this helps')).toEqual({ a: 2 });
  });

  it('uses configured local Qwen first without inventing vision, tool or audio capability', async () => {
    respond = () => ok('local answer');
    const ai = new AiService(settings({ qwen_local: { textModel: 'qwen2.5-1.5b-instruct', endpoint: 'https://untrusted.example' } }), prisma);
    await expect(ai.chat([{ role: 'user', content: 'summarize' }], { feature: 'capture' })).resolves.toBe('local answer');
    expect(calls[0]).toMatchObject({ url: 'http://127.0.0.1:18080/v1/chat/completions', model: 'qwen2.5-1.5b-instruct' });
    await expect(ai.isAvailable('text')).resolves.toBe(true);
    await expect(ai.isAvailable('vision')).resolves.toBe(false);
    await expect(ai.chatWithTools([{ role: 'user', content: 'action' }], [], { feature: 'tools' })).rejects.toMatchObject({ status: 424 });
    await expect(ai.transcribe('AAAA', 'audio/wav', undefined, {})).rejects.toMatchObject({ status: 424 });
    expect(calls).toHaveLength(1);
  });

  it('prioritizes free OpenRouter over local text in broker-first mode', async () => {
    const configuration = require('../../config/env');
    const current = configuration.env();
    const spy = jest.spyOn(configuration, 'env').mockReturnValue({ ...current, BROKER_FIRST: true });
    try {
      const ai = new AiService(
        settings({
          qwen_local: { textModel: 'qwen', structuredTextApprovedModel: 'qwen', structuredEvaluationSha256: 'a'.repeat(64) },
          openrouter: { apiKey: 'k', textModel: 'paid-model', fallbackModels: 'a:free' },
          groq: { apiKey: 'g', textModel: 'other' },
        }),
        prisma,
      );
      expect((await ai.providers()).map((p) => ({ name: p.name, textModels: p.textModels }))).toEqual([
        { name: 'openrouter', textModels: ['a:free'] },
        { name: 'qwen_local', textModels: ['qwen'] },
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it('falls through oversized local prompts without truncating their original text', async () => {
    const prompt = 'x'.repeat(8000);
    respond = (_url, body) => {
      expect(body.messages[0].content).toBe(prompt);
      return ok('hosted');
    };
    const ai = new AiService(
      settings({
        qwen_local: { textModel: 'qwen', structuredTextApprovedModel: 'qwen', structuredEvaluationSha256: 'a'.repeat(64) },
        openrouter: { apiKey: 'k', textModel: 'a:free' },
      }),
      prisma,
    );
    await expect(ai.chat([{ role: 'user', content: prompt }], { feature: 'capture' })).resolves.toBe('hosted');
    expect(calls.map((c) => c.model)).toEqual(['a:free']);
  });

  it('does not queue simultaneous local requests and releases its slot on completion', async () => {
    let release!: (value: any) => void;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    ) as any;
    const ai = new AiService(
      settings({ qwen_local: { textModel: 'qwen', structuredTextApprovedModel: 'qwen', structuredEvaluationSha256: 'a'.repeat(64) } }),
      prisma,
    );
    const first = ai.chat([{ role: 'user', content: 'one' }], { feature: 'capture' });
    // Let the first provider resolution acquire its only local generation slot.
    while (!release) await new Promise((resolve) => setImmediate(resolve));
    await expect(ai.chat([{ role: 'user', content: 'two' }], { feature: 'capture' })).rejects.toMatchObject({ status: 502 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    release({ ok: true, status: 200, json: async () => ok('one').json });
    await expect(first).resolves.toBe('one');
    respond = () => ok('after');
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ok('after').json })) as any;
    await expect(ai.chat([{ role: 'user', content: 'after' }], { feature: 'capture' })).resolves.toBe('after');
  });

  it('bounds Devanagari by UTF-8 bytes and caps output before the shared local request', async () => {
    let sent: any;
    respond = (_url, body) => {
      sent = body;
      return ok('bounded');
    };
    const ai = new AiService(
      settings({ qwen_local: { textModel: 'qwen', structuredTextApprovedModel: 'qwen', structuredEvaluationSha256: 'a'.repeat(64) } }),
      prisma,
    );
    await ai.chat([{ role: 'user', content: 'छोटा संदेश' }], { feature: 'capture', maxTokens: 6000 });
    expect(sent.max_tokens).toBe(768);
    expect(sent.cache_prompt).toBe(false);
    await expect(ai.chat([{ role: 'user', content: 'क'.repeat(900) }], { feature: 'capture' })).rejects.toMatchObject({ status: 502 });
    expect(calls).toHaveLength(1);
  });

  it('constrains local JSON with the actual schema and still independently checks its answer', async () => {
    let format: any;
    let attempts = 0;
    respond = (_url, body) => {
      format = body.response_format;
      return ok(attempts++ ? '{"intent":"DEMAND"}' : '{"intent":"INVENTED"}');
    };
    const ai = new AiService(
      settings({ qwen_local: { textModel: 'qwen', structuredTextApprovedModel: 'qwen', structuredEvaluationSha256: 'a'.repeat(64) } }),
      prisma,
    );
    const schema = z.object({ intent: z.enum(['DEMAND', 'OFFER']) });
    await expect(ai.json([{ role: 'user', content: 'Required flat' }], { feature: 'capture', schema })).resolves.toEqual({ intent: 'DEMAND' });
    expect(format.type).toBe('json_object');
    expect(format.schema.properties.intent.enum).toEqual(['DEMAND', 'OFFER']);
    expect(format.schema.properties.intent.type).toBe('string');
    expect(attempts).toBe(2);
  });

  it('never treats a successful text connection as approved structured extraction', async () => {
    respond = () => ok('healthy');
    const ai = new AiService(settings({ qwen_local: { textModel: 'qwen' } }), prisma);
    await expect(ai.isAvailable('text')).resolves.toBe(true);
    await expect(ai.isAvailable('json')).resolves.toBe(false);
    await expect(
      ai.json([{ role: 'user', content: 'Plot for sale' }], { feature: 'capture', schema: z.object({ purpose: z.enum(['RENT', 'SALE']) }) }),
    ).rejects.toMatchObject({ status: 424 });
    expect(calls).toHaveLength(0);
    const changed = new AiService(
      settings({ qwen_local: { textModel: 'new-model', structuredTextApprovedModel: 'old-model', structuredEvaluationSha256: 'a'.repeat(64) } }),
      prisma,
    );
    await expect(changed.isAvailable('json')).resolves.toBe(false);
    respond = () => ok('{"purpose":"SALE"}');
    const fallback = new AiService(settings({ qwen_local: { textModel: 'qwen' }, openrouter: { apiKey: 'k', textModel: 'a:free' } }), prisma);
    await expect(
      fallback.json([{ role: 'user', content: 'Plot for sale' }], { feature: 'capture', schema: z.object({ purpose: z.enum(['RENT', 'SALE']) }) }),
    ).resolves.toEqual({ purpose: 'SALE' });
    expect(calls.map((c) => c.model)).toEqual(['a:free']);
  });

  it('constrains transformed input without dropping independent output normalization or refinements', async () => {
    let format: any;
    respond = (_url, body) => {
      format = body.response_format;
      return ok('{"phone":" +91 98999 80802 "}');
    };
    const ai = new AiService(
      settings({ qwen_local: { textModel: 'qwen', structuredTextApprovedModel: 'qwen', structuredEvaluationSha256: 'a'.repeat(64) } }),
      prisma,
    );
    const schema = z.object({ phone: z.string().transform((s) => s.replace(/\D/g, '')) }).refine((x) => x.phone.length === 12);
    await expect(ai.json([{ role: 'user', content: 'Normalize supplied phone' }], { feature: 'capture', schema })).resolves.toEqual({ phone: '919899980802' });
    const phoneSchema = format.schema.properties.phone;
    const resolved = phoneSchema.$ref ? format.schema.definitions[phoneSchema.$ref.split('/').at(-1)] : phoneSchema;
    expect(resolved.type).toBe('string');
    respond = () => ok('{"phone":"short"}');
    await expect(ai.json([{ role: 'user', content: 'Invalid phone' }], { feature: 'capture', schema })).rejects.toMatchObject({ status: 502 });
  });

  it('keeps the real capture grammar below its unchanged size budget using shared definitions', async () => {
    let format: any;
    respond = (_url, body) => {
      format = body.response_format;
      return ok('{"entities":[{"kind":"UNRELATED","warnings":[]}]}');
    };
    const ai = new AiService(
      settings({ qwen_local: { textModel: 'qwen', structuredTextApprovedModel: 'qwen', structuredEvaluationSha256: 'a'.repeat(64) } }),
      prisma,
    );
    const schema = z.object({ entities: z.array(capturedEntitySchema).max(100) });
    const value = await ai.json([{ role: 'user', content: 'A group system notice' }], { feature: 'capture', schema });
    expect(value.entities[0].kind).toBe('UNRELATED');
    expect(Buffer.byteLength(JSON.stringify(format.schema), 'utf8')).toBeLessThanOrEqual(16000);
    expect(Object.keys(format.schema.definitions).length).toBeGreaterThan(0);
  });

  it('falls back after OpenRouter throttling and cools down a failed local service', async () => {
    let localCalls = 0;
    respond = (url) => (url.includes('127.0.0.1') ? (localCalls++, { status: 503, json: {} }) : { status: 429, json: {} });
    const ai = new AiService(
      settings({
        qwen_local: { textModel: 'qwen', structuredTextApprovedModel: 'qwen', structuredEvaluationSha256: 'a'.repeat(64) },
        openrouter: { apiKey: 'k', textModel: 'a:free' },
      }),
      prisma,
    );
    const messages = [{ role: 'user' as const, content: 'same' }];
    await expect(ai.chat(messages, { feature: 'capture', orgId: 'a' })).rejects.toMatchObject({ status: 502 });
    await expect(ai.chat(messages, { feature: 'capture', orgId: 'b' })).rejects.toMatchObject({ status: 502 });
    expect(localCalls).toBe(1);
    expect(calls.map((c) => c.model)).toEqual(['a:free', 'qwen', 'a:free']);
  });
});
