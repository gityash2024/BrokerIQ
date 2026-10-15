import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createWorker, type Worker } from 'tesseract.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { env } from '../../config/env';

@Injectable()
export class OcrService implements OnModuleDestroy {
  private worker: Worker | null = null;
  private serial: Promise<unknown> = Promise.resolve();
  recognize(bytes: Buffer): Promise<{ text: string; confidence: number }> {
    const next = this.serial
      .catch(() => undefined)
      .then(async () => {
        const cachePath = join(env().MEDIA_ROOT ?? process.cwd(), 'ocr-cache');
        await fs.mkdir(cachePath, { recursive: true });
        const metadata = await sharp(bytes).metadata();
        if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) throw new Error('Image dimensions exceed OCR limit');
        this.worker ??= await createWorker(['eng', 'hin'], 1, { cachePath });
        const image = await sharp(bytes).rotate().resize({ width: 2400, height: 3200, fit: 'inside', withoutEnlargement: true }).normalize().png().toBuffer();
        const { data } = await this.worker.recognize(image);
        return { text: data.text, confidence: data.confidence };
      });
    this.serial = next;
    return next;
  }
  async onModuleDestroy() {
    await this.serial.catch(() => undefined);
    await this.worker?.terminate();
  }
}
