import { authStore } from './api';
import { privateDraftDatabase } from '@/launch/drafts';
let writes = Promise.resolve();
async function database() {
  const db = await privateDraftDatabase();
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS inbox_drafts (owner_id TEXT NOT NULL, target TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(owner_id,target))',
  );
  return db;
}
export async function readInboxDraft(target: string, owner = authStore.get()?.user.id) {
  if (!owner) return '';
  const db = await database();
  const row = await db.getFirstAsync<{ body: string }>('SELECT body FROM inbox_drafts WHERE owner_id=? AND target=?', owner, target);
  return row?.body || '';
}
/** Stored on the existing keyed SQLCipher connection; never part of a URL or sync queue. */
export function saveInboxDraft(target: string, text: string, owner = authStore.get()?.user.id) {
  if (!owner) return Promise.reject(new Error('Sign in before saving a message draft'));
  const next = writes
    .catch(() => undefined)
    .then(async () => {
      const db = await database();
      if (text)
        await db.runAsync(
          'INSERT INTO inbox_drafts(owner_id,target,body) VALUES(?,?,?) ON CONFLICT(owner_id,target) DO UPDATE SET body=excluded.body',
          owner,
          target,
          text,
        );
      else await db.runAsync('DELETE FROM inbox_drafts WHERE owner_id=? AND target=?', owner, target);
    });
  writes = next;
  return next;
}

/** Move only when the destination is empty or identical; preserve both drafts on conflict. */
export function moveInboxDraft(source: string, target: string, owner: string) {
  const next = writes
    .catch(() => undefined)
    .then(async () => {
      const db = await database();
      let result: 'EMPTY' | 'MOVED' | 'CONFLICT' | 'CANCELLED' = 'EMPTY';
      await db.withTransactionAsync(async () => {
        const from = await db.getFirstAsync<{ body: string }>('SELECT body FROM inbox_drafts WHERE owner_id=? AND target=?', owner, source);
        if (!from?.body) return;
        const to = await db.getFirstAsync<{ body: string }>('SELECT body FROM inbox_drafts WHERE owner_id=? AND target=?', owner, target);
        if (authStore.get()?.user.id !== owner) {
          result = 'CANCELLED';
          return;
        }
        if (to?.body && to.body !== from.body) {
          result = 'CONFLICT';
          return;
        }
        await db.runAsync('INSERT INTO inbox_drafts(owner_id,target,body) VALUES(?,?,?) ON CONFLICT(owner_id,target) DO NOTHING', owner, target, from.body);
        await db.runAsync('DELETE FROM inbox_drafts WHERE owner_id=? AND target=?', owner, source);
        result = 'MOVED';
      });
      return result as 'EMPTY' | 'MOVED' | 'CONFLICT' | 'CANCELLED';
    });
  writes = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
