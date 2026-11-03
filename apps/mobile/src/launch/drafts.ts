import { IMPORT_MAX_BYTES, bytesToBase64, uploadImport, prepareInventoryEditorInput, captureContentType, followUpInputSchema, visitInputSchema } from '@brokeriq/shared';
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { scheduleReminder } from '@/lib/local-reminders';
import { File, Directory, Paths } from 'expo-file-system';
import { api, ApiError, authStore, captureAccountContext, assertAccountContext, AccountScopeChangedError, type AccountContext } from '@/lib/api';

export type TaskDraftKind = 'FOLLOW_UP_CREATE' | 'SITE_VISIT_CREATE';
export type DraftKind =
  'PROPERTY_CREATE' | 'PROPERTY_EDIT' | 'REQUIREMENT_CREATE' | 'REQUIREMENT_EDIT' | 'CAPTURE' | 'CAPTURE_COMPOSE' | 'IMPORT_REVIEW' | 'PUBLIC_PUBLISH' | TaskDraftKind;
export type DraftState = 'DRAFT' | 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED';
export interface LocalDraft {
  id: string;
  owner_id: string;
  owner_scope: string | null;
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
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(local_mutations)');
  if (!columns.some((column) => column.name === 'owner_scope')) await db.execAsync('ALTER TABLE local_mutations ADD COLUMN owner_scope TEXT');
  await db.execAsync('CREATE INDEX IF NOT EXISTS local_mutations_scope ON local_mutations(owner_id,owner_scope,state,updated_at,id)');
  await db.runAsync("UPDATE local_mutations SET state='QUEUED' WHERE state='SYNCING'");
  return db;
}
const db = () =>
  (database ??= open().catch((error) => {
    database = null;
    throw error;
  }));
