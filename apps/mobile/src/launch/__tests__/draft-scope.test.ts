/** Actual SQLite schema upgrade and statements; no claim about handset SQLCipher encryption. */
jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as any;
  const raw = new DatabaseSync(':memory:');
  raw.exec(
    `CREATE TABLE local_mutations (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT NOT NULL,draft_key TEXT NOT NULL,payload TEXT NOT NULL,file_uri TEXT,mime TEXT,state TEXT NOT NULL DEFAULT 'DRAFT',server_id TEXT,error TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL)`,
  );
  raw
    .prepare('INSERT INTO local_mutations(id,owner_id,kind,draft_key,payload,state,updated_at) VALUES(?,?,?,?,?,?,?)')
    .run('legacy', 'legacy-owner', 'CAPTURE', 'legacy-key', '{"rawText":"Original private evidence"}', 'QUEUED', 1);
  const adapter = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).run(...params),
    getFirstAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).get(...params) || null,
    getAllAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).all(...params),
  };
  return { defaultDatabaseDirectory: '/private-test', openDatabaseAsync: async () => adapter };
});
jest.mock('expo-file-system', () => ({
  File: class {
    exists: boolean;
    size = 16;
    constructor(uri: string) {
      this.exists = !uri.endsWith('brokeriq-drafts.db');
    }
    open() {
      return { offset: 0, readBytes: (length: number) => new Uint8Array(length).fill(65), close: () => undefined };
    }
  },
  Directory: class {},
  Paths: { document: '/private-test' },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => process.getBuiltinModule('node:crypto').randomUUID(),
  getRandomBytesAsync: async () => new Uint8Array(32).fill(1),
}));
import { authStore, captureAccountContext, AccountScopeChangedError } from '@/lib/api';
import {
  privateDraftDatabase,
  saveDraft,
  queueDraft,
  getLocalDraft,
  editableDraft,
  decodeDraft,
  syncDrafts,
  localDrafts,
  preservedDraftCounts,
  claimGuestCaptures,
  captureText,
} from '../drafts';
const login = (id = 'scoped-owner', firm = 'firm-a', role = 'BROKER_ADMIN') =>
  authStore.set({ accessToken: 'test', refreshToken: 'test', user: { id, role, organization: { id: firm } } } as any);
beforeEach(async () => {
  await login();
});
it('adds scope without changing any legacy payload, identity or queued state', async () => {
  await login('legacy-owner');
  const database = await privateDraftDatabase();
  expect(await database.getFirstAsync('SELECT id,owner_id,payload,state,owner_scope FROM local_mutations WHERE id=?', 'legacy')).toEqual({
    id: 'legacy',
    owner_id: 'legacy-owner',
    payload: '{"rawText":"Original private evidence"}',
    state: 'QUEUED',
    owner_scope: null,
  });
  expect(await getLocalDraft('legacy')).toBeNull();
  expect((await preservedDraftCounts()).legacy).toBe(1);
  const request = jest.spyOn(globalThis, 'fetch');
  await syncDrafts();
  expect(request).not.toHaveBeenCalled();
  request.mockRestore();
  await expect(saveDraft('CAPTURE', 'legacy-key', { rawText: 'Overwrite' }, 'legacy')).rejects.toThrow('preserved');
});
it('keeps same-user firm and role drafts separate and restores only the matching workspace', async () => {
  const id = await saveDraft('PROPERTY_CREATE', 'new-property', { address: 'Private A' });
  const old = captureAccountContext();
  await login('scoped-owner', 'firm-b');
  expect(await getLocalDraft(id)).toBeNull();
  expect(await editableDraft('PROPERTY_CREATE', 'new-property')).toBeNull();
  await expect(queueDraft(id)).rejects.toThrow('workspace');
  await expect(saveDraft('PROPERTY_CREATE', 'new-property', { address: 'Wrong firm' }, id)).rejects.toThrow('preserved');
  await login('scoped-owner', 'firm-a', 'BROKER_AGENT');
  expect(await getLocalDraft(id)).toBeNull();
  await login();
  await expect(queueDraft(id, old)).rejects.toBeInstanceOf(AccountScopeChangedError);
  expect(decodeDraft((await getLocalDraft(id))!)).toEqual({ address: 'Private A' });
});
it('does not auto-adopt guest captures, and an explicit choice leaves legacy guest data untouched', async () => {
  const db = await privateDraftDatabase();
  await db.runAsync(
    'INSERT INTO local_mutations(id,owner_id,kind,draft_key,payload,state,updated_at) VALUES(?,?,?,?,?,?,?)',
    'legacy-guest',
    'UNASSIGNED',
    'CAPTURE',
    'x',
    '{}',
    'QUEUED',
    1,
  );
  await authStore.set(null);
  const id = await captureText('Guest source');
  await login('guest-claim-owner');
  const request = jest.spyOn(globalThis, 'fetch');
  await syncDrafts();
  expect(request).not.toHaveBeenCalled();
  request.mockRestore();
  expect(await getLocalDraft(id)).toBeNull();
  expect((await preservedDraftCounts()).guest).toBe(1);
  await claimGuestCaptures();
  expect(decodeDraft((await getLocalDraft(id))!).rawText).toBe('Guest source');
  expect(await db.getFirstAsync('SELECT owner_id,owner_scope,payload FROM local_mutations WHERE id=?', 'legacy-guest')).toEqual({
    owner_id: 'UNASSIGNED',
    owner_scope: null,
    payload: '{}',
  });
});
it('stops a running queue at a scope transition without posting its next private row', async () => {
  await login('queue-owner');
  const first = await saveDraft('REQUIREMENT_CREATE', 'first', { title: 'First private demand' });
  const second = await saveDraft('REQUIREMENT_CREATE', 'second', { title: 'Second private demand' });
  await queueDraft(first);
  await queueDraft(second);
  let release!: (response: any) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const request = jest.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
    entered();
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  try {
    const pump = syncDrafts();
    await started;
    await login('queue-owner', 'firm-b');
    release({ ok: true, status: 200, text: async () => '{"id":"saved-original"}' });
    await pump;
    expect(request).toHaveBeenCalledTimes(1);
    expect(await localDrafts()).toEqual([]);
    await login('queue-owner');
    expect((await getLocalDraft(first))?.state).toBe('QUEUED');
    expect((await getLocalDraft(second))?.state).toBe('QUEUED');
  } finally {
    request.mockRestore();
  }
});
it('paginates beyond the former 100-row cap with stable ties and no dropped drafts', async () => {
  await login('pagination-owner');
  for (let i = 0; i < 121; i++) await saveDraft('PROPERTY_CREATE', `key-${i}`, { address: `Saved ${i}` });
  const first = await localDrafts();
  const second = await localDrafts(first.at(-1));
  const third = await localDrafts(second.at(-1));
  expect([first.length, second.length, third.length]).toEqual([50, 50, 21]);
  expect(new Set([...first, ...second, ...third].map((r) => r.id)).size).toBe(121);
});

