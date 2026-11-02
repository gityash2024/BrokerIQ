import { z } from 'zod';
import { AiService, parseJsonLoose } from './ai.service';

/** Fallback chain: busy models and rejected keys fall through; JSON is validated and repaired once. */
describe('AiService', () => {
  const realFetch = global.fetch;
  let calls: { url: string; model: string; msgs: number }[];
  let respond: (url: string, body: any) => { status: number; json: any };

  const settings = (config: Record<string, Record<string, unknown> | null>, order = 'openrouter,groq,gemini') =>
    ({
      getAppConfig: async () => ({ ai: { providerOrder: order } }),
      resolve: async (key: string) => config[key] ?? null,
    }) as any;
  const prisma = { aiUsage: { create: jest.fn().mockResolvedValue({}) } } as any;
  const ok = (content: string) => ({ status: 200, json: { choices: [{ message: { content } }], usage: { total_tokens: 10 } } });

  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn(async (url: any, init: any) => {
      const body = JSON.parse(init.body);
      calls.push({ url: String(url), model: body.model, msgs: body.messages.length });
      const r = respond(String(url), body);
      return { ok: r.status < 400, status: r.status, json: async () => r.json } as any;
    }) as any;
  });
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('uses the next model when one is rate limited', async () => {
    respond = (_u, b) => (b.model === 'a:free' ? { status: 429, json: { error: { message: 'rate limited' } } } : ok('नमस्ते'));
    const ai = new AiService(settings({ openrouter: { apiKey: 'k', textModel: 'a:free', fallbackModels: 'b:free' } }), prisma);
    await expect(ai.chat([{ role: 'user', content: 'hi' }], { feature: 't' })).resolves.toBe('नमस्ते');
    expect(calls.map((c) => c.model)).toEqual(['a:free', 'b:free']);
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

  it('allows local text and only free OpenRouter fallback in broker-first mode', async () => {
    const configuration = require('../../config/env');
    const current = configuration.env();
    const spy = jest.spyOn(configuration, 'env').mockReturnValue({ ...current, BROKER_FIRST: true });
    try {
      const ai = new AiService(settings({ qwen_local: { textModel: 'qwen' }, openrouter: { apiKey: 'k', textModel: 'paid-model', fallbackModels: 'a:free' }, groq: { apiKey: 'g', textModel: 'other' } }), prisma);
      expect((await ai.providers()).map(p => ({ name: p.name, textModels: p.textModels }))).toEqual([
        { name: 'qwen_local', textModels: ['qwen'] }, { name: 'openrouter', textModels: ['a:free'] },
      ]);
    } finally { spy.mockRestore(); }
  });

  it('falls through oversized local prompts without truncating their original text', async () => {
    const prompt = 'x'.repeat(8000);
    respond = (_url, body) => { expect(body.messages[0].content).toBe(prompt); return ok('hosted'); };
    const ai = new AiService(settings({ qwen_local: { textModel: 'qwen' }, openrouter: { apiKey: 'k', textModel: 'a:free' } }), prisma);
    await expect(ai.chat([{ role: 'user', content: prompt }], { feature: 'capture' })).resolves.toBe('hosted');
    expect(calls.map(c => c.model)).toEqual(['a:free']);
  });

  it('does not queue simultaneous local requests and releases its slot on completion', async () => {
    let release!: (value: any) => void;
    global.fetch = jest.fn(() => new Promise(resolve => { release = resolve; })) as any;
    const ai = new AiService(settings({ qwen_local: { textModel: 'qwen' } }), prisma);
    const first = ai.chat([{ role: 'user', content: 'one' }], { feature: 'capture' });
    // Let the first provider resolution acquire its only local generation slot.
    while (!release) await new Promise(resolve => setImmediate(resolve));
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
    respond = (_url, body) => { sent = body; return ok('bounded'); };
    const ai = new AiService(settings({ qwen_local: { textModel: 'qwen' } }), prisma);
    await ai.chat([{ role: 'user', content: 'छोटा संदेश' }], { feature: 'capture', maxTokens: 6000 });
    expect(sent.max_tokens).toBe(768);
    expect(sent.cache_prompt).toBe(false);
    await expect(ai.chat([{ role: 'user', content: 'क'.repeat(900) }], { feature: 'capture' })).rejects.toMatchObject({ status: 502 });
    expect(calls).toHaveLength(1);
  });

  it('cools down a failed local service and keeps cached responses firm/user scoped', async () => {
    let localCalls = 0;
    respond = (url) => url.includes('127.0.0.1') ? (localCalls++, { status: 503, json: {} }) : ok('hosted');
    const ai = new AiService(settings({ qwen_local: { textModel: 'qwen' }, openrouter: { apiKey: 'k', textModel: 'a:free' } }), prisma);
    const messages = [{ role: 'user' as const, content: 'same' }];
    await ai.chat(messages, { feature: 'capture', orgId: 'a', userId: 'a', cacheMs: 60000 });
    await ai.chat(messages, { feature: 'capture', orgId: 'b', userId: 'b', cacheMs: 60000 });
    await ai.chat(messages, { feature: 'capture', orgId: 'a', userId: 'a', cacheMs: 60000 });
    expect(localCalls).toBe(1);
    expect(calls.filter(c => c.model === 'a:free')).toHaveLength(2);
  });
});