const draftOwnerId = (context: AccountContext) => context.userId ?? 'UNASSIGNED';
const contextNow = captureAccountContext;
function assertDraftScope(row: LocalDraft, context = contextNow()) {
  assertAccountContext(context);
  if (row.owner_id !== draftOwnerId(context) || row.owner_scope !== context.scope)
    throw new AccountScopeChangedError('This draft has no verified ownership in this workspace. Its original data is preserved.');
}
export const LEGACY_DRAFT_REVIEW = 'Older draft ownership needs review. Its original is preserved; start a separate draft or contact support.';
export async function editableDraft(kind: DraftKind, key: string, owner = contextNow(), startSeparate = false) {
  assertAccountContext(owner);
  const database = await db();
  assertAccountContext(owner);
  const row = await database.getFirstAsync<LocalDraft>(
    "SELECT * FROM local_mutations WHERE owner_id=? AND owner_scope=? AND kind=? AND draft_key=? AND state IN ('DRAFT','FAILED') ORDER BY updated_at DESC,id DESC LIMIT 1",
    draftOwnerId(owner),
    owner.scope,
    kind,
    key,
  );
  if (!row && !startSeparate) {
    const legacy = await database.getFirstAsync<{ id: string }>(
      "SELECT id FROM local_mutations WHERE owner_id=? AND owner_scope IS NULL AND kind=? AND draft_key=? AND state IN ('DRAFT','FAILED','QUEUED','SYNCING') LIMIT 1",
      draftOwnerId(owner),
      kind,
      key,
    );
    assertAccountContext(owner);
    if (legacy) throw new Error(LEGACY_DRAFT_REVIEW);
  }
  assertAccountContext(owner);
  if (row) decodeDraft(row, owner); // An unreadable record must not silently become an empty editor.
  return row;
}
export function decodeDraft(row: LocalDraft, owner = contextNow()): Record<string, any> {
  assertDraftScope(row, owner);
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
  owner = contextNow(),
  file?: { uri: string; mime: string },
) {
  assertAccountContext(owner);
  if ('fileDataUrl' in payload) throw new Error('Binary files belong in private files, not draft JSON');
  const encoded = JSON.stringify(payload);
  if (encoded.length > 250_000) throw new Error('Use a text file for large imports. Your input was not discarded.');
  const database = await db();
  assertAccountContext(owner);
  // A single guarded statement is atomic on the already-keyed SQLCipher connection.
  // Expo's exclusive transaction opens a second connection without its PRAGMA key.
  const result = await database.runAsync(
    `INSERT INTO local_mutations(id,owner_id,owner_scope,kind,draft_key,payload,file_uri,mime,state,updated_at) VALUES(?,?,?,?,?,?,?,?,'DRAFT',?)
     ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,file_uri=COALESCE(excluded.file_uri,file_uri),mime=COALESCE(excluded.mime,mime),state='DRAFT',error=NULL,updated_at=excluded.updated_at
     WHERE local_mutations.owner_id=excluded.owner_id AND local_mutations.owner_scope=excluded.owner_scope AND local_mutations.kind=excluded.kind AND local_mutations.draft_key=excluded.draft_key AND local_mutations.state IN ('DRAFT','FAILED')`,
    id,
    draftOwnerId(owner),
    owner.scope,
    kind,
    key,
    encoded,
    file?.uri ?? null,
    file?.mime ?? null,
    Date.now(),
  );
  assertAccountContext(owner);
  if (!result.changes) throw new Error('This saved operation is already queued or belongs to another editor. Its data was preserved.');
  return id;
}
export async function queueDraft(id: string, owner = contextNow()) {
  assertAccountContext(owner);
  const database = await db();
  assertAccountContext(owner);
  const result = await database.runAsync(
    `UPDATE local_mutations SET state='QUEUED',error=NULL,next_at=0,updated_at=?
     WHERE id=? AND owner_id=? AND owner_scope=? AND state IN ('DRAFT','FAILED')
     AND (kind NOT IN ('FOLLOW_UP_CREATE','SITE_VISIT_CREATE') OR NOT EXISTS (
       SELECT 1 FROM local_mutations active WHERE active.id <> local_mutations.id
       AND active.owner_id=local_mutations.owner_id AND active.owner_scope=local_mutations.owner_scope
       AND active.kind=local_mutations.kind AND active.draft_key=local_mutations.draft_key
       AND active.state IN ('QUEUED','SYNCING','FAILED')
     ))`,
    Date.now(),
    id,
    draftOwnerId(owner),
    owner.scope,
  );
  assertAccountContext(owner);
  if (!result.changes) throw new Error('Draft could not be queued in this workspace. Its original is preserved.');
}
export async function holdFailedTask(id: string, owner = contextNow()) {
  assertAccountContext(owner);
  const database = await db();
  assertAccountContext(owner);
  const result = await database.runAsync(
    `UPDATE local_mutations SET state='DRAFT',updated_at=?
     WHERE id=? AND owner_id=? AND owner_scope=? AND state='FAILED' AND kind IN ('FOLLOW_UP_CREATE','SITE_VISIT_CREATE')`,
    Date.now(), id, draftOwnerId(owner), owner.scope,
  );
  assertAccountContext(owner);
  if (!result.changes) throw new Error('Task could not be set aside. Refresh Saved drafts.');
}

