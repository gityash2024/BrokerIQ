import { z } from 'zod';

const recordId = z.string().trim().min(1).max(80);
export const broadcastContactInput = z.object({
  name: z.string().trim().min(1).max(140),
  phone: z.string().trim().min(10).max(25),
  consentEvidence: z.string().trim().min(6).max(500).nullable().optional(),
});
export const broadcastGroupInput = z.object({
  name: z.string().trim().min(1).max(100),
  contactIds: z.array(recordId),
});
export const broadcastMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().trim().min(1).max(4096) }),
  z.object({ type: z.enum(['image', 'document', 'video', 'audio']), url: z.url().startsWith('https://').max(1800), caption: z.string().trim().max(1024).optional() }),
  z.object({
    type: z.literal('template'), name: z.string().regex(/^[a-z0-9_]{1,100}$/),
    language: z.string().regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/),
    params: z.array(z.string().trim().min(1).max(1000)).max(25),
    header: z.object({ type: z.enum(['image', 'document', 'video']), url: z.url().startsWith('https://').max(1800) }).optional(),
  }),
]);
export const broadcastDraftInput = z.object({
  name: z.string().trim().min(1).max(140),
  groupIds: z.array(recordId).min(1),
  message: broadcastMessage,
  allowMetaCharges: z.boolean().default(false),
});
export type BroadcastDraftInput = z.infer<typeof broadcastDraftInput>;
export const META_WHATSAPP_BILLING = 'https://business.facebook.com/latest/billing_hub/payment_methods/';
export const META_WHATSAPP_PRICING = 'https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing';

export interface BroadcastContact { id: string; name: string; phone: string; consentAt: string | null; optedOutAt: string | null }
export interface BroadcastGroup { id: string; name: string; contactIds: string[] }
export interface BroadcastTemplate { name: string; language: string; category: string; body: string | null; components?: unknown }
export interface BroadcastWorkspace {
  contacts: BroadcastContact[];
  next: string | null;
  groups: BroadcastGroup[];
  broadcasts: { id: string; name: string; queuedAt: string; counts: Record<string, number> }[];
  connected: boolean;
  templates: BroadcastTemplate[];
}
export interface BroadcastQuote {
  id: string | null;
  selected: number;
  eligible: number;
  canQueue: number;
  skipped: number;
  estimatedCost: number | null;
  freeCapacity: number | null;
  balance: number | null;
  remainingBalance: number | null;
  allowMetaCharges: boolean;
}
export const BROADCAST_API = '/whatsapp/broadcast';

export function parseBroadcastContacts(text: string) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter((line) => line.trim());
  return lines.flatMap((line, index) => {
    const delimiter = line.includes('\t') ? '\t' : ',';
    let quoted = false;
    const values = [''];
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') {
        values[values.length - 1] += '"';
        i++;
      } else if (char === '"') quoted = !quoted;
      else if (!quoted && char === delimiter) values.push('');
      else values[values.length - 1] += char;
    }
    const [name, phone, consentEvidence] = values.map((value) => value.trim());
    if (index === 0 && name.toLowerCase() === 'name' && phone?.toLowerCase() === 'phone') return [];
    if (quoted || values.length > 3) throw new Error('Check CSV quoting or columns on line ' + (index + 1));
    const item = broadcastContactInput.safeParse({ name, phone, consentEvidence: consentEvidence || undefined });
    if (!item.success) throw new Error('Enter a contact name and valid phone on line ' + (index + 1));
    return item.data;
  });
}

export function broadcastHeaderType(template?: BroadcastTemplate) {
  if (!Array.isArray(template?.components)) return undefined;
  const type = template.components.find((component) => component?.type === 'HEADER')?.format?.toLowerCase();
  return type === 'image' || type === 'video' || type === 'document' ? type as 'image' | 'video' | 'document' : undefined;
}

export function broadcastMediaType(mime: string) {
  if (mime.startsWith('image/')) return 'image' as const;
  if (mime.startsWith('video/')) return 'video' as const;
  if (mime.startsWith('audio/')) return 'audio' as const;
  return 'document' as const;
}
