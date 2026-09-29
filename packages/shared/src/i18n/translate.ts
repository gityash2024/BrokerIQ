/**
 * Runtime UI translation. Dictionaries are keyed by the exact source string used in the UI
 * (the app's original Hindi/English mix), so screens need no key refactor. `{n}` in a key
 * matches a dynamic part (a number, amount or name) and is carried into the translation
 * (`{1}`, `{2}` … in a translation reorder them).
 * Anything without a translation is shown unchanged.
 */
export type Dictionary = Record<string, string>;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface Translator {
  (text: string): string;
  has: (text: string) => boolean;
}

export function makeTranslator(dict: Dictionary | null | undefined): Translator {
  const exact = new Map<string, string>();
  const patterns: { re: RegExp; out: string }[] = [];
  for (const [k, v] of Object.entries(dict ?? {})) {
    if (!v) continue;
    const key = norm(k);
    if (key.includes('{n}')) {
      const literal = key.replace(/\{n\}/g, '');
      if (literal.replace(/[\s\p{P}\p{S}]/gu, '').length < 2) continue; // too generic to match safely
      const re = new RegExp(`^${key.split('{n}').map(escape).join('(.+?)')}$`, 'u');
      patterns.push({ re, out: v });
    } else exact.set(key, v);
  }
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  const lookup = (text: string): string | undefined => {
    const k = norm(text);
    if (!k) return undefined;
    const hit = exact.get(k);
    if (hit !== undefined) return hit;
    for (const p of patterns) {
      const m = k.match(p.re);
      if (m) {
        // `{n}` takes the next captured value in source order; `{1}`, `{2}` … pick one by position
        // (for languages whose word order differs from the source).
        let i = 1;
        return p.out.replace(/\{(n|\d)\}/g, (_, x: string) => (x === 'n' ? m[i++] : m[Number(x)]) ?? '');
      }
    }
    // "Active 3", "Leads (12)", "₹ 25,000 rent" style labels: translate the text part only
    const m = k.match(/^(.*?[^\d\s(])(\s*\(?[\d.,]+[+]?\)?)$/u);
    if (m && m[1].length > 1) {
      const head = exact.get(m[1]);
      if (head !== undefined) return head + m[2];
    }
    return undefined;
  };
  const t = ((text: string) => {
    if (typeof text !== 'string' || !exact.size) return text;
    const found = lookup(text);
    if (found === undefined) return text;
    // keep the surrounding whitespace of the original (JSX text nodes rely on it)
    const lead = text.match(/^\s*/)?.[0] ?? '';
    const trail = text.match(/\s*$/)?.[0] ?? '';
    return lead + found + trail;
  }) as Translator;
  t.has = (text) => lookup(text) !== undefined;
  return t;
}
