import { ChatStreamParser, openCaptureSource, textMessages, zipMessages } from './capture-stream';
import { zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { CHUNK_MANIFEST_TYPE } from './import-uploads.service';

const pieces = async function* (buffer: Buffer, size = 17) {
  for (let index = 0; index < buffer.length; index += size) yield buffer.subarray(index, index + size);
};
const collect = async <T>(iter: AsyncIterable<T>) => {
  const rows: T[] = [];
  for await (const row of iter) rows.push(row);
  return rows;
};

describe('bounded capture source streaming', () => {
  it('preserves UTF-8, headers split across frames, multiline bodies and the final message', async () => {
    const text = '\uFEFF[24/10/2026, 11:10:00] Rahul: सेक्टर 45 में 2 BHK\r\nSecond line\r\n24/10/2026, 11:11 - A: Requirement commercial office';
    const rows = await collect(textMessages(pieces(Buffer.from(text), 1)));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ sender: 'Rahul', timestamp: '24/10/2026, 11:10:00', text: 'सेक्टर 45 में 2 BHK\nSecond line' });
    expect(rows[1].text).toBe('Requirement commercial office');
  });

  it('processes every chat TXT and accounts for ZIP attachments', async () => {
    const files: Record<string, Uint8Array> = {};
    for (let index = 0; index < 25; index++) files[`chat${index}.txt`] = strToU8(`[24/10/2026, 11:10:00] Sender: Requirement ${index} Sector 45`);
    files['photo.jpg'] = new Uint8Array([1, 2, 3]);
    const summary = { textFiles: 0, attachmentFiles: 0, expandedTextBytes: 0 };
    const rows = await collect(zipMessages(pieces(Buffer.from(zipSync(files))), summary));
    expect(rows).toHaveLength(25);
    expect(summary).toMatchObject({ textFiles: 25, attachmentFiles: 1 });
    expect(rows[24].sourceFile).toBe('chat24.txt');
  });

  it('rejects invalid UTF-8, truncated ZIPs and huge individual messages', async () => {
    await expect(collect(textMessages(pieces(Buffer.from([255, 255]))))).rejects.toThrow();
    const archive = Buffer.from(zipSync({ 'chat.txt': strToU8('body') }));
    await expect(collect(zipMessages(pieces(archive.subarray(0, 20)), { textFiles: 0, attachmentFiles: 0, expandedTextBytes: 0 }))).rejects.toThrow();
    expect(() => new ChatStreamParser().push('a'.repeat(2_000_001))).toThrow('individual chat line');
  });

  it('authenticates every stored chunk before releasing source bytes', async () => {
    const bytes = Buffer.from('private original');
    const digest = createHash('sha256').update(bytes).digest('hex');
    const manifest = {
      version: 1 as const,
      contentType: 'text/plain',
      totalBytes: bytes.length,
      hash: digest,
      chunks: [{ key: 'part', size: bytes.length, hash: digest }],
    };
    const storage = {
      read: jest.fn(async (key) =>
        key === 'root'
          ? { contentType: CHUNK_MANIFEST_TYPE, body: Buffer.from(JSON.stringify(manifest)) }
          : { contentType: 'application/octet-stream', body: bytes },
      ),
    };
    expect(Buffer.concat(await collect((await openCaptureSource(storage as any, 'root')).bytes)).equals(bytes)).toBe(true);
    manifest.chunks[0].hash = '0'.repeat(64);
    await expect(collect((await openCaptureSource(storage as any, 'root')).bytes)).rejects.toThrow('integrity');
  });
});
