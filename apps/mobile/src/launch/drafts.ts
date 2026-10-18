import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { File, Directory, Paths } from 'expo-file-system';
import { api, ApiError, authStore } from '@/lib/api';

export type DraftKind = 'PROPERTY_CREATE' | 'PROPERTY_EDIT' | 'REQUIREMENT_CREATE' | 'CAPTURE' | 'CAPTURE_COMPOSE' | 'IMPORT_REVIEW' | 'PUBLIC_PUBLISH';
export type DraftState = 'DRAFT' | 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED';
export interface LocalDraft {
  id: string;
  owner_id: string;
  kind: DraftKind;
  draft_key: string;
  payload: string;
  file_uri: string | null;
  mime: string | null;
  state: DraftState;
  server_id: string | null;
  error: string | null;
  attempts: number;
  next_at: number;
  updated_at: number;
}
let database: Promise<SQLite.SQLiteDatabase> | null = null;
async function open() {
  let key = await SecureStore.getItemAsync('biq.drafts.key.v1');
  const filename = 'brokeriq-drafts.db';
  if (!key) {
    const directory = SQLite.defaultDatabaseDirectory;
    if (!directory) throw new Error('Private draft directory is unavailable. Existing files were preserved.');
    const uri = directory.startsWith('file:') ? directory : `file://${directory}`;
    if (new File(`${uri.replace(/\/$/, '')}/${filename}`).exists)
      throw new Error('Draft encryption key unavailable. Existing drafts were preserved; restore the key before continuing.');
    key = Array.from(await Crypto.getRandomBytesAsync(32), (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync('biq.drafts.key.v1', key);
  }
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid draft encryption key. Storage was preserved.');
  const db = await SQLite.openDatabaseAsync(filename);
  await db.execAsync(`PRAGMA key = '${key}'; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS local_mutations (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, draft_key TEXT NOT NULL,
      payload TEXT NOT NULL, file_uri TEXT, mime TEXT, state TEXT NOT NULL DEFAULT 'DRAFT',
      server_id TEXT, error TEXT, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS local_mutations_owner ON local_mutations(owner_id,state,updated_at);`);
  await db.runAsync("UPDATE local_mutations SET state='QUEUED' WHERE state='SYNCING'");
  return db;
}
const db = () =>
  (database ??= open().catch((error) => {
    database = null;
    throw error;
  }));
export const ownerId = () => authStore.get()?.user.id ?? 'UNASSIGNED';
export async function editableDraft(kind: DraftKind, key: string, owner = ownerId()) {
  const row = await (
    await db()
  ).getFirstAsync<LocalDraft>(
    "SELECT * FROM local_mutations WHERE owner_id=? AND kind=? AND draft_key=? AND state IN ('DRAFT','FAILED') ORDER BY updated_at DESC LIMIT 1",
    owner,
    kind,
    key,
  );
  if (row) decodeDraft(row); // An unreadable record must not silently become an empty editor.
  return row;
}
export function decodeDraft(row: LocalDraft): Record<string, any> {
  try {
    const value = JSON.parse(row.payload);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new Error('A saved draft could not be read. Its original data is preserved.');
  }
}
export async function saveDraft(
  kind: DraftKind,
  key: string,
  payload: Record<string, any>,
  id = Crypto.randomUUID(),
  owner = ownerId(),
  file?: { uri: string; mime: string },
) {
  if ('fileDataUrl' in payload) throw new Error('Binary files belong in private files, not draft JSON');
  const encoded = JSON.stringify(payload);
  if (encoded.length > 250_000) throw new Error('Use a text file for large imports. Your input was not discarded.');
  const database = await db();
  // A single guarded statement is atomic on the already-keyed SQLCipher connection.
  // Expo's exclusive transaction opens a second connection without its PRAGMA key.
  const result = await database.runAsync(
    `INSERT INTO local_mutations(id,owner_id,kind,draft_key,payload,file_uri,mime,state,updated_at) VALUES(?,?,?,?,?,?,?,'DRAFT',?)
     ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,file_uri=COALESCE(excluded.file_uri,file_uri),mime=COALESCE(excluded.mime,mime),state='DRAFT',error=NULL,updated_at=excluded.updated_at
     WHERE local_mutations.owner_id=excluded.owner_id AND local_mutations.kind=excluded.kind AND local_mutations.draft_key=excluded.draft_key AND local_mutations.state IN ('DRAFT','FAILED')`,
    id,
    owner,
    kind,
    key,
    encoded,
    file?.uri ?? null,
    file?.mime ?? null,
    Date.now(),
  );
  if (!result.changes) throw new Error('This saved operation is already queued or belongs to another editor. Its data was preserved.');
  return id;
}
export async function queueDraft(id: string) {
  const result = await (
    await db()
  ).runAsync(
    "UPDATE local_mutations SET state='QUEUED',error=NULL,next_at=0,updated_at=? WHERE id=? AND owner_id=? AND state IN ('DRAFT','FAILED')",
    Date.now(),
    id,
    ownerId(),
  );
  if (!result.changes) throw new Error('Draft could not be queued');
}
export async function localDrafts() {
  return (await db()).getAllAsync<Pick<LocalDraft, 'id' | 'kind' | 'state' | 'server_id' | 'error' | 'updated_at'>>(
    'SELECT id,kind,state,server_id,error,updated_at FROM local_mutations WHERE owner_id=? ORDER BY updated_at DESC LIMIT 100',
    ownerId(),
  );
}
export async function captureText(text: string, sourceType = 'TEXT', groupName?: string, target = 'AUTO', owner = ownerId()) {
  const id = Crypto.randomUUID();
  if (text.length > 100_000) {
    const directory = new Directory(Paths.document, 'captures');
    directory.create({ idempotent: true, intermediates: true });
    const file = new File(directory, `${id}-message.txt`);
    file.write(text);
    return captureFile(file.uri, 'text/plain', 'message.txt', groupName, target, owner);
  }
  const saved = await saveDraft('CAPTURE', id, { sourceType, rawText: text, groupName, target }, id, owner);
  await (await db()).runAsync("UPDATE local_mutations SET state='QUEUED' WHERE id=?", saved);
  return saved;
}
export async function captureFile(uri: string, mime: string, name?: string, groupName?: string, target = 'AUTO', owner = ownerId()) {
  const id = Crypto.randomUUID();
  const directory = new Directory(Paths.document, 'captures');
  directory.create({ idempotent: true, intermediates: true });
  const safe = (name || 'source').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const destination = new File(directory, `${id}-${safe}`);
  // SDK 57 copy() is asynchronous, including Android content:// providers.
  // Do not acknowledge the share or queue a file before its private copy exists.
  await new File(uri).copy(destination);
  if (!destination.exists || destination.size === 0) throw new Error('Source copy failed. Shared content was not cleared.');
  const saved = await saveDraft(
    'CAPTURE',
    id,
    { sourceType: mime.startsWith('image/') ? 'IMAGE' : 'CHAT_EXPORT', fileName: name ?? safe, groupName, target },
    id,
    owner,
    {
      uri: destination.uri,
      mime,
    },
  );
  await (await db()).runAsync("UPDATE local_mutations SET state='QUEUED' WHERE id=?", saved);
  return saved;
}
let syncing = false;
export async function syncDrafts() {
  const session = authStore.get();
  if (!session || session.user.role !== 'BROKER_ADMIN' || syncing) return;
  syncing = true;
  try {
    const database = await db();
    await database.runAsync("UPDATE local_mutations SET owner_id=? WHERE owner_id='UNASSIGNED' AND kind='CAPTURE'", session.user.id);
    const rows = await database.getAllAsync<LocalDraft>(
      "SELECT * FROM local_mutations WHERE owner_id=? AND state='QUEUED' AND next_at<=? ORDER BY updated_at ASC LIMIT 10",
      session.user.id,
      Date.now(),
    );
    for (const row of rows) {
      if (authStore.get()?.user.id !== session.user.id) break;
      await database.runAsync("UPDATE local_mutations SET state='SYNCING',updated_at=? WHERE id=? AND owner_id=?", Date.now(), row.id, session.user.id);
      try {
        let body = decodeDraft(row);
        let path = '';
        let method = 'POST';
        if (row.kind === 'CAPTURE') {
          path = '/imports';
          if (row.file_uri) {
            const source = new File(row.file_uri);
            if (!source.exists) throw new Error('Saved source file is missing. The draft record was preserved.');
            if (source.size > 12 * 1024 * 1024) throw new Error('Source exceeds 12MB. Keep it and use the controlled register import.');
            body = { ...body, fileDataUrl: `data:${row.mime};base64,${await source.base64()}` };
          }
        } else if (row.kind === 'PROPERTY_CREATE') {
          path = '/inventory';
          body = { ...body, clientMutationId: row.id };
        } else if (row.kind === 'PROPERTY_EDIT') {
          path = `/inventory/${body.id}`;
          method = 'PATCH';
          const { id: _id, ...rest } = body;
          body = rest;
        } else if (row.kind === 'PUBLIC_PUBLISH') {
          path = `/inventory/${body.inventoryId}/publish`;
          const { inventoryId: _inventoryId, ...rest } = body;
          body = rest;
        } else if (row.kind === 'IMPORT_REVIEW') {
          path = `/imports/entries/${body.entryId}`;
          method = 'PATCH';
          const { entryId: _entryId, batchId: _batchId, ...rest } = body;
          body = rest;
        } else if (row.kind === 'REQUIREMENT_CREATE') {
          path = '/broker-requirements';
          body = { ...body, clientMutationId: row.id };
        } else {
          throw new Error('This local draft must be opened and reviewed before sync. Its data was preserved.');
        }
        const result = await api<any>(path, { method, body, ownerId: session.user.id });
        await database.runAsync(
          "UPDATE local_mutations SET state='SYNCED',server_id=?,error=NULL,updated_at=? WHERE id=? AND owner_id=?",
          result.id ?? body.id ?? null,
          Date.now(),
          row.id,
          session.user.id,
        );
      } catch (error) {
        const retry = error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500);
        const attempts = row.attempts + 1;
        const delay = Math.min(15 * 60_000, 15_000 * 2 ** Math.min(attempts, 6));
        await database.runAsync(
          'UPDATE local_mutations SET state=?,error=?,attempts=?,next_at=?,updated_at=? WHERE id=? AND owner_id=?',
          retry ? 'QUEUED' : 'FAILED',
          (error as Error).message.slice(0, 500),
          attempts,
          Date.now() + delay,
          Date.now(),
          row.id,
          session.user.id,
        );
      }
    }
  } finally {
    syncing = false;
  }
}

export async function getLocalDraft(id: string) {
  return (await db()).getFirstAsync<LocalDraft>('SELECT * FROM local_mutations WHERE id=? AND owner_id=?', id, ownerId());
}

/** Mark a successfully approved review without discarding its local evidence. */
export async function completeReviewDraft(id: string, entryId: string) {
  await (
    await db()
  ).runAsync(
    "UPDATE local_mutations SET state='SYNCED',server_id=?,error=NULL,updated_at=? WHERE id=? AND owner_id=? AND kind='IMPORT_REVIEW' AND state IN ('DRAFT','FAILED')",
    entryId,
    Date.now(),
    id,
    ownerId(),
  );
}

// Cache only public, last-known launch policy; server authorization still decides sync.
export async function readLaunchConfig() {
  const row = await (await db()).getFirstAsync<{ value: string }>('SELECT value FROM local_settings WHERE key=?', 'public-config');
  if (!row) return null;
  const value = JSON.parse(row.value);
  if (!value?.app || !value?.modules || typeof value.modules !== 'object') throw new Error('Saved launch configuration could not be read. It was preserved.');
  return value;
}
export async function saveLaunchConfig(value: unknown) {
  await (
    await db()
  ).runAsync('INSERT INTO local_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', 'public-config', JSON.stringify(value));
}
