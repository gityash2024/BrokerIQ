/** Exercises real SQLite statements; SQLCipher/device encryption stays a native acceptance gate. */
jest.mock('@/launch/drafts', () => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as any;
  const db = new DatabaseSync(':memory:');
  return {
    privateDraftDatabase: async () => ({
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, ...params: any[]) => db.prepare(sql).run(...params),
      getFirstAsync: async (sql: string, ...params: any[]) => db.prepare(sql).get(...params) || null,
    }),
  };
});
jest.mock('../api', () => ({ authStore: { get: jest.fn(() => ({ user: { id: 'draft-owner-a' } })) } }));
import { authStore } from '../api';
import { readInboxDraft, saveInboxDraft } from '../inbox-drafts';
it('isolates private drafts by account even when the target ID is the same', async () => {
  await saveInboxDraft('same-conversation', 'Account A private text');
  (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'draft-owner-b' } });
  expect(await readInboxDraft('same-conversation')).toBe('');
  await saveInboxDraft('same-conversation', 'Account B private text');
  (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'draft-owner-a' } });
  expect(await readInboxDraft('same-conversation')).toBe('Account A private text');
});
it('orders rapid writes and clearing without recreating a sent draft', async () => {
  await Promise.all([saveInboxDraft('ordered', 'H'), saveInboxDraft('ordered', 'Hello'), saveInboxDraft('ordered', '')]);
  expect(await readInboxDraft('ordered')).toBe('');
  expect(await readInboxDraft('same-conversation')).toBe('Account A private text');
});
it('does not create anonymous private message drafts', async () => {
  (authStore.get as jest.Mock).mockReturnValue(null);
  await expect(saveInboxDraft('anonymous', 'private')).rejects.toThrow('Sign in');
  expect(await readInboxDraft('anonymous')).toBe('');
});
