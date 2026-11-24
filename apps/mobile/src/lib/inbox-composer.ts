import { router } from 'expo-router';
import { canUseBrokerChat, leadInboxDraftTarget, type LeadInboxChannel } from '@brokeriq/shared';
import { authStore, captureAccountContext, assertAccountContext } from './api';
import { showError } from './hooks';
import { saveInboxDraft } from './inbox-drafts';
export async function openLeadInbox(leadId: string, draft?: string, channel: LeadInboxChannel = 'WHATSAPP') {
  try {
    const owner = captureAccountContext();
    if (!owner.userId) throw new Error('Sign in before opening Inbox');
    if (!canUseBrokerChat(authStore.get()?.user)) throw new Error('Ask your Broker Admin for Chat access.');
    if (draft) await saveInboxDraft(leadInboxDraftTarget(leadId, channel), draft, owner);
    assertAccountContext(owner);
    router.push({ pathname: '/wa/compose', params: { leadId, channel } });
  } catch (error) {
    showError(error);
  }
}
