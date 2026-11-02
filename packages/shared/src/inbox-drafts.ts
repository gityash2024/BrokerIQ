export type LeadInboxChannel = 'WHATSAPP' | 'SMS' | 'EMAIL';

/** Retain existing WhatsApp drafts; other channels never consume that legacy key. */
export function leadInboxDraftTarget(leadId: string, channel: LeadInboxChannel = 'WHATSAPP') {
  return channel === 'WHATSAPP' ? `lead:${leadId}` : `lead:${channel}:${leadId}`;
}
