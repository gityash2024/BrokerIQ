import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytesToBase64, uploadImport, IMPORT_CHUNK_BYTES, IMPORT_MAX_BYTES, captureContentType } from '../import-upload';

test('Android ZIP aliases and shared files without an extension resolve to the canonical upload type', () => {
  assert.equal(captureContentType('group.ZIP', 'application/octet-stream'), 'application/zip');
  assert.equal(captureContentType('source', 'application/x-zip-compressed'), 'application/zip');
  assert.equal(captureContentType('provider-file', 'application/octet-stream', new Uint8Array([0x50, 0x4b, 3, 4])), 'application/zip');
  assert.equal(captureContentType('register.jpg', 'image/jpg'), 'image/jpeg');
  assert.equal(captureContentType('unsupported.pdf', 'application/pdf'), null);
});

test('base64 preserves binary tails and multiple encoding blocks', () => {
  for (const size of [0, 1, 2, 3, 12287, 12288, 12289, IMPORT_CHUNK_BYTES]) {
    const bytes = Uint8Array.from({ length: size }, (_, i) => i % 256);
    assert.equal(bytesToBase64(bytes), Buffer.from(bytes).toString('base64'));
  }
});

test('resumes from the acknowledged offset and completes without legacy capture', async () => {
  const reads: number[] = [];
  const total = IMPORT_CHUNK_BYTES + 3;
  const request = async <T>(path: string, body?: unknown): Promise<T> => {
    if (path === '/imports/uploads')
      return { id: 'upload', nextIndex: 1, receivedBytes: IMPORT_CHUNK_BYTES, chunkBytes: IMPORT_CHUNK_BYTES, batchId: null } as T;
    if (path.endsWith('/chunks/1')) {
      assert.deepEqual(body, { data: 'YWJj' });
      return { id: 'upload', nextIndex: 2, receivedBytes: total, chunkBytes: IMPORT_CHUNK_BYTES, batchId: null } as T;
    }
    return { id: 'batch', status: 'PENDING' } as T;
  };
  const result = await uploadImport(
    request,
    { clientKey: 'client-key', fileName: 'chat.txt', contentType: 'text/plain', sourceType: 'CHAT_EXPORT', totalBytes: total },
    async (offset, length) => {
      reads.push(offset);
      assert.equal(length, 3);
      return 'YWJj';
    },
  );
  assert.deepEqual(result, { id: 'batch', status: 'PENDING' });
  assert.deepEqual(reads, [IMPORT_CHUNK_BYTES]);
});

test('rejects files above 300 MB before opening an upload', async () => {
  await assert.rejects(
    uploadImport(
      async () => {
        throw new Error('must not call');
      },
      { clientKey: 'client-key', fileName: 'chat.zip', contentType: 'application/zip', sourceType: 'CHAT_EXPORT', totalBytes: IMPORT_MAX_BYTES + 1 },
      async () => '',
    ),
    /300 MB/,
  );
});
