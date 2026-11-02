// Node WebCrypto + fake-indexeddb. These are storage/HTTP contracts, never browser acceptance.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { authStore, api, apiBlob, captureAccountContext, AccountScopeChangedError, uploadFile } from '../src/lib/api';
import { readPrivateDraft, writePrivateDraft, LEGACY_WEB_DRAFT_REVIEW } from '../src/lib/private-drafts';
import { readInboxDraft, saveInboxDraft, moveInboxDraft, hasLegacyInboxDraft } from '../src/lib/inbox-drafts';
import { mock } from 'node:test';

class MemoryStorage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}
Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });
Object.defineProperty(globalThis, 'document', { value: { cookie: '' }, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true });
const session = (id: string, firm = 'a', role = 'BROKER_ADMIN') =>
  ({ accessToken: 'fixture', refreshToken: 'fixture', user: { id, role, organization: { id: firm } } }) as any;
const login = (id: string, firm = 'a', role = 'BROKER_ADMIN') => authStore.set(session(id, firm, role));
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => mock.restoreAll());
async function store(store: string, key: string, value?: unknown, remove = false): Promise<any> {
  const connection = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('brokeriq-private-drafts', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(store, value === undefined && !remove ? 'readonly' : 'readwrite');
    const object = transaction.objectStore(store),
      r = remove ? object.delete(key) : value === undefined ? object.get(key) : object.put(value, key);
    let result: any;
    r.onsuccess = () => {
      result = r.result;
    };
    transaction.oncomplete = () => {
      connection.close();
      resolve(result);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

test('rejects late requests and callbacks after a same-account A to B to A change', async () => {
  login('roundtrip');
  const owner = captureAccountContext();
  let release!: (r: Response) => void;
  const request = mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const pending = api('/broker/team');
  const rejected = assert.rejects(pending, AccountScopeChangedError);
  login('roundtrip', 'b');
  login('roundtrip');
  await assert.rejects(api('/inventory', { body: { private: true }, ownerContext: owner }), AccountScopeChangedError);
  release(response({}, 401));
  await rejected;
  assert.equal(request.mock.calls.length, 1); // No refresh of the new session on the old401.
});
test('a persisted context nonce fences another tab even without a storage event being delivered yet', async () => {
  login('cross-tab');
  const old = captureAccountContext();
  localStorage.setItem('biq.auth', JSON.stringify({ ...session('cross-tab', 'b'), scopeRevision: 'other-tab-b' }));
  localStorage.setItem('biq.auth', JSON.stringify({ ...session('cross-tab'), scopeRevision: 'other-tab-a-return' }));
  const request = mock.method(globalThis, 'fetch', async () => response({}));
  await assert.rejects(api('/inventory', { body: {}, ownerContext: old }), AccountScopeChangedError);
  assert.equal(request.mock.calls.length, 0);
});
test('transparent token refresh keeps operation ownership and does not delete legacy draft text', async () => {
  login('refresh');
  sessionStorage.setItem('biq.inbox-draft:refresh:legacy', 'Preserve the original');
  const owner = captureAccountContext();
  let call = 0;
  mock.method(globalThis, 'fetch', async () =>
    ++call === 1
      ? response({}, 401)
      : call === 2
        ? response({ ...session('refresh'), accessToken: 'rotated', refreshToken: 'rotated-refresh' })
        : response({ id: 'ok' }),
  );
  assert.deepEqual(await api('/inventory', { ownerContext: owner }), { id: 'ok' });
  assert.deepEqual(captureAccountContext(), owner);
  assert.equal(call, 3);
  login('refresh', 'b', 'BROKER_AGENT');
  assert.equal(sessionStorage.getItem('biq.inbox-draft:refresh:legacy'), 'Preserve the original');
});
test('legacy login storage can rotate tokens without an unnecessary scope error', async () => {
  localStorage.setItem('biq.auth', JSON.stringify(session('legacy-auth')));
  const owner = captureAccountContext();
  let call = 0;
  mock.method(globalThis, 'fetch', async () =>
    ++call === 1
      ? response({}, 401)
      : call === 2
        ? response({ ...session('legacy-auth'), accessToken: 'rotated', refreshToken: 'rotated' })
        : response({ ok: true }),
  );
  assert.deepEqual(await api('/inventory', { ownerContext: owner }), { ok: true });
  assert.deepEqual(captureAccountContext(), owner);
});
test('encrypts independent role/firm drafts and restores only the exact workspace', async () => {
  login('private-capture');
  const original = captureAccountContext();
  await writePrivateDraft(original, 'capture', { text: 'Private firm A' });
  const sealed = await store('drafts', `scope:${original.scope}:capture`);
  assert.ok(sealed.ciphertext instanceof ArrayBuffer);
  assert.ok(!Buffer.from(sealed.ciphertext).toString().includes('Private firm A'));
  login('private-capture', 'b');
  assert.equal(await readPrivateDraft(captureAccountContext(), 'capture'), null);
  await writePrivateDraft(captureAccountContext(), 'capture', { text: 'Private firm B' });
  login('private-capture', 'a', 'BROKER_AGENT');
  assert.equal(await readPrivateDraft(captureAccountContext(), 'capture'), null);
  login('private-capture');
  await assert.rejects(readPrivateDraft(original, 'capture'), AccountScopeChangedError);
  assert.deepEqual(await readPrivateDraft(captureAccountContext(), 'capture'), { text: 'Private firm A' });
});
test('preserves legacy encrypted captures and requires an explicit separate draft', async () => {
  login('legacy-capture');
  const owner = captureAccountContext();
  await writePrivateDraft(owner, 'initialization', {});
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('{"text":"Original legacy input"}'));
  await store('keys', owner.userId!, key);
  await store('drafts', `${owner.userId}:capture`, { iv, ciphertext });
  await assert.rejects(readPrivateDraft(owner, 'capture'), new Error(LEGACY_WEB_DRAFT_REVIEW));
  assert.equal(await readPrivateDraft(owner, 'capture', true), null);
  await writePrivateDraft(owner, 'capture', { text: 'Separate reviewed input' });
  assert.deepEqual(await store('drafts', `${owner.userId}:capture`), { iv, ciphertext });
});
test('a missing encryption key cannot silently overwrite an existing sealed draft', async () => {
  login('key-loss');
  const owner = captureAccountContext();
  await writePrivateDraft(owner, 'capture', { text: 'Keep ciphertext' });
  const path = `scope:${owner.scope}:capture`,
    before = await store('drafts', path);
  await store('keys', `scope:${owner.scope}`, undefined, true);
  await assert.rejects(readPrivateDraft(owner, 'capture'), /key is unavailable/);
  await assert.rejects(writePrivateDraft(owner, 'capture', { text: 'Overwrite' }), /key is unavailable/);
  assert.deepEqual(await store('drafts', path), before);
});
test('authenticated encryption binds the payload to its exact target', async () => {
  login('bound-target');
  const owner = captureAccountContext();
  await writePrivateDraft(owner, 'one', { text: 'Only for one' });
  await store('drafts', `scope:${owner.scope}:two`, await store('drafts', `scope:${owner.scope}:one`));
  await assert.rejects(readPrivateDraft(owner, 'two'));
  assert.deepEqual(await readPrivateDraft(owner, 'one'), { text: 'Only for one' });
});
test('scope change during encryption preserves the previous ciphertext', async () => {
  login('encrypt-race');
  const owner = captureAccountContext();
  await writePrivateDraft(owner, 'capture', { text: 'Prior durable text' });
  const path = `scope:${owner.scope}:capture`,
    before = await store('drafts', path),
    encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
  mock.method(crypto.subtle, 'encrypt', async (...args: Parameters<typeof crypto.subtle.encrypt>) => {
    const result = await encrypt(...args);
    login('encrypt-race', 'b');
    return result;
  });
  await assert.rejects(writePrivateDraft(owner, 'capture', { text: 'Late text' }), AccountScopeChangedError);
  assert.deepEqual(await store('drafts', path), before);
});
test('migrates legacy Inbox plaintext to verified encrypted quarantine without claiming a firm', async () => {
  login('legacy-inbox');
  const owner = captureAccountContext(),
    oldKey = `biq.inbox-draft:${owner.userId}:thread`;
  sessionStorage.setItem(oldKey, 'Legacy private reply');
  assert.equal(await readInboxDraft('thread', owner), '');
  assert.equal(sessionStorage.getItem(oldKey), null);
  assert.equal(await hasLegacyInboxDraft('thread', owner), true);
  await saveInboxDraft('thread', 'New scoped reply', owner);
  assert.equal(await readInboxDraft('thread', owner), 'New scoped reply');
  login('legacy-inbox', 'b');
  assert.equal(await readInboxDraft('thread'), '');
  assert.equal(await hasLegacyInboxDraft('thread'), true);
  login('legacy-inbox');
  assert.equal(await readInboxDraft('thread'), 'New scoped reply');
});
test('does not clear legacy plaintext when encryption cannot be completed', async () => {
  login('legacy-failure');
  const oldKey = 'biq.inbox-draft:legacy-failure:thread';
  sessionStorage.setItem(oldKey, 'Keep original on failure');
  mock.method(crypto.subtle, 'encrypt', async () => {
    throw new Error('Storage interrupted');
  });
  await assert.rejects(readInboxDraft('thread'), /Storage interrupted/);
  assert.equal(sessionStorage.getItem(oldKey), 'Keep original on failure');
});
test('Inbox moves preserve conflicts, isolate channels, and never delete a self-move', async () => {
  login('inbox-moves');
  await saveInboxDraft('lead:SMS', 'SMS text');
  await saveInboxDraft('lead:EMAIL', 'Email text');
  await saveInboxDraft('thread', 'Existing reply');
  assert.equal(await moveInboxDraft('lead:SMS', 'thread'), 'CONFLICT');
  assert.equal(await readInboxDraft('lead:SMS'), 'SMS text');
  assert.equal(await readInboxDraft('thread'), 'Existing reply');
  await saveInboxDraft('thread', '');
  assert.equal(await moveInboxDraft('lead:SMS', 'thread'), 'MOVED');
  assert.equal(await readInboxDraft('lead:SMS'), '');
  assert.equal(await readInboxDraft('thread'), 'SMS text');
  assert.equal(await moveInboxDraft('thread', 'thread'), 'MOVED');
  assert.equal(await readInboxDraft('thread'), 'SMS text');
  assert.equal(await readInboxDraft('lead:EMAIL'), 'Email text');
});
test('rapid draft writes and clear retain ordering', async () => {
  login('ordered');
  await Promise.all([saveInboxDraft('thread', 'H'), saveInboxDraft('thread', 'Hello'), saveInboxDraft('thread', '')]);
  assert.equal(await readInboxDraft('thread'), '');
});
test('private binary responses cannot cross an A to B to A transition', async () => {
  login('binary');
  let release!: (b: Blob) => void;
  mock.method(
    globalThis,
    'fetch',
    async () =>
      ({
        status: 200,
        ok: true,
        blob: () =>
          new Promise<Blob>((resolve) => {
            release = resolve;
          }),
      }) as Response,
  );
  const pending = apiBlob('/private/report'),
    rejected = assert.rejects(pending, AccountScopeChangedError);
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  login('binary', 'b');
  login('binary');
  release(new Blob(['private bytes']));
  await rejected;
});
test('a signed upload result cannot attach after a scope change', async () => {
  login('upload');
  mock.method(globalThis, 'fetch', async () => response({ provider: 's3', uploadUrl: 'https://storage.invalid', publicUrl: 'private-signed-result' }));
  class Upload {
    upload = {};
    status = 200;
    onload?: () => void;
    open() {}
    setRequestHeader() {}
    send() {
      queueMicrotask(() => {
        login('upload', 'b');
        this.onload?.();
      });
    }
  }
  Object.defineProperty(globalThis, 'XMLHttpRequest', { value: Upload, configurable: true });
  await assert.rejects(uploadFile(new Blob(['source']), 'scan'), AccountScopeChangedError);
});

test('a new tab write between encryption and move commit is retained by compare-and-swap', async () => {
  login('cas-move');
  const owner = captureAccountContext();
  await saveInboxDraft('source', 'Original shared draft');
  const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
  let changed = false;
  mock.method(crypto.subtle, 'encrypt', async (...args: Parameters<typeof crypto.subtle.encrypt>) => {
    const result = await encrypt(...args);
    if (!changed) {
      changed = true;
      await writePrivateDraft(owner, 'inbox:target', 'Other tab reply');
    }
    return result;
  });
  assert.equal(await moveInboxDraft('source', 'target'), 'CONFLICT');
  assert.equal(await readInboxDraft('source'), 'Original shared draft');
  assert.equal(await readInboxDraft('target'), 'Other tab reply');
});
test('an old editor changing legacy plaintext during migration keeps its new version too', async () => {
  login('legacy-race');
  const oldKey = 'biq.inbox-draft:legacy-race:thread';
  sessionStorage.setItem(oldKey, 'First version');
  const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
  let changed = false;
  mock.method(crypto.subtle, 'encrypt', async (...args: Parameters<typeof crypto.subtle.encrypt>) => {
    const result = await encrypt(...args);
    if (!changed) {
      changed = true;
      sessionStorage.setItem(oldKey, 'Newer version from an old editor');
    }
    return result;
  });
  assert.equal(await readInboxDraft('thread'), '');
  assert.equal(sessionStorage.getItem(oldKey), 'Newer version from an old editor');
  assert.equal(await readInboxDraft('thread'), '');
  assert.equal(sessionStorage.getItem(oldKey), null);
  assert.equal(await hasLegacyInboxDraft('thread'), true);
});
test('a new workspace refresh is independent from an old workspace refresh in flight', async () => {
  login('refresh-race');
  let call = 0,
    started!: () => void,
    release!: (r: Response) => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  mock.method(globalThis, 'fetch', async () => {
    call++;
    if (call === 1 || call === 3) return response({}, 401);
    if (call === 2) {
      started();
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    }
    if (call === 4) return response({ ...session('refresh-race', 'b'), accessToken: 'new-b', refreshToken: 'refresh-b-new' });
    return response({ firm: 'b' });
  });
  const pending = api('/inventory'),
    rejected = assert.rejects(pending, AccountScopeChangedError);
  await entered;
  login('refresh-race', 'b');
  assert.deepEqual(await api('/inventory'), { firm: 'b' });
  release(response({ ...session('refresh-race'), accessToken: 'late-a', refreshToken: 'late-a-refresh' }));
  await rejected;
  assert.equal(authStore.get()?.user.organization?.id, 'b');
  assert.equal(authStore.get()?.accessToken, 'new-b');
});

test('an unfinished old-workspace encryption does not block a new-workspace Inbox', async () => {
  login('independent-queue');
  await saveInboxDraft('thread', 'Prior A');
  let release!: () => void,
    started!: () => void,
    first = true;
  const entered = new Promise<void>((resolve) => {
      started = resolve;
    }),
    pause = new Promise<void>((resolve) => {
      release = resolve;
    });
  const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
  mock.method(crypto.subtle, 'encrypt', async (...args: Parameters<typeof crypto.subtle.encrypt>) => {
    if (first) {
      first = false;
      started();
      await pause;
    }
    return encrypt(...args);
  });
  const pending = saveInboxDraft('thread', 'Late A'),
    rejected = assert.rejects(pending, AccountScopeChangedError);
  await entered;
  login('independent-queue', 'b');
  await saveInboxDraft('thread', 'Independent B');
  assert.equal(await readInboxDraft('thread'), 'Independent B');
  release();
  await rejected;
  login('independent-queue');
  assert.equal(await readInboxDraft('thread'), 'Prior A');
});
