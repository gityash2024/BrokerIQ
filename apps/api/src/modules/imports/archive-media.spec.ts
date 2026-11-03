import { createHash, randomBytes } from 'node:crypto';
import { zipSync, strToU8, Zip, ZipDeflate } from 'fflate';
import { archiveBasename, associatedAttachments, attachmentNames, zipMedia, type ArchiveMediaFile } from './archive-media';

const pieces = async function* (bytes: Uint8Array, size = 17) {
  for (let i = 0; i < bytes.length; i += size) yield Buffer.from(bytes.subarray(i, i + size));
};
const summary = () => ({ files: 0, mediaFiles: 0, ignoredFiles: 0, expandedMediaBytes: 0 });
async function collect(iter: AsyncIterable<ArchiveMediaFile>) {
  const rows: ArchiveMediaFile[] = [];
  for await (const row of iter) rows.push(row);
  return rows;
}

describe('bounded private archive media extraction and explicit message association', () => {
  it('preserves exact image/video bytes, hashes and names while discarding TXT and unsupported files', async () => {
    const image = randomBytes(6000),
      video = randomBytes(5000),
      counts = summary();
    const rows = await collect(
      zipMedia(pieces(zipSync({ 'chat.txt': strToU8('text'), 'images/photo.jpg': image, 'clip.mp4': video, 'unsafe.svg': strToU8('<svg/>') })), counts),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      index: 1,
      name: 'images/photo.jpg',
      basename: 'photo.jpg',
      contentType: 'image/jpeg',
      sha256: createHash('sha256').update(image).digest('hex'),
    });
    expect(rows[0].body!.equals(image)).toBe(true);
    expect(rows[1].body!.equals(video)).toBe(true);
    expect(counts).toEqual({ files: 4, mediaFiles: 2, ignoredFiles: 2, expandedMediaBytes: image.length + video.length });
  });
  it('keeps declared oversized attachments in the parent ZIP and continues with later permitted media', async () => {
    const rows = await collect(zipMedia(pieces(zipSync({ 'large.jpg': randomBytes(100), 'small.png': randomBytes(10) })), summary(), { imageBytes: 50 }));
    expect(rows[0].body).toBeUndefined();
    expect(rows[0].warning).toContain('retained in the original ZIP');
    expect(rows[1].body).toHaveLength(10);
  });
  it('aborts unknown-size expansion promptly instead of continuing to inflate a ZIP bomb', async () => {
    const parts: Uint8Array[] = [];
    const zip = new Zip((error, data) => {
      if (error) throw error;
      parts.push(data);
    });
    const file = new ZipDeflate('streamed.jpg');
    zip.add(file);
    file.push(new Uint8Array(1000), true);
    zip.end();
    await expect(collect(zipMedia(pieces(Buffer.concat(parts)), summary(), { imageBytes: 50 }))).rejects.toThrow('Expanded ZIP media');
  });
  it('enforces aggregate expansion, file and media-count limits', async () => {
    const input = zipSync({ 'one.jpg': randomBytes(20), 'two.jpg': randomBytes(20) });
    await expect(collect(zipMedia(pieces(input), summary(), { expandedBytes: 30 }))).rejects.toThrow('Expanded ZIP media');
    await expect(collect(zipMedia(pieces(input), summary(), { files: 1 }))).rejects.toThrow('metadata');
    await expect(collect(zipMedia(pieces(input), summary(), { mediaFiles: 1 }))).rejects.toThrow('too many media');
  });
  it('rejects traversal, absolute/drive paths and NUL names without ever writing an archive path', async () => {
    for (const name of ['../photo.jpg', '/photo.jpg', 'C:\\photo.jpg', 'x/../photo.jpg', 'x\0.jpg']) expect(archiveBasename(name)).toBeNull();
    const counts = summary();
    const rows = await collect(zipMedia(pieces(zipSync({ '../bad.jpg': randomBytes(10), 'safe.jpg': randomBytes(10) })), counts));
    expect(rows.map((row) => row.basename)).toEqual(['safe.jpg']);
    expect(counts.ignoredFiles).toBe(1);
  });
  it('associates iOS/Android Hindi and English attachment markers across caption lines', () => {
    expect(attachmentNames('\u200e<attached: PHOTO-1.jpg>\nPHOTO-2.jpg (file attached)\nCaption\nPHOTO-3.png (फ़ाइल अटैच है)')).toEqual([
      'PHOTO-1.jpg',
      'PHOTO-2.jpg',
      'PHOTO-3.png',
    ]);
    expect(attachmentNames('I talked about PHOTO-1.jpg yesterday')).toEqual([]);
    expect(attachmentNames('<attached: ../PHOTO-1.jpg>')).toEqual([]);
  });
  it('keeps missing, case-mismatched and duplicate basenames for review instead of guessing association', () => {
    const files = [
      { basename: 'one.jpg', index: 1 },
      { basename: 'duplicate.jpg', index: 2 },
      { basename: 'duplicate.jpg', index: 3 },
    ];
    const result = associatedAttachments('<attached: one.jpg>\n<attached: duplicate.jpg>\n<attached: missing.jpg>\n<attached: ONE.jpg>', files);
    expect(result.matches).toEqual([files[0]]);
    expect(result.ambiguous).toEqual(['duplicate.jpg']);
    expect(result.missing).toEqual(['missing.jpg', 'ONE.jpg']);
  });
});
