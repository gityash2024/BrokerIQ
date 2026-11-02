import { router } from 'expo-router';
import { leadInboxDraftTarget, type LeadInboxChannel } from '@brokeriq/shared';
import { authStore } from './api';
import { showError } from './hooks';
import { saveInboxDraft } from './inbox-drafts';
export async function openLeadInbox(leadId: string, draft?: string, channel: LeadInboxChannel = 'WHATSAPP') {
  try {
    const owner = authStore.get()?.user.id;
    if (!owner) throw new Error('Sign in before opening Inbox');
    if (draft) await saveInboxDraft(leadInboxDraftTarget(leadId, channel), draft, owner);
    if (authStore.get()?.user.id !== owner) return;
    router.push({ pathname: '/wa/compose', params: { leadId, channel } });
  } catch (error) {
    showError(error);
  }
}
