import { requireOptionalNativeModule } from 'expo';
import { fetch } from 'expo/fetch';
import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { shareablePropertyPhotoUrls } from '@brokeriq/shared';
import { assertAccountContext, captureAccountContext } from './api';

const bridge = requireOptionalNativeModule<{ sharePhotos(paths: string[], title: string): Promise<void> }>('BrokerIQPhotoShare');
const types: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};
const maxPhotoBytes = 20 * 1024 * 1024;
const maxShareBytes = 120 * 1024 * 1024;
const batchLifetime = 3 * 60 * 60 * 1000;

export const canSharePropertyPhotoFiles = !!bridge;

async function downloadPhoto(url: string, directory: Directory, index: number, maxBytes: number, signal: AbortSignal) {
  const request = new AbortController();
  const cancel = () => request.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 45_000);
  try {
    if (signal.aborted) cancel();
    const response = await fetch(url, { signal: request.signal, redirect: 'error', credentials: 'omit' });
    const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    const length = Number(response.headers.get('content-length'));
    const extension = types[mime];
    if (!response.ok || !extension || length > maxBytes || !response.body) throw new Error('Property photo could not be loaded as an image.');
    const file = new File(directory, `property-${String(index + 1).padStart(2, '0')}.${extension}`);
    file.create();
    const stream = response.body.getReader();
    const handle = file.open();
    let bytes = 0;
    try {
      for (;;) {
        const { value, done } = await stream.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) throw new Error('Property photos exceed the share size limit.');
        handle.writeBytes(value);
      }
      if (!bytes) throw new Error('Property photo is empty.');
      return { uri: file.uri, bytes };
    } finally {
      handle.close();
      await stream.cancel().catch(() => undefined);
    }
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
    request.abort();
  }
}

/** Downloads the complete batch before opening the native recipient picker. */
export async function sharePropertyPhotoFiles(urls: readonly string[], signal: AbortSignal, title: string) {
  if (!bridge) throw new Error('Update the BrokerIQ app to share image files.');
  const owner = captureAccountContext();
  if (!owner.userId) throw new Error('Sign in to share property photos.');
  const links = shareablePropertyPhotoUrls(urls);
  if (!links.length || links.length > 50) throw new Error('Choose a property with shareable photos.');

  const root = new Directory(Paths.cache, 'brokeriq-photo-share');
  root.create({ idempotent: true, intermediates: true });
  for (const entry of root.list()) {
    const createdAt = Number(entry.name.split('-')[0]);
    if (entry instanceof Directory && /^\d{13}-[a-f0-9-]+$/.test(entry.name) && createdAt < Date.now() - batchLifetime) entry.delete();
  }
  const batch = new Directory(root, `${Date.now()}-${randomUUID()}`);
  batch.create();
  try {
    const paths: string[] = [];
    let remaining = maxShareBytes;
    for (const [index, url] of links.entries()) {
      assertAccountContext(owner);
      if (signal.aborted) throw new Error('Photo sharing cancelled.');
      try {
        const file = await downloadPhoto(url, batch, index, Math.min(remaining, maxPhotoBytes), signal);
        remaining -= file.bytes;
        paths.push(file.uri);
      } catch {
        throw new Error(`Photo ${index + 1} of ${links.length} could not be prepared. Retry or share as links.`);
      }
    }
    assertAccountContext(owner);
    if (signal.aborted) throw new Error('Photo sharing cancelled.');
    await bridge.sharePhotos(paths, title);
    // The selected Android app may still be reading the files. Expire them on a later share.
  } catch (error) {
    if (batch.exists) batch.delete();
    throw error;
  }
}
