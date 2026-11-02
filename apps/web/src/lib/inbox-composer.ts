'use client';
import { authStore } from './api';
import { leadInboxDraftTarget, type LeadInboxChannel } from '@brokeriq/shared';
export const leadInboxUrl = (leadId: string, channel: 'WHATSAPP' | 'SMS' | 'EMAIL' = 'WHATSAPP') => `/broker/inbox?lead=${encodeURIComponent(leadId)}&channel=${channel}`;
export const inboxDraftKey = (owner: string, target: string) => `biq.inbox-draft:${owner}:${target}`;
/** Draft contents stay out of URLs, browser history and analytics referrers. */
export function openLeadInbox(leadId: string, draft?: string, channel: LeadInboxChannel = 'WHATSAPP') {
  const owner = authStore.get()?.user.id;
  if (!owner) throw new Error('Sign in before opening Inbox');
  if (draft) sessionStorage.setItem(inboxDraftKey(owner, leadInboxDraftTarget(leadId, channel)), draft);
  window.location.assign(leadInboxUrl(leadId, channel));
}
