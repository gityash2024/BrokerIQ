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
jest.mock('../api', () => ({ authStore: { get: jest.fn(() => ({ user: { id: 'draft-owner-a' } })) } }));
import { authStore } from '../api';
import { readInboxDraft, saveInboxDraft, moveInboxDraft } from '../inbox-drafts';
import { leadInboxDraftTarget } from '@brokeriq/shared';
beforeEach(() => (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'draft-owner-a' } }));
it('keeps channel drafts separate and never replaces a different conversation draft', async () => {
  (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'channel-owner' } });
  const wa = leadInboxDraftTarget('same-lead'),
    sms = leadInboxDraftTarget('same-lead', 'SMS'),
    email = leadInboxDraftTarget('same-lead', 'EMAIL');
  await Promise.all([
    saveInboxDraft(wa, 'WhatsApp draft'),
    saveInboxDraft(sms, 'SMS draft'),
    saveInboxDraft(email, 'Email draft'),
    saveInboxDraft('email-thread', 'Existing reply'),
  ]);
  expect(await moveInboxDraft(email, 'email-thread', 'channel-owner')).toBe('CONFLICT');
  expect(await readInboxDraft(email)).toBe('Email draft');
  expect(await readInboxDraft('email-thread')).toBe('Existing reply');
  expect(await moveInboxDraft(sms, 'sms-thread', 'channel-owner')).toBe('MOVED');
  expect(await readInboxDraft('sms-thread')).toBe('SMS draft');
  expect(await readInboxDraft(sms)).toBe('');
  expect(await readInboxDraft(wa)).toBe('WhatsApp draft');
});
it('does not transfer a private draft after an account change', async () => {
  await saveInboxDraft('pending-private', 'Private draft', 'previous-owner');
  (authStore.get as jest.Mock).mockReturnValue({ user: { id: 'different-owner' } });
  expect(await moveInboxDraft('pending-private', 'resolved-thread', 'previous-owner')).toBe('CANCELLED');
  expect(await readInboxDraft('pending-private', 'previous-owner')).toBe('Private draft');
  expect(await readInboxDraft('resolved-thread', 'previous-owner')).toBe('');
});
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
