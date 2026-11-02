import { router } from 'expo-router';
import { leadInboxDraftTarget, type LeadInboxChannel } from '@brokeriq/shared';
import { captureAccountContext, assertAccountContext } from './api';
import { showError } from './hooks';
import { saveInboxDraft } from './inbox-drafts';
export async function openLeadInbox(leadId: string, draft?: string, channel: LeadInboxChannel = 'WHATSAPP') {
  try {
    const owner = captureAccountContext();
    if (!owner.userId) throw new Error('Sign in before opening Inbox');
    if (draft) await saveInboxDraft(leadInboxDraftTarget(leadId, channel), draft, owner);
    assertAccountContext(owner);
    router.push({ pathname: '/wa/compose', params: { leadId, channel } });
  } catch (error) {
    showError(error);
  }
}
