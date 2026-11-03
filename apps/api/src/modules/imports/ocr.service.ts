import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { env } from '../../config/env';
import { OcrProcessClient } from './ocr-process-client';

export class OcrInputError extends Error {}

@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly engine = new OcrProcessClient();
  private stopped = false;
  private serial: Promise<unknown> = Promise.resolve();
  recognize(bytes: Buffer): Promise<{ text: string; confidence: number }> {
    const next = this.serial
      .catch(() => undefined)
      .then(async () => {
        if (this.stopped) throw new Error('OCR is stopping; original source preserved.');
        const cachePath = join(env().MEDIA_ROOT ?? process.cwd(), 'ocr-cache');
        await fs.mkdir(cachePath, { recursive: true });
        let image: Buffer;
        try {
          const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
          if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) throw new Error();
          image = await sharp(bytes, { limitInputPixels: 40_000_000 })
            .timeout({ seconds: 30 })
            .rotate()
            .resize({ width: 2400, height: 3200, fit: 'inside', withoutEnlargement: true })
            .normalize()
            .png()
            .toBuffer();
        } catch {
          throw new OcrInputError('Image is invalid or exceeds the OCR processing limit; original source preserved.');
        }
        return this.engine.recognize(image, cachePath);
      });
    this.serial = next;
    return next;
  }
  async onModuleDestroy() {
    this.stopped = true;
    await this.engine.close();
    await this.serial.catch(() => undefined);
  }
}
