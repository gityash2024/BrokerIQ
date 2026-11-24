import { connectSurveyKey, type ConnectSurveyField, type ConnectSurveySuggestion, type ConnectSurveyValues } from '@brokeriq/shared';

export function customSurveySuggestions(definitions: ConnectSurveyField[], existing: ConnectSurveyValues,
  transcript: string, confidence: number): (ConnectSurveySuggestion & { verified: boolean })[] {
  return definitions.flatMap(({ label, type, required }) => {
    const field = connectSurveyKey(label);
    const previous = Object.hasOwn(existing, field) ? existing[field].value : null;
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ +/g, '\\s+');
    const patterns = { TEXT: '[^.;,!?\\n]{1,120}', NUMBER: '-?\\d+(?:\\.\\d+)?', YES_NO: 'yes|no|हाँ|नहीं' };
    const pattern = new RegExp(`(?:^|(?<=[^\\p{L}\\p{N}\\p{M}]))${escaped}\\s*(?:[:=]|is\\b)\\s*(${patterns[type]})(?=\\s*(?:$|[;,.!?\\n]))`, 'giu');
    const candidates = new Map<string | number | boolean, string>();
    for (const match of transcript.matchAll(pattern)) {
      const raw = match[1].trim();
      if (!raw || raw.includes('[contact]') || (type === 'NUMBER' && /[,.]\d/.test(transcript.slice(match.index + match[0].length, match.index + match[0].length + 2)))) continue;
      const value = type === 'NUMBER' ? Number(raw) : type === 'YES_NO' ? /^(yes|हाँ)$/iu.test(raw) : raw;
      if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000)) continue;
      candidates.set(value, match[0].trim());
    }
    if (!candidates.size && (!required || previous !== null)) return [];
    const proposed = candidates.size === 1 ? candidates.keys().next().value ?? null : null;
    return [{ field: 'custom:' + field, label, proposed, previous, required, confidence,
      conflict: candidates.size > 1 || (proposed !== null && previous !== null && proposed !== previous),
      verified: proposed !== null, applied: false, evidence: [...candidates.values()].join(' · ').slice(0, 500) }];
  });
}
