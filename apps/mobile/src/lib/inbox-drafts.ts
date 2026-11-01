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
