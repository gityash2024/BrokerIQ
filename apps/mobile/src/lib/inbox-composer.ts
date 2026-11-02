import { router } from 'expo-router';
import { authStore } from './api';
import { showError } from './hooks';
import { saveInboxDraft } from './inbox-drafts';
export async function openLeadInbox(leadId: string, draft?: string, channel: 'WHATSAPP' | 'SMS' | 'EMAIL' = 'WHATSAPP') {
  try {
    const owner = authStore.get()?.user.id;
    if (!owner) throw new Error('Sign in before opening Inbox');
    if (draft) await saveInboxDraft(`lead:${leadId}`, draft, owner);
    if (authStore.get()?.user.id !== owner) return;
    router.push({ pathname: '/wa/compose', params: { leadId, channel } });
  } catch (error) {
    showError(error);
  }
}