it('fences every resumable upload chunk using the original workspace', async () => {
  await login('chunk-owner');
  const id = await saveDraft('CAPTURE', 'upload', { sourceType: 'CHAT_EXPORT', fileName: 'source.txt' }, undefined, captureAccountContext(), {
    uri: '/private/source.txt',
    mime: 'text/plain',
  });
  await queueDraft(id);
  const request = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'upload-id', receivedBytes: 0, nextIndex: 0, chunkBytes: 4, batchId: null }),
    } as any)
    .mockImplementationOnce(async () => {
      await login('chunk-owner', 'firm-b');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'upload-id', receivedBytes: 4, nextIndex: 1, chunkBytes: 4, batchId: null }),
      } as any;
    });
  try {
    await syncDrafts();
    expect(request.mock.calls.map(([url]) => String(url).split('/api')[1])).toEqual(['/imports/uploads', '/imports/uploads/upload-id/chunks/0']);
    await login('chunk-owner');
    expect((await getLocalDraft(id))?.state).toBe('QUEUED');
    expect((await getLocalDraft(id))?.file_uri).toBe('/private/source.txt');
  } finally {
    request.mockRestore();
  }
});

it('does not silently replace a legacy editor with a blank form; separate work requires an explicit choice', async () => {
  await login('legacy-editor-owner');
  const db = await privateDraftDatabase();
  await db.runAsync(
    'INSERT INTO local_mutations(id,owner_id,kind,draft_key,payload,state,updated_at) VALUES(?,?,?,?,?,?,?)',
    'legacy-form',
    'legacy-editor-owner',
    'PROPERTY_CREATE',
    'new-property',
    '{"address":"Original address"}',
    'DRAFT',
    1,
  );
  await expect(editableDraft('PROPERTY_CREATE', 'new-property')).rejects.toThrow('Older draft ownership needs review');
  expect(await editableDraft('PROPERTY_CREATE', 'new-property', captureAccountContext(), true)).toBeNull();
  const fresh = await saveDraft('PROPERTY_CREATE', 'new-property', { address: 'Explicit separate work' });
  expect(fresh).not.toBe('legacy-form');
  expect(await db.getFirstAsync('SELECT payload,owner_scope,state FROM local_mutations WHERE id=?', 'legacy-form')).toEqual({
    payload: '{"address":"Original address"}',
    owner_scope: null,
    state: 'DRAFT',
  });
});
