/** Exercises real SQLite statements; SQLCipher/device encryption stays a native acceptance gate. */
jest.mock('@/launch/drafts', () => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as any;
  const db = new DatabaseSync(':memory:');
  return {
    privateDraftDatabase: async () => ({
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, ...params: any[]) => db.prepare(sql).run(...params),
      getFirstAsync: async (sql: string, ...params: any[]) => db.prepare(sql).get(...params) || null,
      withTransactionAsync: async (task: () => Promise<void>) => {
        db.exec('BEGIN');
        try {
          await task();
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      },
    }),
  };
});
import { privateDraftDatabase } from '@/launch/drafts';
import { authStore, captureAccountContext, AccountScopeChangedError } from '../api';
import { readInboxDraft, saveInboxDraft, moveInboxDraft, hasLegacyInboxDraft } from '../inbox-drafts';
import { leadInboxDraftTarget } from '@brokeriq/shared';
const login = (id = 'draft-owner-a', firm = 'firm-a', role = 'BROKER_ADMIN') =>
  authStore.set({ accessToken: 'test', refreshToken: 'test', user: { id, role, organization: { id: firm } } } as any);
beforeEach(async () => {
  await login();
});
it('keeps channel drafts separate and never replaces a different conversation draft', async () => {
  await login('channel-owner');
  const wa = leadInboxDraftTarget('same-lead'),
    sms = leadInboxDraftTarget('same-lead', 'SMS'),
    email = leadInboxDraftTarget('same-lead', 'EMAIL');
  await Promise.all([
    saveInboxDraft(wa, 'WhatsApp draft'),
    saveInboxDraft(sms, 'SMS draft'),
    saveInboxDraft(email, 'Email draft'),
    saveInboxDraft('email-thread', 'Existing reply'),
  ]);
  expect(await moveInboxDraft(email, 'email-thread')).toBe('CONFLICT');
  expect(await readInboxDraft(email)).toBe('Email draft');
  expect(await readInboxDraft('email-thread')).toBe('Existing reply');
  expect(await moveInboxDraft(sms, 'sms-thread')).toBe('MOVED');
  expect(await readInboxDraft('sms-thread')).toBe('SMS draft');
  expect(await readInboxDraft(sms)).toBe('');
  expect(await readInboxDraft(wa)).toBe('WhatsApp draft');
});
it('rejects old read, write and move callbacks after an account change', async () => {
  const previous = captureAccountContext();
  await saveInboxDraft('pending-private', 'Private draft', previous);
  await login('different-owner');
  await expect(moveInboxDraft('pending-private', 'resolved-thread', previous)).rejects.toBeInstanceOf(AccountScopeChangedError);
  await expect(readInboxDraft('pending-private', previous)).rejects.toBeInstanceOf(AccountScopeChangedError);
  await expect(saveInboxDraft('pending-private', 'Overwrite', previous)).rejects.toBeInstanceOf(AccountScopeChangedError);
  await login();
  expect(await readInboxDraft('pending-private')).toBe('Private draft');
  expect(await readInboxDraft('resolved-thread')).toBe('');
});
it('separates the same account by firm and role without losing its original draft', async () => {
  await saveInboxDraft('same-conversation', 'Admin firm A');
  const old = captureAccountContext();
  await login('draft-owner-a', 'firm-b');
  expect(await readInboxDraft('same-conversation')).toBe('');
  await saveInboxDraft('same-conversation', 'Admin firm B');
  await login('draft-owner-a', 'firm-a', 'BROKER_AGENT');
  expect(await readInboxDraft('same-conversation')).toBe('');
  await saveInboxDraft('same-conversation', 'Agent firm A');
  await login();
  await expect(saveInboxDraft('same-conversation', 'stale A to B to A', old)).rejects.toBeInstanceOf(AccountScopeChangedError);
  expect(await readInboxDraft('same-conversation')).toBe('Admin firm A');
  await login('draft-owner-a', 'firm-b');
  expect(await readInboxDraft('same-conversation')).toBe('Admin firm B');
});
it('orders rapid writes and clearing without recreating a sent draft', async () => {
  await Promise.all([saveInboxDraft('ordered', 'H'), saveInboxDraft('ordered', 'Hello'), saveInboxDraft('ordered', '')]);
  expect(await readInboxDraft('ordered')).toBe('');
});
it('does not create anonymous private message drafts', async () => {
  await authStore.set(null);
  await expect(saveInboxDraft('anonymous', 'private')).rejects.toThrow('Sign in');
  expect(await readInboxDraft('anonymous')).toBe('');
});
it('preserves legacy message bodies without inferring a current firm', async () => {
  const db = await privateDraftDatabase();
  await db.execAsync('CREATE TABLE inbox_drafts (owner_id TEXT NOT NULL,target TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(owner_id,target))');
  await db.runAsync('INSERT INTO inbox_drafts VALUES(?,?,?)', 'draft-owner-a', 'legacy-thread', 'Original legacy message');
  expect(await hasLegacyInboxDraft('legacy-thread')).toBe(true);
  expect(await readInboxDraft('legacy-thread')).toBe('');
  await saveInboxDraft('legacy-thread', 'New scoped message');
  expect(await db.getFirstAsync('SELECT body FROM inbox_drafts WHERE owner_id=?', 'draft-owner-a')).toEqual({ body: 'Original legacy message' });
});

it('preserves the source when membership changes after copying and avoids connection-wide rollback', async () => {
  await login('interrupted-move-owner');
  await saveInboxDraft('source', 'Recoverable private message');
  const store = require('@/launch/drafts');
  const real = await privateDraftDatabase();
  const spy = jest.spyOn(store, 'privateDraftDatabase').mockResolvedValueOnce({
    ...real,
    runAsync: async (sql: string, ...params: any[]) => {
      const result = await real.runAsync(sql, ...params);
      if (sql.startsWith('INSERT INTO inbox_drafts_scoped')) await login('interrupted-move-owner', 'firm-b');
      return result;
    },
    withTransactionAsync: async () => {
      throw new Error('Connection-wide transaction would affect unrelated draft writes');
    },
  });
  try {
    await expect(moveInboxDraft('source', 'destination')).rejects.toBeInstanceOf(AccountScopeChangedError);
  } finally {
    spy.mockRestore();
  }
  await login('interrupted-move-owner');
  expect(await readInboxDraft('source')).toBe('Recoverable private message');
  expect(await readInboxDraft('destination')).toBe('Recoverable private message');
  expect(await moveInboxDraft('source', 'destination')).toBe('MOVED');
  expect(await readInboxDraft('source')).toBe('');
  expect(await moveInboxDraft('destination', 'destination')).toBe('MOVED');
  expect(await readInboxDraft('destination')).toBe('Recoverable private message');
});
