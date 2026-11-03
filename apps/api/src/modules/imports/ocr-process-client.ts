import { fork, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function startOcrProcess() {
  const compiled = join(__dirname, 'ocr-process.js');
  const source = join(__dirname, 'ocr-process.ts');
  const workerEnv: NodeJS.ProcessEnv = { NODE_OPTIONS: '--max-old-space-size=512' };
  for (const name of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'NODE_ENV']) if (process.env[name]) workerEnv[name] = process.env[name];
  const production = existsSync(compiled);
  if (!production && process.env.NODE_ENV === 'production') throw new Error('Compiled OCR process is unavailable');
  if (!production) workerEnv.TS_NODE_PROJECT = join(__dirname, '../../..', 'tsconfig.json');
  return fork(production ? compiled : source, [], {
    env: workerEnv,
    execArgv: production ? [] : ['-r', require.resolve('ts-node/register/transpile-only')],
    serialization: 'advanced',
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
}

type Result = { text: string; confidence: number };
type Pending = { id: string; resolve: (value: Result) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };

/** One owned child, one request. Killing it also ends its Tesseract worker threads. */
export class OcrProcessClient {
  private child: ChildProcess | null = null;
  private pending: Pending | null = null;
  private retiring: Promise<void> | null = null;
  private stopped = false;
  constructor(
    private readonly start = startOcrProcess,
    private readonly timeoutMs = 120_000,
  ) {}

  async recognize(bytes: Buffer, cachePath: string): Promise<Result> {
    if (this.retiring) await this.retiring;
    if (this.stopped) throw new Error('OCR is stopping; original source preserved.');
    if (this.pending) throw new Error('OCR worker is busy; original source preserved.');
    const child = this.child ?? this.connect();
    return new Promise<Result>((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => this.fail(child, new Error('OCR timed out; original source preserved for retry.')), this.timeoutMs);
      this.pending = { id, resolve, reject, timer };
      try {
        child.send({ id, bytes, cachePath }, (error) => {
          if (error && this.pending?.id === id) this.fail(child, new Error('OCR worker unavailable; original source preserved for retry.'));
        });
      } catch {
        this.fail(child, new Error('OCR worker unavailable; original source preserved for retry.'));
      }
    });
  }
  private connect() {
    const child = this.start();
    this.child = child;
    child.on('error', () => this.fail(child, new Error('OCR worker failed; original source preserved for retry.')));
    child.on('exit', () => this.fail(child, new Error('OCR worker exited; original source preserved for retry.')));
    child.on('message', (message: unknown) => {
      if (this.child !== child || !this.pending || !message || typeof message !== 'object') return;
      const result = message as { id?: string; text?: unknown; confidence?: unknown; error?: unknown };
      if (result.id !== this.pending.id) return;
      if (
        result.error ||
        typeof result.text !== 'string' ||
        result.text.length > 2_000_000 ||
        typeof result.confidence !== 'number' ||
        !Number.isFinite(result.confidence)
      ) {
        this.fail(child, new Error('OCR could not read the image; original source preserved for retry.'));
        return;
      }
      const pending = this.pending;
      this.pending = null;
      clearTimeout(pending.timer);
      pending.resolve({ text: result.text, confidence: Math.max(0, Math.min(100, result.confidence)) });
    });
    return child;
  }
  private fail(child: ChildProcess, error: Error) {
    if (this.child !== child) return;
    const pending = this.pending;
    this.pending = null;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    void this.retire(child);
  }
  private retire(child: ChildProcess) {
    if (this.child === child) this.child = null;
    if (this.retiring) return this.retiring;
    const retiring =
      child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => {
              child.off('exit', done);
              child.off('close', done);
              resolve();
            };
            child.once('exit', done);
            child.once('close', done);
            if (!child.kill('SIGKILL') && !child.pid) done();
          });
    this.retiring = retiring;
    void retiring.finally(() => {
      if (this.retiring === retiring) this.retiring = null;
    });
    return retiring;
  }
  async close() {
    this.stopped = true;
    const child = this.child;
    if (child) {
      const pending = this.pending;
      this.pending = null;
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error('OCR stopped; original source preserved for retry.'));
      }
      await this.retire(child);
    }
    if (this.retiring) await this.retiring;
  }
}
