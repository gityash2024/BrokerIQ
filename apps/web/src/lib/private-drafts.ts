'use client';
/** Private, account-scoped browser drafts. Non-extractable AES keys and ciphertext live in IndexedDB. */
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
const keys = new Map<string, Promise<CryptoKey>>();
function keyFor(owner: string) {
  let key = keys.get(owner);
  if (!key) {
    key = (async () => {
      const saved = await get<CryptoKey>('keys', owner);
      if (saved) return saved;
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
export async function readPrivateDraft<T>(owner: string, name: string): Promise<T | null> {
  const sealed = await get<SealedDraft>('drafts', `${owner}:${name}`);
  if (!sealed) return null;
  // A lost key must not silently replace a preserved draft with a blank form.
  const key = await get<CryptoKey>('keys', owner);
  if (!key) throw new Error('Draft key is unavailable. Existing encrypted data has been preserved.');
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, key, sealed.ciphertext);
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function writePrivateDraft(owner: string, name: string, payload: unknown) {
  const key = await keyFor(owner),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  await put('drafts', `${owner}:${name}`, { iv, ciphertext });
}
