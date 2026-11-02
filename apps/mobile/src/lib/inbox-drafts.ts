import { captureAccountContext, assertAccountContext, type AccountContext } from './api';
import { privateDraftDatabase } from '@/launch/drafts';
let writes = Promise.resolve();
async function database() {
  const db = await privateDraftDatabase();
  // Keep the original unscoped table intact. Its ownership cannot safely be inferred.
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS inbox_drafts_scoped (owner_id TEXT NOT NULL, owner_scope TEXT NOT NULL, target TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(owner_id,owner_scope,target))',
  );
  return db;
}
function assertOwner(owner: AccountContext) {
  assertAccountContext(owner);
  if (!owner.userId) throw new Error('Sign in before saving a message draft');
}
export async function readInboxDraft(target: string, owner = captureAccountContext()) {
  assertAccountContext(owner);
  if (!owner.userId) return '';
  const db = await database();
  assertOwner(owner);
  const row = await db.getFirstAsync<{ body: string }>(
    'SELECT body FROM inbox_drafts_scoped WHERE owner_id=? AND owner_scope=? AND target=?',
    owner.userId,
    owner.scope,
    target,
  );
  assertOwner(owner);
  return row?.body || '';
}
/** Stored on the existing keyed SQLCipher connection; never part of a URL or sync queue. */
export function saveInboxDraft(target: string, text: string, owner = captureAccountContext()) {
  const next = writes
    .catch(() => undefined)
    .then(async () => {
      assertOwner(owner);
      const db = await database();
      assertOwner(owner);
      if (text)
        await db.runAsync(
          'INSERT INTO inbox_drafts_scoped(owner_id,owner_scope,target,body) VALUES(?,?,?,?) ON CONFLICT(owner_id,owner_scope,target) DO UPDATE SET body=excluded.body',
          owner.userId!,
          owner.scope,
          target,
          text,
        );
      else await db.runAsync('DELETE FROM inbox_drafts_scoped WHERE owner_id=? AND owner_scope=? AND target=?', owner.userId!, owner.scope, target);
      assertOwner(owner);
    });
  writes = next;
  return next;
}

/** Move only when the destination is empty or identical; preserve both drafts on conflict. */
export function moveInboxDraft(source: string, target: string, owner = captureAccountContext()) {
  const next = writes
    .catch(() => undefined)
    .then(async () => {
      assertOwner(owner);
      const db = await database();
      assertOwner(owner);
      const from = await db.getFirstAsync<{ body: string }>(
        'SELECT body FROM inbox_drafts_scoped WHERE owner_id=? AND owner_scope=? AND target=?',
        owner.userId!,
        owner.scope,
        source,
      );
      assertOwner(owner);
      if (!from?.body) return 'EMPTY' as const;
      const to = await db.getFirstAsync<{ body: string }>(
        'SELECT body FROM inbox_drafts_scoped WHERE owner_id=? AND owner_scope=? AND target=?',
        owner.userId!,
        owner.scope,
        target,
      );
      assertOwner(owner);
      if (to?.body && to.body !== from.body) return 'CONFLICT' as const;
      // An async connection-wide transaction could roll back unrelated draft saves.
      // Copy first; an interruption preserves the source. Delete only after verifying that copy.
      const copied = await db.runAsync(
        `INSERT INTO inbox_drafts_scoped(owner_id,owner_scope,target,body)
         SELECT owner_id,owner_scope,?,body FROM inbox_drafts_scoped WHERE owner_id=? AND owner_scope=? AND target=? AND body=?
         ON CONFLICT(owner_id,owner_scope,target) DO UPDATE SET body=excluded.body WHERE inbox_drafts_scoped.body=excluded.body`,
        target,
        owner.userId!,
        owner.scope,
        source,
        from.body,
      );
      assertOwner(owner);
      if (!copied.changes) return 'CONFLICT' as const;
      if (source !== target) {
        await db.runAsync(
          `DELETE FROM inbox_drafts_scoped WHERE owner_id=? AND owner_scope=? AND target=? AND body=?
           AND EXISTS (SELECT 1 FROM inbox_drafts_scoped WHERE owner_id=? AND owner_scope=? AND target=? AND body=?)`,
          owner.userId!,
          owner.scope,
          source,
          from.body,
          owner.userId!,
          owner.scope,
          target,
          from.body,
        );
      }
      assertOwner(owner);
      return 'MOVED' as const;
    });
  writes = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Metadata-only warning for messages created before firm/role scoping existed. */
export async function hasLegacyInboxDraft(target: string, owner = captureAccountContext()) {
  assertAccountContext(owner);
  if (!owner.userId) return false;
  const db = await database();
  assertOwner(owner);
  const exists = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='inbox_drafts'");
  const row = exists
    ? await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM inbox_drafts WHERE owner_id=? AND target=?', owner.userId, target)
    : null;
  assertOwner(owner);
  return !!row?.count;
}
