'use client';
import { authStore } from './api';
export const leadInboxUrl = (leadId: string) => `/broker/inbox?lead=${encodeURIComponent(leadId)}&channel=WHATSAPP`;
export const inboxDraftKey = (owner: string, target: string) => `biq.inbox-draft:${owner}:${target}`;
/** Draft contents stay out of URLs, browser history and analytics referrers. */
export function openLeadInbox(leadId: string, draft?: string) {
  const owner = authStore.get()?.user.id;
  if (!owner) throw new Error('Sign in before opening Inbox');
  if (draft) sessionStorage.setItem(inboxDraftKey(owner, `lead:${leadId}`), draft);
  window.location.assign(leadInboxUrl(leadId));
}
