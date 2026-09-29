/**
 * Free-text rental search ("2bhk furnished sector 54 under 40k", "PG sohna road 12000")
 * → structured filters. Used by the WhatsApp bot; the locality text is matched against
 * master data on the server.
 */
export interface ParsedQuery {
  bedrooms: number[];
  minBudget: number | null;
  maxBudget: number | null;
  furnishing: 'FULLY_FURNISHED' | 'SEMI_FURNISHED' | 'UNFURNISHED' | null;
  types: string[];
  localityText: string | null;
  command: 'help' | 'alert' | 'stop' | 'more' | null;
  isSearch: boolean;
}

function rupees(raw: string): number | null {
  const m = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|thousand|hazar|hazaar|l|lac|lakh|lakhs)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = (m[2] ?? '').toLowerCase();
  const mult = u.startsWith('k') || u === 'thousand' || u.startsWith('haz') ? 1e3 : u.startsWith('l') ? 1e5 : 1;
  const v = Math.round(n * mult);
  return v >= 1000 && v <= 50_00_000 ? v : null;
}

export function parseRentalQuery(input: string): ParsedQuery {
  const t = ` ${input.toLowerCase().replace(/\s+/g, ' ').trim()} `;
  const command: ParsedQuery['command'] = /^\s*(hi|hello|hey|help|menu|namaste|नमस्ते|हेलो|start)\s*$/.test(t)
    ? 'help'
    : /^\s*(stop|unsubscribe|बंद|रोको)\s*$/.test(t)
      ? 'stop'
      : /^\s*(alert|alerts|alert on|notify|अलर्ट)\s*$/.test(t)
        ? 'alert'
        : /^\s*(more|aur|और)\s*$/.test(t)
          ? 'more'
          : null;
  const bedrooms = [...new Set([...t.matchAll(/(\d)\s*(?:bhk|bk|rk|bed(?:room)?s?)\b/g)].map((m) => Number(m[1])))].filter((n) => n > 0 && n < 7);
  let minBudget: number | null = null;
  let maxBudget: number | null = null;
  const range = t.match(/(\d[\d.,]*\s*(?:k|l|lac|lakh)?)\s*(?:-|to|से)\s*(\d[\d.,]*\s*(?:k|l|lac|lakh)?)/);
  const under = t.match(/(?:under|below|upto|up to|max|budget|tak|तक|के अंदर|within|₹|rs\.?)\s*(\d[\d.,]*\s*(?:k|l|lac|lakh|thousand|hazar)?)/);
  const trailing = t.match(/(\d[\d.,]*\s*(?:k|l|lac|lakh|thousand|hazar))\s*(?:tak|तक|budget|max)?/);
  if (range) {
    // "60-80k": the unit on the upper bound applies to the lower one too.
    const unit = range[2].match(/[a-z]+\s*$/)?.[0] ?? '';
    minBudget = rupees(range[1]) ?? (unit ? rupees(`${range[1].trim()}${unit}`) : null);
    maxBudget = rupees(range[2]);
  } else if (under) maxBudget = rupees(under[1]);
  else if (trailing) maxBudget = rupees(trailing[1]);
  else {
    const bare = t.match(/\b(\d{4,6})\b/);
    if (bare && !/sector\s*\d{4,6}/.test(t)) maxBudget = rupees(bare[1]);
  }
  const furnishing = /semi[\s-]?furnish/.test(t) ? 'SEMI_FURNISHED' : /unfurnish/.test(t) ? 'UNFURNISHED' : /furnish/.test(t) ? 'FULLY_FURNISHED' : null;
  const types = /\b(pg|paying guest|hostel|co-?living)\b/.test(t) ? ['PG'] : /builder floor|independent floor/.test(t) ? ['BUILDER_FLOOR'] : /\b(villa|kothi|house)\b/.test(t) ? ['INDEPENDENT_HOUSE', 'VILLA'] : /\b(studio|1rk)\b/.test(t) ? ['STUDIO'] : [];
  const sector = t.match(/\b(sector|sec|सेक्टर)[\s-]*(\d{1,3}[a-z]?)\b/);
  const road = t.match(/\b(golf course (?:ext(?:ension)?\s*)?road|golf course|sohna road|mg road|dlf phase[\s-]*\d|cyber city|udyog vihar|palam vihar|south city[\s-]*\d?|sushant lok[\s-]*\d?|nirvana country|new gurgaon|dwarka expressway|spr|manesar)\b/);
  const localityText = sector ? `Sector ${sector[2].toUpperCase()}` : road ? road[1].replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  const isSearch = !command && (bedrooms.length > 0 || maxBudget != null || furnishing != null || types.length > 0 || localityText != null || /\b(flat|rent|kiraye|किराये|room|pg|house|ghar|घर)\b/.test(t));
  return { bedrooms, minBudget, maxBudget, furnishing, types, localityText, command, isSearch };
}
