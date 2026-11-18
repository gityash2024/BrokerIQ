export type MessagePart = { text: string; url?: string };

/** Only explicit HTTP(S) links become actions. Message content remains plain text. */
export function messageLinks(text: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let position = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"\u0000-\u001f]+/gi)) {
    const start = match.index!;
    const raw = match[0];
    const candidate = raw
      .replace(/[.,;!?]+$/, '')
      .replace(/\)$/, (ending) => ((raw.match(/\(/g)?.length ?? 0) < (raw.match(/\)/g)?.length ?? 0) ? '' : ending));
    let url: string | undefined;
    try {
      const parsed = new URL(candidate);
      if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) url = parsed.href;
    } catch {
      /* Keep malformed links as selectable text. */
    }
    if (start > position) parts.push({ text: text.slice(position, start) });
    parts.push({ text: candidate, ...(url ? { url } : {}) });
    position = start + candidate.length;
  }
  if (position < text.length) parts.push({ text: text.slice(position) });
  return parts.length ? parts : [{ text }];
}
