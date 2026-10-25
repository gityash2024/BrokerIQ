import { createHash } from 'node:crypto';
import { Unzip, UnzipInflate } from 'fflate';
import { TextDecoder } from 'node:util';
import { IMPORT_MAX_BYTES, type CapturedMessage } from '@brokeriq/shared';
import type { LocalStorageService } from '../../core/media/local-storage.service';
import { CHUNK_MANIFEST_TYPE, type ChunkManifest } from './import-uploads.service';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export async function openCaptureSource(storage: LocalStorageService, key: string) {
  const file = await storage.read(key);
  if (file.contentType !== CHUNK_MANIFEST_TYPE)
    return {
      contentType: file.contentType,
      bytes: (async function* () {
        yield file.body;
      })(),
    };
  const manifest = JSON.parse(file.body.toString('utf8')) as ChunkManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.chunks) || manifest.totalBytes > IMPORT_MAX_BYTES) throw new Error('Invalid source manifest');
  return {
    contentType: manifest.contentType,
    bytes: (async function* () {
      const digest = createHash('sha256');
      let size = 0;
      for (const chunk of manifest.chunks) {
        const part = await storage.read(chunk.key);
        if (part.body.length !== chunk.size || sha(part.body) !== chunk.hash) throw new Error('Source chunk integrity check failed');
        size += part.body.length;
        if (size > manifest.totalBytes) throw new Error('Source size mismatch');
        digest.update(part.body);
        yield part.body;
      }
      if (size !== manifest.totalBytes || digest.digest('hex') !== manifest.hash) throw new Error('Source integrity check failed');
    })(),
  };
}

const header = /^(?:\[([^\]]*\d{1,2}:\d{2}[^\]]*)\]|(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4},?\s+\d{1,2}:\d{2}[^-]*?)\s+-)\s*([^:]{1,150}):\s*(.*)$/;

/** At most one message plus one transport chunk is held in memory. */
export class ChatStreamParser {
  private line = '';
  private message: CapturedMessage | undefined;

  push(text: string, final = false): CapturedMessage[] {
    this.line += text;
    const output: CapturedMessage[] = [];
    let newline: number;
    while ((newline = this.line.indexOf('\n')) >= 0) {
      this.consume(this.line.slice(0, newline).replace(/\r$/, ''), output);
      this.line = this.line.slice(newline + 1);
    }
    if (this.line.length > 2_000_000)
      throw new Error('An individual chat line exceeds 2 million characters. Original preserved; split this message for review.');
    if (final) {
      if (this.line) this.consume(this.line.replace(/\r$/, ''), output);
      if (this.message) output.push(this.message);
      this.line = '';
      this.message = undefined;
    }
    return output;
  }

  private consume(line: string, output: CapturedMessage[]) {
    const match = line.replace(/^[\uFEFF\u200e\u200f]+/, '').match(header);
    if (match) {
      if (this.message) output.push(this.message);
      this.message = { text: match[4], sender: match[3].trim(), timestamp: match[1] ?? match[2] };
    } else if (this.message) this.message.text += `\n${line}`;
    else if (line.trim()) this.message = { text: line };
    if ((this.message?.text.length ?? 0) > 2_000_000)
      throw new Error('An individual chat message exceeds 2 million characters. Original preserved; split this message for review.');
  }
}

export async function* textMessages(bytes: AsyncIterable<Buffer>): AsyncGenerator<CapturedMessage> {
  const parser = new ChatStreamParser();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for await (const chunk of bytes) {
    for (let index = 0; index < chunk.length; index += 16384) yield* parser.push(decoder.decode(chunk.subarray(index, index + 16384), { stream: true }));
  }
  yield* parser.push(decoder.decode(), true);
}

export interface ArchiveSummary {
  textFiles: number;
  attachmentFiles: number;
  expandedTextBytes: number;
}

/** Incremental ZIP inflate: attachment binaries are retained only in the encrypted original. */
export async function* zipMessages(bytes: AsyncIterable<Buffer>, summary: ArchiveSummary): AsyncGenerator<CapturedMessage & { sourceFile?: string }> {
  let pending: (CapturedMessage & { sourceFile?: string })[] = [];
  let failure: Error | undefined;
  const archive = new Unzip((file) => {
    if (!/\.txt$/i.test(file.name)) {
      if (!file.name.endsWith('/')) summary.attachmentFiles++;
      return;
    }
    summary.textFiles++;
    const parser = new ChatStreamParser();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    file.ondata = (error, data, final) => {
      if (error) {
        failure = error;
        return;
      }
      summary.expandedTextBytes += data.length;
      if (summary.expandedTextBytes > IMPORT_MAX_BYTES) {
        failure = new Error('Expanded chat text exceeds 300 MB. Original ZIP preserved.');
        return;
      }
      try {
        for (let index = 0; index < data.length; index += 16384) {
          pending.push(
            ...parser.push(decoder.decode(data.subarray(index, index + 16384), { stream: true })).map((message) => ({ ...message, sourceFile: file.name })),
          );
        }
        if (final) pending.push(...parser.push(decoder.decode(), true).map((message) => ({ ...message, sourceFile: file.name })));
      } catch (caught) {
        failure = caught as Error;
      }
    };
    file.start();
  });
  archive.register(UnzipInflate);
  for await (const chunk of bytes) {
    for (let index = 0; index < chunk.length; index += 4096) {
      archive.push(chunk.subarray(index, index + 4096), false);
      if (failure) throw failure;
      const ready = pending;
      pending = [];
      yield* ready;
    }
  }
  archive.push(new Uint8Array(), true);
  if (failure) throw failure;
  yield* pending;
  if (!summary.textFiles) throw new Error('ZIP contains no chat TXT file. Original attachments are preserved; include the exported chat text.');
}