export async function localDrafts(before?: { updated_at: number; id: string }) {
  const owner = contextNow();
  const database = await db();
  assertAccountContext(owner);
  const rows = await database.getAllAsync<Pick<LocalDraft, 'id' | 'kind' | 'draft_key' | 'state' | 'server_id' | 'error' | 'updated_at'>>(
    `SELECT id,kind,draft_key,state,server_id,error,updated_at FROM local_mutations WHERE owner_id=? AND owner_scope=?
     ${before ? 'AND (updated_at < ? OR (updated_at = ? AND id < ?))' : ''} ORDER BY updated_at DESC,id DESC LIMIT 50`,
    draftOwnerId(owner),
    owner.scope,
    ...(before ? [before.updated_at, before.updated_at, before.id] : []),
  );
  assertAccountContext(owner);
  return rows;
}
/** Metadata only: never expose old private payloads under a newly assigned role or firm. */
export async function preservedDraftCounts() {
  const owner = contextNow();
  const database = await db();
  assertAccountContext(owner);
  const legacy = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM local_mutations WHERE owner_id IN (?,'UNASSIGNED') AND owner_scope IS NULL",
    draftOwnerId(owner),
  );
  const guest = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM local_mutations WHERE owner_id='UNASSIGNED' AND owner_scope='UNASSIGNED' AND kind='CAPTURE' AND state IN ('DRAFT','QUEUED','FAILED')",
  );
  const hasInbox = await database.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='inbox_drafts'");
  const inbox =
    hasInbox && owner.userId
      ? await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM inbox_drafts WHERE owner_id=?', owner.userId)
      : null;
  assertAccountContext(owner);
  return { legacy: (legacy?.count ?? 0) + (inbox?.count ?? 0), guest: owner.userId ? (guest?.count ?? 0) : 0 };
}
/** Explicit workspace choice for NEW guest shares. Legacy unscoped rows are never guessed. */
export async function claimGuestCaptures(owner = contextNow()) {
  assertAccountContext(owner);
  if (!owner.userId || !['BROKER_ADMIN', 'BROKER_AGENT'].includes(authStore.get()!.user.role)) throw new Error('Open a broker workspace first.');
  const database = await db();
  assertAccountContext(owner);
  await database.runAsync(
    "UPDATE local_mutations SET owner_id=?,owner_scope=? WHERE owner_id='UNASSIGNED' AND owner_scope='UNASSIGNED' AND kind='CAPTURE' AND state IN ('DRAFT','QUEUED','FAILED')",
    owner.userId,
    owner.scope,
  );
  assertAccountContext(owner);
}
export async function captureText(text: string, sourceType = 'TEXT', groupName?: string, target = 'AUTO', owner = contextNow()) {
  const id = Crypto.randomUUID();
  if (text.length > 100_000) {
    const directory = new Directory(Paths.document, 'captures');
    directory.create({ idempotent: true, intermediates: true });
    const file = new File(directory, `${id}-message.txt`);
    file.write(text);
    return captureFile(file.uri, 'text/plain', 'message.txt', groupName, target, owner);
  }
  const saved = await saveDraft('CAPTURE', id, { sourceType, rawText: text, groupName, target }, id, owner);
  await queueDraft(saved, owner);
  return saved;
}
export async function captureFile(uri: string, mime: string, name?: string, groupName?: string, target = 'AUTO', owner = contextNow()) {
  assertAccountContext(owner);
  const id = Crypto.randomUUID();
  const directory = new Directory(Paths.document, 'captures');
  directory.create({ idempotent: true, intermediates: true });
  const safe = (name || 'source').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const destination = new File(directory, `${id}-${safe}`);
  // SDK 57 copy() is asynchronous, including Android content:// providers.
  // Do not acknowledge the share or queue a file before its private copy exists.
  await new File(uri).copy(destination);
  if (!destination.exists || destination.size === 0) throw new Error('Source copy failed. Shared content was not cleared.');
  if (destination.size > IMPORT_MAX_BYTES) throw new Error('Maximum 300 MB per source. The private original is preserved.');
  const signatureHandle = destination.open();
  try {
    const normalized = captureContentType(name ?? safe, mime, signatureHandle.readBytes(Math.min(12, destination.size)));
    if (!normalized) throw new Error('Unsupported source. Use a WhatsApp ZIP/TXT export or JPG, PNG or WebP image. The original is preserved.');
    mime = normalized;
  } finally {
    signatureHandle.close();
  }
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
  await queueDraft(saved, owner);
  return saved;
}
/** Save a submitted task and its idempotency key together before the first request. */
export async function submitTask(kind: TaskDraftKind, input: unknown, owner = contextNow()) {
  assertAccountContext(owner);
  if (!owner.userId) throw new Error('Sign in before scheduling a task.');
  const schema = kind === 'FOLLOW_UP_CREATE' ? followUpInputSchema : visitInputSchema;
  const { clientMutationId: _providedId, ...body } = schema.parse(input);
  const payload = JSON.stringify(body);
  const id = Crypto.randomUUID();
  const database = await db();
  assertAccountContext(owner);

  // This single SQLite statement serializes duplicate taps against the active task slot.
  const inserted = await database.runAsync(
    `INSERT INTO local_mutations(id,owner_id,owner_scope,kind,draft_key,payload,state,updated_at)
     SELECT ?,?,?,?,?,?,'QUEUED',?
     WHERE NOT EXISTS (
       SELECT 1 FROM local_mutations WHERE owner_id=? AND owner_scope=? AND kind=? AND draft_key=?
       AND state IN ('QUEUED','SYNCING','FAILED')
     )`,
    id, owner.userId, owner.scope, kind, body.leadId, payload, Date.now(),
    owner.userId, owner.scope, kind, body.leadId,
  );
  assertAccountContext(owner);
  let savedId = id;
  if (!inserted.changes) {
    const existing = await database.getFirstAsync<LocalDraft>(
      "SELECT * FROM local_mutations WHERE owner_id=? AND owner_scope=? AND kind=? AND draft_key=? AND state IN ('QUEUED','SYNCING','FAILED') LIMIT 1",
      owner.userId, owner.scope, kind, body.leadId,
    );
    assertAccountContext(owner);
    if (!existing || existing.payload !== payload || existing.state === 'FAILED') {
      throw new Error('A previous task submission is saved on this device. Check Saved drafts before scheduling again.');
    }
    savedId = existing.id;
  }
  await syncDrafts();
  const saved = await getLocalDraft(savedId, owner);
  if (!saved) throw new Error('Saved task could not be read. Check Saved drafts before retrying.');
  return saved;
}

