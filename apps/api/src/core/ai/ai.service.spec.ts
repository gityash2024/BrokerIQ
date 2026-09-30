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
});
