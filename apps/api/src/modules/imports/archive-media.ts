import { createHash } from 'node:crypto';
import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';
import { IMPORT_MAX_BYTES } from '@brokeriq/shared';
import { discardZipFile } from './capture-stream';

const mediaTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
};
export interface ArchiveMediaFile {
  index: number;
  name: string;
  basename: string;
  contentType: string;
  body?: Buffer;
  sha256?: string;
  warning?: string;
}
export interface ArchiveMediaSummary {
  files: number;
  mediaFiles: number;
  ignoredFiles: number;
  expandedMediaBytes: number;
}
interface Limits {
  files: number;
  mediaFiles: number;
  imageBytes: number;
  videoBytes: number;
  expandedBytes: number;
}
const defaults: Limits = { files: 10_000, mediaFiles: 500, imageBytes: 16 * 1024 * 1024, videoBytes: 20_000_000, expandedBytes: IMPORT_MAX_BYTES };

/** Original names are provenance only; no archive-controlled path is ever written. */
export function archiveBasename(name: string) {
  if (name.length > 1024 || name.includes('\0') || /^(?:[\\/]|[A-Za-z]:)/.test(name) || name.split(/[\\/]/).some((part) => part === '..')) return null;
  return name.split(/[\\/]/).pop()?.normalize('NFC') || null;
}

/** Consume one bounded entry at a time; originals remain in the encrypted parent ZIP. */
export async function* zipMedia(bytes: AsyncIterable<Buffer>, summary: ArchiveMediaSummary, overrides: Partial<Limits> = {}): AsyncGenerator<ArchiveMediaFile> {
  const limits = { ...defaults, ...overrides };
  let pending: ArchiveMediaFile[] = [];
  let failure: Error | undefined;
  const archive = new Unzip((file) => {
    const index = summary.files++;
    if (summary.files > limits.files || file.name.length > 1024) {
      failure = new Error('ZIP metadata exceeds the review limit. Original ZIP preserved.');
      discardZipFile(archive, file);
      return;
    }
    const basename = archiveBasename(file.name);
    const extension = basename?.split('.').pop()?.toLowerCase() ?? '';
    const contentType = Object.hasOwn(mediaTypes, extension) ? mediaTypes[extension] : undefined;
    if (!basename || !contentType || file.name.endsWith('/')) {
      summary.ignoredFiles++;
      discardZipFile(archive, file);
      return;
    }
    if (++summary.mediaFiles > limits.mediaFiles) {
      failure = new Error('ZIP contains too many media files. Split the export for review; original preserved.');
      discardZipFile(archive, file);
      return;
    }
    const item = { index, name: file.name, basename, contentType };
    const max = contentType.startsWith('image/') ? limits.imageBytes : limits.videoBytes;
    if (file.originalSize !== undefined && file.originalSize > max) {
      pending.push({ ...item, warning: 'Attachment exceeds the individual processing limit; retained in the original ZIP.' });
      discardZipFile(archive, file);
      return;
    }
    let size = 0;
    const parts: Buffer[] = [];
    archive.register(UnzipInflate);
    archive.register(UnzipPassThrough);
    file.ondata = (error, data, final) => {
      if (failure) return;
      if (error) {
        failure = error;
        return;
      }
      size += data.length;
      summary.expandedMediaBytes += data.length;
      // Unknown-size streaming ZIP entries must abort promptly on expansion overflow.
      if (size > max || summary.expandedMediaBytes > limits.expandedBytes) {
        failure = new Error('Expanded ZIP media exceeds the processing limit. Original ZIP preserved.');
        return;
      }
      parts.push(Buffer.from(data));
      if (final) {
        const body = Buffer.concat(parts);
        pending.push({ ...item, body, sha256: createHash('sha256').update(body).digest('hex') });
      }
    };
    file.start();
  });
  for await (const chunk of bytes) {
    for (let offset = 0; offset < chunk.length; offset += 4096) {
      archive.push(chunk.subarray(offset, offset + 4096), false);
      if (failure) throw failure;
      const ready = pending;
      pending = [];
      yield* ready;
    }
  }
  archive.push(new Uint8Array(), true);
  if (failure) throw failure;
  yield* pending;
}

/** Associate only explicit WhatsApp export attachment syntax; never guess from a similar name. */
export function attachmentNames(text: string) {
  const names = new Set<string>();
  for (const match of text.matchAll(/<attached:\s*([^>\r\n]+)>|(?:^|\n)\s*([^\r\n]+?)\s*\((?:file attached|फ़ाइल अटैच है)\)/gi)) {
    const name = archiveBasename((match[1] ?? match[2]).trim().replace(/^[\u200e\u200f]+/, ''));
    if (name) names.add(name);
  }
  return [...names];
}

export function associatedAttachments<T extends { basename: string }>(text: string, files: T[]) {
  const matches: T[] = [],
    missing: string[] = [],
    ambiguous: string[] = [];
  for (const name of attachmentNames(text)) {
    const found = files.filter((file) => file.basename === name);
    if (found.length === 1) matches.push(found[0]);
    else if (found.length > 1) ambiguous.push(name);
    else missing.push(name);
  }
  return { matches, missing, ambiguous };
}
