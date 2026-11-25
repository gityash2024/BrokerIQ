export const assistantProgressPhases = ['understanding', 'retrieving', 'composing', 'retrying', 'confirming', 'applying', 'transcribing'] as const;
export type AssistantPhase = (typeof assistantProgressPhases)[number];
export type AssistantProgress = { requestId: string; phase: AssistantPhase };

export const assistantPhaseText: Record<AssistantPhase, { en: string; hi: string }> = {
  understanding: { en: 'Understanding your request', hi: 'आपका सवाल समझ रहा हूँ' },
  retrieving: { en: 'Checking your workspace records', hi: 'Workspace के records देख रहा हूँ' },
  composing: { en: 'Preparing your answer', hi: 'जवाब तैयार कर रहा हूँ' },
  retrying: { en: 'Trying another free model', hi: 'दूसरा free model आज़मा रहा हूँ' },
  confirming: { en: 'Preparing a confirmation', hi: 'Confirmation तैयार कर रहा हूँ' },
  applying: { en: 'Applying your confirmed change', hi: 'आपका मंज़ूर किया बदलाव कर रहा हूँ' },
  transcribing: { en: 'Turning your recording into text', hi: 'Recording को text में बदल रहा हूँ' },
};

export function assistantDestination(url: unknown, native = false): string | undefined {
  if (typeof url !== 'string') return;
  if (url === '/user/account/saved') return native ? '/(user)/saved' : url;
  const property = /^\/(?:user\/)?property\/([a-zA-Z0-9_-]+)$/.exec(url);
  if (property) return (native ? '/property/' : '/user/property/') + property[1];
  const lead = /^\/broker\/leads\/([a-zA-Z0-9_-]+)$/.exec(url);
  if (lead) return (native ? '/lead/' : '/broker/leads/') + lead[1];
  const ownListing = /^\/(?:user\/account|broker)\/listings\/([a-zA-Z0-9_-]{1,100})\/edit$/.exec(url);
  if (ownListing) return native ? '/post-property?id=' + ownListing[1] : url;
  if (/^\/admin\/moderation(?:\?listing=[a-zA-Z0-9_-]{1,100})?$/.test(url)) return native ? 'https://brokeriq.mymultimeds.com' + url : url;
}

type Inline = { kind: 'text' | 'bold' | 'emphasis' | 'code' | 'link'; text: string; url?: string };
export type AssistantBlock =
  { kind: 'paragraph' | 'heading' | 'quote' | 'code'; lines: Inline[][] } | { kind: 'list'; lines: Inline[][]; start: number | null };

function inline(text: string): Inline[] {
  const parts: Inline[] = [];
  const tokens = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|`([^`\n]+)`|\*([^*\n]+)\*/g;
  let end = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index > end) parts.push({ kind: 'text', text: text.slice(end, match.index) });
    if (match[1]) parts.push({ kind: 'link', text: match[1], url: match[2] });
    else if (match[3] || match[4]) parts.push({ kind: 'bold', text: match[3] ?? match[4] });
    else if (match[5]) parts.push({ kind: 'code', text: match[5] });
    else parts.push({ kind: 'emphasis', text: match[6] });
    end = match.index + match[0].length;
  }
  if (end < text.length) parts.push({ kind: 'text', text: text.slice(end) });
  return parts;
}

/** Render a consistent Markdown subset as native text and React elements. */
export function assistantBlocks(content: string): AssistantBlock[] {
  const blocks: AssistantBlock[] = [];
  let code: AssistantBlock | undefined;
  let separated = true;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      if (code) code = undefined;
      else {
        code = { kind: 'code', lines: [] };
        blocks.push(code);
      }
      separated = true;
      continue;
    }
    if (code) {
      code.lines.push([{ kind: 'text', text: line }]);
      continue;
    }
    if (!line.trim()) {
      separated = true;
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    const list = /^\s*(?:(\d+)[.)]|[-+*])\s+(.+)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    const previous = separated ? undefined : blocks.at(-1);
    if (heading) blocks.push({ kind: 'heading', lines: [inline(heading[1])] });
    else if (list) {
      const start = list[1] ? Number(list[1]) : null;
      if (previous?.kind === 'list' && (previous.start === null) === (start === null)) previous.lines.push(inline(list[2]));
      else blocks.push({ kind: 'list', start, lines: [inline(list[2])] });
    } else {
      const kind = quote ? 'quote' : 'paragraph';
      const body = inline(quote?.[1] ?? line);
      if (previous?.kind === kind) previous.lines.push(body);
      else blocks.push({ kind, lines: [body] });
    }
    separated = false;
  }
  return blocks;
}

export function assistantInlineDestination(url: unknown, cardUrls: unknown[], staff: boolean, native = false) {
  const destination = assistantDestination(url, native);
  if (!destination) return;
  if (staff && url === '/admin/moderation') return destination;
  if (cardUrls.some((cardUrl) => assistantDestination(cardUrl, native) === destination)) return destination;
}
