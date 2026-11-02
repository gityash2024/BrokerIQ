'use client';
import { captureAccountContext, assertAccountContext, type AccountContext } from './api';
import { readPrivateDraft, writePrivateDraft, movePrivateDraft, preserveLegacyInbox, hasPreservedLegacyInbox } from './private-drafts';
const writes = new Map<string, Promise<unknown>>();
const chainKey = (owner: AccountContext) => `${owner.scope}:${owner.revision}`;
function remember(owner: AccountContext, next: Promise<unknown>) {
  const key = chainKey(owner);
  writes.set(key, next);
  const clear = () => {
    if (writes.get(key) === next) writes.delete(key);
  };
  void next.then(clear, clear);
}
const name = (target: string) => `inbox:${target}`;
async function quarantine(target: string, owner: AccountContext) {
  assertAccountContext(owner);
  if (!owner.userId) throw new Error('Sign in before opening Inbox drafts.');
  const key = `biq.inbox-draft:${owner.userId}:${target}`,
    original = sessionStorage.getItem(key);
  if (original !== null) {
    await preserveLegacyInbox(owner.userId, target, original);
    // Another tab/old editor may have changed it while encryption was running.
    if (sessionStorage.getItem(key) === original) sessionStorage.removeItem(key);
  }
  assertAccountContext(owner);
}
export async function readInboxDraft(target: string, owner = captureAccountContext()) {
  await writes.get(chainKey(owner))?.catch(() => undefined);
  await quarantine(target, owner);
  const draft = await readPrivateDraft<string>(owner, name(target), true);
  assertAccountContext(owner);
  return draft ?? '';
}
export function saveInboxDraft(target: string, body: string, owner = captureAccountContext()) {
  const next = (writes.get(chainKey(owner)) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      await quarantine(target, owner);
      await writePrivateDraft(owner, name(target), body);
    });
  remember(owner, next);
  return next;
}
export function moveInboxDraft(source: string, target: string, owner = captureAccountContext()) {
  const next = (writes.get(chainKey(owner)) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      await quarantine(source, owner);
      await quarantine(target, owner);
      return movePrivateDraft(owner, name(source), name(target));
    });
  remember(owner, next);
  return next;
}
export async function hasLegacyInboxDraft(target: string, owner = captureAccountContext()) {
  await quarantine(target, owner);
  return hasPreservedLegacyInbox(owner, target);
}
