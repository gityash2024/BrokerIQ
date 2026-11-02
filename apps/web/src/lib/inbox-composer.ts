'use client';
import { captureAccountContext, assertAccountContext, errorMessage } from './api';
import { leadInboxDraftTarget, type LeadInboxChannel } from '@brokeriq/shared';
import { saveInboxDraft } from './inbox-drafts';
import { toast } from 'sonner';
export const leadInboxUrl = (leadId: string, channel: 'WHATSAPP' | 'SMS' | 'EMAIL' = 'WHATSAPP') =>
  `/broker/inbox?lead=${encodeURIComponent(leadId)}&channel=${channel}`;
/** Ciphertext stays in IndexedDB; client text never enters URLs or navigation history. */
export async function openLeadInbox(leadId: string, draft?: string, channel: LeadInboxChannel = 'WHATSAPP') {
  try {
    const owner = captureAccountContext();
    if (!owner.userId) throw new Error('Sign in before opening Inbox');
    if (draft) await saveInboxDraft(leadInboxDraftTarget(leadId, channel), draft, owner);
    assertAccountContext(owner);
    window.location.assign(leadInboxUrl(leadId, channel));
  } catch (error) {
    toast.error(errorMessage(error));
  }
}
