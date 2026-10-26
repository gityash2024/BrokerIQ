/** Large chat exports use bounded requests instead of holding the original in a JS heap. */
export const IMPORT_MAX_BYTES = 300 * 1024 * 1024;
export const IMPORT_CHUNK_BYTES = 1024 * 1024;

/** Android document providers and WhatsApp shares use several MIME aliases. */
export function captureContentType(fileName: string, mime = '', signature = new Uint8Array()): string | null {
  if (/\.zip$/i.test(fileName) || ['application/zip', 'application/x-zip-compressed', 'application/x-zip'].includes(mime) ||
      (signature[0] === 0x50 && signature[1] === 0x4b && [3, 5, 7].includes(signature[2]))) return 'application/zip';
  if (/\.txt$/i.test(fileName) || mime === 'text/plain') return 'text/plain';
  if (/\.jpe?g$/i.test(fileName) || ['image/jpeg', 'image/jpg'].includes(mime) || (signature[0] === 0xff && signature[1] === 0xd8)) return 'image/jpeg';
  if (/\.png$/i.test(fileName) || mime === 'image/png' || (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4e && signature[3] === 0x47)) return 'image/png';
  if (/\.webp$/i.test(fileName) || mime === 'image/webp') return 'image/webp';
  return null;
}

export interface ImportUploadState {
  id: string;
  nextIndex: number;
  receivedBytes: number;
  chunkBytes: number;
  batchId: string | null;
}

export interface ImportUploadInput {
  clientKey: string;
  fileName: string;
  contentType: string;
  totalBytes: number;
  sourceType: 'IMAGE' | 'CHAT_EXPORT';
  groupName?: string;
  target?: string;
}

export type ImportUploadRequest = <T>(path: string, body?: unknown) => Promise<T>;

export async function uploadImport(
  request: ImportUploadRequest,
  input: ImportUploadInput,
  readBase64: (offset: number, length: number) => Promise<string>,
  progress?: (received: number, total: number) => void,
) {
  if (!input.totalBytes || input.totalBytes > IMPORT_MAX_BYTES) throw new Error('Source must be between 1 byte and 300 MB. Original was preserved.');
  let state = await request<ImportUploadState>('/imports/uploads', input);
  progress?.(state.receivedBytes, input.totalBytes);
  while (!state.batchId && state.receivedBytes < input.totalBytes) {
    const data = await readBase64(state.receivedBytes, Math.min(state.chunkBytes, input.totalBytes - state.receivedBytes));
    state = await request<ImportUploadState>(`/imports/uploads/${state.id}/chunks/${state.nextIndex}`, { data });
    progress?.(state.receivedBytes, input.totalBytes);
  }
  return request<{ id: string; status: string }>(`/imports/uploads/${state.id}/complete`, {});
}

/** Works in Hermes without Buffer or spread arguments that overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += 12288) {
    let part = '';
    const end = Math.min(start + 12288, bytes.length);
    for (let i = start; i < end; i += 3) {
      const a = bytes[i],
        b = bytes[i + 1],
        c = bytes[i + 2];
      part +=
        alphabet[a >> 2] +
        alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)] +
        (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)] : '=') +
        (i + 2 < bytes.length ? alphabet[c & 63] : '=');
    }
    parts.push(part);
  }
  return parts.join('');
}
