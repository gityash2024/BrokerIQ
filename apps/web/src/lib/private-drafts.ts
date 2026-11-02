'use client';
/** Private, account-scoped browser drafts. Non-extractable AES keys and ciphertext live in IndexedDB. */
import { assertAccountContext, registerAuthCacheReset, type AccountContext } from './api';
export const LEGACY_WEB_DRAFT_REVIEW = 'Older draft ownership needs review. Its original is preserved; start a separate draft or contact support.';
type SealedDraft = { iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer };
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('brokeriq-private-drafts', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts');
      request.result.createObjectStore('keys');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(new Error('Private draft storage is unavailable. Your input has not been discarded.'));
    };
  }));
}
async function get<T>(store: string, key: string): Promise<T | undefined> {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(store, 'readonly');
    const request = transaction.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function put(store: string, key: string, value: unknown) {
  const connection = await db();
  await new Promise<void>((resolve, reject) => {
    const transaction = connection.transaction(store, 'readwrite');
    transaction.objectStore(store).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
async function hasPrefix(prefix: string) {
  const connection = await db();
  return new Promise<boolean>((resolve, reject) => {
    const request = connection
      .transaction('drafts', 'readonly')
      .objectStore('drafts')
      .openKeyCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}
const keys = new Map<string, Promise<CryptoKey>>();
registerAuthCacheReset(() => keys.clear());
function keyFor(owner: string) {
  let key = keys.get(owner);
  if (!key) {
    key = (async () => {
      const saved = await get<CryptoKey>('keys', owner);
      if (saved) return saved;
      if (await hasPrefix(`${owner}:`)) throw new Error('Draft key is unavailable. Existing encrypted data has been preserved.');
      const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const connection = await db();
      // Read/write transactions serialize across tabs. Never replace a key another tab just created.
      return await new Promise<CryptoKey>((resolve, reject) => {
        const transaction = connection.transaction('keys', 'readwrite'),
          store = transaction.objectStore('keys');
        const request = store.get(owner);
        let selected = created;
        request.onsuccess = () => {
          if (request.result) selected = request.result;
          else store.put(created, owner);
        };
        transaction.oncomplete = () => resolve(selected);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    })().catch((error) => {
      keys.delete(owner);
      throw error;
    });
    keys.set(owner, key);
  }
  return key;
}
const namespace = (owner: AccountContext) => `scope:${owner.scope}`;
const storageKey = (owner: AccountContext, name: string) => `${namespace(owner)}:${name}`;
function assertOwner(owner: AccountContext) {
  assertAccountContext(owner);
  if (!owner.userId) throw new Error('Sign in before opening private drafts.');
}
export async function hasLegacyPrivateDraft(owner: AccountContext, name: string) {
  assertOwner(owner);
  const value = await get<SealedDraft>('drafts', `${owner.userId}:${name}`);
  assertOwner(owner);
  return !!value;
}
export async function readPrivateDraft<T>(owner: AccountContext, name: string, startSeparate = false): Promise<T | null> {
  assertOwner(owner);
  const path = storageKey(owner, name);
  const sealed = await get<SealedDraft>('drafts', path);
  assertOwner(owner);
  if (!sealed) {
    if (!startSeparate && (await hasLegacyPrivateDraft(owner, name))) throw new Error(LEGACY_WEB_DRAFT_REVIEW);
    return null;
  }
  const key = await get<CryptoKey>('keys', namespace(owner));
  assertOwner(owner);
  if (!key) throw new Error('Draft key is unavailable. Existing encrypted data has been preserved.');
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: new TextEncoder().encode(path) }, key, sealed.ciphertext);
  assertOwner(owner);
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function writePrivateDraft(owner: AccountContext, name: string, payload: unknown) {
  assertOwner(owner);
  if ((await hasPrefix(`${namespace(owner)}:`)) && !(await get<CryptoKey>('keys', namespace(owner))))
    throw new Error('Draft key is unavailable. Existing encrypted data has been preserved.');
  const key = await keyFor(namespace(owner)),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    path = storageKey(owner, name);
  assertOwner(owner);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(path) },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  assertOwner(owner);
  await put('drafts', path, { iv, ciphertext });
  assertOwner(owner);
}

function sameSealed(a?: SealedDraft, b?: SealedDraft) {
  if (!a || !b) return a === b;
  const same = (x: ArrayBuffer | Uint8Array, y: ArrayBuffer | Uint8Array) => {
    const left = x instanceof Uint8Array ? x : new Uint8Array(x),
      right = y instanceof Uint8Array ? y : new Uint8Array(y);
    return left.length === right.length && left.every((byte, index) => byte === right[index]);
  };
  return same(a.iv, b.iv) && same(a.ciphertext, b.ciphertext);
}
/** Encrypt before opening the transaction; IDB callbacks then perform a real compare-and-swap. */
export async function movePrivateDraft(owner: AccountContext, source: string, target: string) {
  assertOwner(owner);
  const fromKey = storageKey(owner, source),
    toKey = storageKey(owner, target);
  const from = await get<SealedDraft>('drafts', fromKey),
    to = await get<SealedDraft>('drafts', toKey);
  assertOwner(owner);
  if (!from) return 'EMPTY' as const;
  if (source === target) return 'MOVED' as const;
  const body = await readPrivateDraft<unknown>(owner, source, true),
    existing = await readPrivateDraft<unknown>(owner, target, true);
  if (body === '' || body === null) return 'EMPTY' as const;
  if (to && existing !== '' && JSON.stringify(existing) !== JSON.stringify(body)) return 'CONFLICT' as const;
  const key = await keyFor(namespace(owner)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(toKey) },
    key,
    new TextEncoder().encode(JSON.stringify(body)),
  );
  assertOwner(owner);
  const connection = await db();
  assertOwner(owner);
  const result = await new Promise<'MOVED' | 'CONFLICT'>((resolve, reject) => {
    const transaction = connection.transaction('drafts', 'readwrite'),
      store = transaction.objectStore('drafts');
    let outcome: 'MOVED' | 'CONFLICT' = 'CONFLICT',
      failure: unknown;
    const currentFrom = store.get(fromKey);
    currentFrom.onsuccess = () => {
      const currentTo = store.get(toKey);
      currentTo.onsuccess = () => {
        try {
          assertOwner(owner);
          if (!sameSealed(currentFrom.result, from) || !sameSealed(currentTo.result, to)) return;
          store.put({ iv, ciphertext }, toKey);
          store.delete(fromKey);
          outcome = 'MOVED';
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
    };
    transaction.oncomplete = () => resolve(outcome);
    transaction.onerror = () => reject(failure ?? transaction.error);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Draft move interrupted. Both originals were preserved.'));
  });
  assertOwner(owner);
  return result;
}
async function digest(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
/** Quarantine legacy plaintext only after authenticated encryption and a verified readback. No firm is inferred. */
export async function preserveLegacyInbox(ownerId: string, target: string, body: string) {
  const owner = `legacy-inbox:${ownerId}`,
    path = `${owner}:${await digest(target)}:${await digest(body)}`;
  if ((await hasPrefix(`${owner}:`)) && !(await get<CryptoKey>('keys', owner)))
    throw new Error('Draft key is unavailable. Existing encrypted data has been preserved.');
  const key = await keyFor(owner),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(path) },
    key,
    new TextEncoder().encode(JSON.stringify({ target, body })),
  );
  await put('drafts', path, { iv, ciphertext });
  const saved = await get<SealedDraft>('drafts', path);
  if (!saved) throw new Error('Legacy draft could not be preserved. The original was retained.');
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: saved.iv, additionalData: new TextEncoder().encode(path) }, key, saved.ciphertext);
  const result = JSON.parse(new TextDecoder().decode(bytes));
  if (result.target !== target || result.body !== body) throw new Error('Legacy draft verification failed. The original was retained.');
}
export async function hasPreservedLegacyInbox(owner: AccountContext, target: string) {
  assertOwner(owner);
  const found = await hasPrefix(`legacy-inbox:${owner.userId}:${await digest(target)}:`);
  assertOwner(owner);
  return found;
}
