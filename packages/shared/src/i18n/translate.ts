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
  const lookup = (text: string, depth = 0): string | undefined => {
    const k = norm(text);
    if (!k) return undefined;
    const hit = exact.get(k);
    if (hit !== undefined) return hit;
    for (const p of patterns) {
      const m = k.match(p.re);
      if (m) {
        // `{n}` takes the next captured value in source order; `{1}`, `{2}` … pick one by position
        // (for languages whose word order differs from the source). A captured value that is itself
        // UI text ("5 properties" in "{n} found") is translated too.
        const part = (v: string | undefined) => (v === undefined ? '' : depth < 2 ? (lookup(v, depth + 1) ?? v) : v);
        let i = 1;
        return p.out.replace(/\{(n|\d)\}/g, (_, x: string) => part(x === 'n' ? m[i++] : m[Number(x)]));
      }
    }
    // "Active 3", "Leads (12)" style labels: translate the text part only
    const m = k.match(/^(.*?[^\d\s(])(\s*\(?[\d.,]+[+]?\)?)$/u);
    if (m && m[1].length > 1) {
      const head = exact.get(m[1]);
      if (head !== undefined) return head + m[2];
    }
    if (depth < 2) {
      // "· Fully furnished", ". Made with …": keep leading punctuation
      const lead = k.match(/^([^\p{L}\p{N}"“'‘]+)(\p{L}.*)$/u);
      if (lead) {
        const rest = lookup(lead[2], depth + 1);
        if (rest !== undefined) return lead[1] + rest;
      }
      // "1 month rent (₹3,50,000)": keep a trailing bracket
      const tail = k.match(/^(.+?)(\s*\([^()]*\))$/u);
      if (tail) {
        const head = lookup(tail[1], depth + 1);
        if (head !== undefined) return head + tail[2];
      }
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

/**
 * Dates are formatted with 'en-IN' across the apps; while a language is chosen, send those calls
 * to that language's locale instead (Latin digits kept, like the rest of the UI).
 */
export function localizeDates(getLang: () => string | null | undefined) {
  const D = Date.prototype as any;
  if (D.__biqLocalized) return;
  D.__biqLocalized = true;
  for (const name of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'] as const) {
    const orig = D[name];
    D[name] = function (this: Date, locales?: string | string[], opts?: Intl.DateTimeFormatOptions) {
      const lang = getLang();
      if (lang && lang !== 'en' && locales === 'en-IN') {
        try {
          return orig.call(this, `${lang}-IN-u-nu-latn`, opts);
        } catch {
          /* locale data missing: fall back */
        }
      }
      return orig.call(this, locales, opts);
    };
  }
}
