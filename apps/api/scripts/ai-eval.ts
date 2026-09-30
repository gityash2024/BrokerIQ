/**
 * AI quality check for BrokerIQ prompts across models (OpenRouter free models by default).
 *
 *   OPENROUTER_API_KEY=sk-or-... npx ts-node --transpile-only scripts/ai-eval.ts
 *   AI_EVAL_MODELS="meta-llama/llama-3.3-70b-instruct:free,deepseek/deepseek-chat-v3-0324:free" ...
 *
 * For every model it runs fixed sample inputs through the real prompts (src/core/ai/prompts.ts) and prints
 * pass-rate (output follows the rules/schema) and latency — use it to pick the primary and backup models.
 */
import { LEAD_INSIGHTS_SYSTEM, descriptionSystem, leadInsightsSchema } from '../src/core/ai/prompts';
import { parseJsonLoose } from '../src/core/ai/ai.service';

const KEY = process.env.OPENROUTER_API_KEY;
const MODELS = (process.env.AI_EVAL_MODELS ?? 'meta-llama/llama-3.3-70b-instruct:free,deepseek/deepseek-chat-v3-0324:free,qwen/qwen-2.5-72b-instruct:free,google/gemini-2.0-flash-exp:free')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

type Case = { name: string; messages: { role: string; content: string }[]; json?: boolean; check: (text: string) => string | null };

const words = (t: string) => t.trim().split(/\s+/).length;
const CASES: Case[] = [
  {
    name: 'description-en',
    messages: [
      { role: 'system', content: descriptionSystem('friendly', 'en') },
      { role: 'user', content: JSON.stringify({ type: 'Builder floor', bedrooms: 3, bathrooms: 3, area: 1800, price: 55000, furnishing: 'SEMI_FURNISHED', floor: 2, locality: 'Sector 57, Gurgaon (Golf Course Ext Rd)', amenities: ['Power backup', 'Lift', 'Parking'] }) },
    ],
    check: (t) => (words(t) < 90 || words(t) > 230 ? `length ${words(t)} words` : /\d{10}|https?:|www\./.test(t) ? 'contains phone/link' : /pool|gym|metro/i.test(t) ? 'invented amenity' : null),
  },
  {
    name: 'description-hi',
    messages: [
      { role: 'system', content: descriptionSystem('professional', 'hi') },
      { role: 'user', content: JSON.stringify({ type: 'Apartment', bedrooms: 2, area: 1250, price: 38000, furnishing: 'FULLY_FURNISHED', society: 'Tulip Orange', locality: 'Sector 70, Gurgaon' }) },
    ],
    check: (t) => (!/[ऀ-ॿ]/.test(t) ? 'not Devanagari' : words(t) < 70 ? `too short (${words(t)})` : null),
  },
  {
    name: 'lead-insights',
    json: true,
    messages: [
      { role: 'system', content: LEAD_INSIGHTS_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          lead: { name: 'Ankit', source: 'HOUSING', stage: 'CONTACTED', requirement: { bedrooms: [2], maxBudget: 40000, localities: ['Sector 65'], moveInBy: 'next week' } },
          activities: [{ type: 'CALL', callOutcome: 'CONNECTED', content: 'Wants semi-furnished, can visit Saturday' }],
          visits: [],
          whatsapp: [{ dir: 'INBOUND', text: 'Saturday 11 baje visit ho sakta hai?' }],
        }),
      },
    ],
    check: (t) => {
      try {
        const r = leadInsightsSchema.safeParse(parseJsonLoose(t));
        if (!r.success) return r.error.issues.map((i) => i.path.join('.')).join(',');
        return r.data.temperature === 'COLD' ? 'wrong temperature (should be HOT/WARM)' : null;
      } catch {
        return 'invalid JSON';
      }
    },
  },
];

async function run(model: string, c: Case) {
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'BrokerIQ eval' },
    body: JSON.stringify({ model, messages: c.messages, temperature: 0.3, max_tokens: 800, ...(c.json ? { response_format: { type: 'json_object' } } : {}) }),
    signal: AbortSignal.timeout(60_000),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: String(e) } }) }) as any);
  const data: any = await res.json().catch(() => ({}));
  const ms = Date.now() - t0;
  if (!res.ok) return { ok: false, ms, why: data?.error?.message ?? `HTTP ${res.status}` };
  const why = c.check(String(data.choices?.[0]?.message?.content ?? ''));
  return { ok: !why, ms, why };
}

async function main() {
  if (!KEY) {
    console.error('Set OPENROUTER_API_KEY (free key from https://openrouter.ai/keys).');
    process.exit(1);
  }
  for (const model of MODELS) {
    let pass = 0;
    let total = 0;
    const notes: string[] = [];
    for (const c of CASES) {
      const r = await run(model, c);
      total += r.ms;
      if (r.ok) pass++;
      else notes.push(`${c.name}: ${r.why}`);
    }
    console.log(`${pass}/${CASES.length} pass · avg ${Math.round(total / CASES.length)} ms · ${model}${notes.length ? `\n    ${notes.join('\n    ')}` : ''}`);
  }
}

main();
