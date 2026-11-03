import { createWorker, type Worker } from 'tesseract.js';
import { isAbsolute } from 'node:path';

let worker: Worker | null = null;
let busy = false;
process.on('disconnect', () => process.exit(0));
process.on('message', async (input: unknown) => {
  if (!input || typeof input !== 'object') return;
  const message = input as { id?: string; bytes?: Buffer; cachePath?: string };
  if (typeof message.id !== 'string') return;
  if (
    busy ||
    !Buffer.isBuffer(message.bytes) ||
    !message.bytes.length ||
    message.bytes.length > 32 * 1024 * 1024 ||
    !message.cachePath ||
    !isAbsolute(message.cachePath)
  ) {
    process.send?.({ id: message.id, error: true });
    return;
  }
  busy = true;
  try {
    // Engine errors reject the request; never let the dependency throw into the API process.
    worker ??= await createWorker(['eng', 'hin'], 1, { cachePath: message.cachePath, logger: () => undefined, errorHandler: () => undefined });
    const { data } = await worker.recognize(message.bytes);
    process.send?.({ id: message.id, text: data.text, confidence: data.confidence });
  } catch {
    process.send?.({ id: message.id, error: true });
  } finally {
    busy = false;
  }
});