const syncing = new Set<string>();
export async function syncDrafts() {
  const session = authStore.get();
  const owner = contextNow();
  if (!session || !['BROKER_ADMIN', 'BROKER_AGENT'].includes(session.user.role) || syncing.has(owner.scope)) return;
  syncing.add(owner.scope);
  const completedTaskLeads = new Set<string>();
  try {
    const database = await db();
    assertAccountContext(owner);
    while (true) {
      assertAccountContext(owner);
      const rows = await database.getAllAsync<LocalDraft>(
        "SELECT * FROM local_mutations WHERE owner_id=? AND owner_scope=? AND state='QUEUED' AND next_at<=? ORDER BY updated_at ASC LIMIT 10",
        session.user.id,
        owner.scope,
        Date.now(),
      );
      if (!rows.length) break;
      for (const row of rows) {
        assertAccountContext(owner);
        const claimed = await database.runAsync(
          "UPDATE local_mutations SET state='SYNCING',updated_at=? WHERE id=? AND owner_id=? AND owner_scope=? AND state='QUEUED'",
          Date.now(),
          row.id,
          session.user.id,
          owner.scope,
        );
        if (!claimed.changes) continue;
        try {
          let body = decodeDraft(row, owner);
          let path = '';
          let method = 'POST';
          let uploaded: { id: string } | undefined;
          if (row.kind === 'CAPTURE') {
            path = '/imports';
            if (row.file_uri) {
              const source = new File(row.file_uri);
              if (!source.exists) throw new Error('Saved source file is missing. The draft record was preserved.');
              if (source.size > IMPORT_MAX_BYTES) throw new Error('Source exceeds 300 MB. Its private original is preserved. Split it into smaller exports.');
              const handle = source.open();
              try {
                const contentType = captureContentType(body.fileName ?? '', row.mime ?? '', handle.readBytes(Math.min(12, source.size)));
                if (!contentType) throw new Error('Unsupported saved source type. Its original is preserved.');
                uploaded = await uploadImport(
                  (uploadPath, uploadBody) => api(uploadPath, { body: uploadBody, ownerContext: owner }),
                  {
                    clientKey: row.id,
                    fileName: body.fileName ?? 'source',
                    contentType,
                    totalBytes: source.size,
                    sourceType: contentType.startsWith('image/') ? 'IMAGE' : 'CHAT_EXPORT',
                    groupName: body.groupName,
                    target: body.target,
                  },
                  async (offset, length) => {
                    handle.offset = offset;
                    return bytesToBase64(handle.readBytes(length));
                  },
                );
              } finally {
                handle.close();
              }
            }
          } else if (row.kind === 'FOLLOW_UP_CREATE' || row.kind === 'SITE_VISIT_CREATE') {
            path = row.kind === 'FOLLOW_UP_CREATE' ? '/follow-ups' : '/visits';
            body = { ...body, clientMutationId: row.id };
          } else if (row.kind === 'PROPERTY_CREATE') {
            path = '/inventory';
            body = { ...prepareInventoryEditorInput(body), clientMutationId: row.id };
          } else if (row.kind === 'PROPERTY_EDIT') {
            path = `/inventory/${body.id}`;
            method = 'PATCH';
            const { id: _id, ...rest } = body;
            body = prepareInventoryEditorInput(rest);
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
          } else if (row.kind === 'REQUIREMENT_EDIT') {
            path = `/broker-requirements/${body.id}`;
            method = 'PATCH';
            const { id: _id, ...rest } = body;
            body = rest;
          } else {
            throw new Error('This local draft must be opened and reviewed before sync. Its data was preserved.');
          }
          const result = uploaded ?? (await api<any>(path, { method, body, ownerContext: owner }));
          await database.runAsync(
            "UPDATE local_mutations SET state='SYNCED',server_id=?,error=NULL,updated_at=? WHERE id=? AND owner_id=? AND owner_scope=?",
            result.id ?? body.id ?? null,
            Date.now(),
            row.id,
            session.user.id,
            owner.scope,
          );
          if (captureAccountContext().epoch !== owner.epoch) return;
          if (row.kind === 'FOLLOW_UP_CREATE' || row.kind === 'SITE_VISIT_CREATE') completedTaskLeads.add(row.draft_key);
          if (row.kind === 'FOLLOW_UP_CREATE' && result.status === 'PENDING') {
            await scheduleReminder({ id: result.id, kind: 'FOLLOW_UP', leadId: result.leadId, at: result.dueAt }, 15).catch(() => undefined);
          }
          if (row.kind === 'SITE_VISIT_CREATE' && ['SCHEDULED', 'CONFIRMED'].includes(result.status)) {
            await scheduleReminder({ id: result.id, kind: 'VISIT', leadId: result.leadId, at: result.scheduledAt }, 30).catch(() => undefined);
          }
        } catch (error) {
          const scopeChanged = error instanceof AccountScopeChangedError;
          const retry = scopeChanged || (error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500));
          const attempts = row.attempts + 1;
          const delay = Math.min(15 * 60_000, 15_000 * 2 ** Math.min(attempts, 6));
          await database.runAsync(
            'UPDATE local_mutations SET state=?,error=?,attempts=?,next_at=?,updated_at=? WHERE id=? AND owner_id=? AND owner_scope=?',
            retry ? 'QUEUED' : 'FAILED',
            (error as Error).message.slice(0, 500),
            attempts,
            Date.now() + delay,
            Date.now(),
            row.id,
            session.user.id,
            owner.scope,
          );
          if (scopeChanged) return;
        }
      }
    }
  } catch (error) {
    if (!(error instanceof AccountScopeChangedError)) throw error;
  } finally {
    syncing.delete(owner.scope);
  }
  return [...completedTaskLeads];
}

export async function getLocalDraft(id: string, owner = contextNow()) {
  const database = await db();
  assertAccountContext(owner);
  const row = await database.getFirstAsync<LocalDraft>(
    'SELECT * FROM local_mutations WHERE id=? AND owner_id=? AND owner_scope=?',
    id,
    draftOwnerId(owner),
    owner.scope,
  );
  assertAccountContext(owner);
  return row;
}

/** Mark a successfully approved review without discarding its local evidence. */
export async function completeReviewDraft(id: string, entryId: string, owner = contextNow()) {
  const database = await db();
  assertAccountContext(owner);
  await database.runAsync(
    "UPDATE local_mutations SET state='SYNCED',server_id=?,error=NULL,updated_at=? WHERE id=? AND owner_id=? AND owner_scope=? AND kind='IMPORT_REVIEW' AND state IN ('DRAFT','FAILED')",
    entryId,
    Date.now(),
    id,
    draftOwnerId(owner),
    owner.scope,
  );
  assertAccountContext(owner);
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

/** Shared encrypted storage connection for private account-scoped outboxes. */
export const privateDraftDatabase = db;
