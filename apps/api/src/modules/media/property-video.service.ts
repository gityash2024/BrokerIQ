import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { z } from 'zod';
import { MAX_PROPERTY_VIDEO_PHOTOS } from '@brokeriq/shared';
import { AiService } from '../../core/ai/ai.service';
import { JobsService } from '../../core/jobs/jobs.service';
import { LocalStorageService } from '../../core/media/local-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/decorators';
import { IntegrationNotConfiguredException } from '../../common/exceptions';
import { env } from '../../config/env';

const exec = promisify(execFile);
const videoBinary = (name: 'ffmpeg' | 'ffprobe') => {
  const configured = name === 'ffmpeg' ? env().PROPERTY_VIDEO_FFMPEG : env().PROPERTY_VIDEO_FFPROBE;
  const scoped = '/opt/brokeriq/runtime/property-video/bin/' + name;
  return configured ?? (existsSync(scoped) ? scoped : name);
};
const jobType = 'property.video.extract';
const formats = ['video/mp4', 'video/quicktime', 'video/webm'];
const verifiedFrames = z.object({ keep: z.array(z.number().int().min(1).max(MAX_PROPERTY_VIDEO_PHOTOS)).max(MAX_PROPERTY_VIDEO_PHOTOS) });
const candidateCount = 40;
const ttl = 24 * 60 * 60_000;

type ScoredFrame = { data: Buffer; index: number; quality: number; signature: boolean[] };

async function score(data: Buffer, index: number): Promise<ScoredFrame> {
  const pixels = await sharp(data).resize(80, 60, { fit: 'fill' }).greyscale().raw().toBuffer();
  let energy = 0;
  let sum = 0;
  for (let i = 80; i < pixels.length - 1; i++) {
    sum += pixels[i];
    energy += Math.abs(pixels[i] - pixels[i - 80]);
    if (i % 80) energy += Math.abs(pixels[i] - pixels[i - 1]);
  }
  const brightness = sum / (pixels.length - 81);
  const signaturePixels = await sharp(data).resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
  const signature = Array.from({ length: 64 }, (_, i) => signaturePixels[i + Math.floor(i / 8)] > signaturePixels[i + Math.floor(i / 8) + 1]);
  return { data, index, quality: brightness > 22 && brightness < 242 ? energy / pixels.length : 0, signature };
}

export async function extractPropertyFrames(video: Buffer): Promise<Buffer[]> {
  const work = await mkdtemp(join(tmpdir(), 'brokeriq-video-'));
  try {
    const input = join(work, 'source');
    await writeFile(input, video, { mode: 0o600 });
    const format = ['-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm'];
    const probe = await exec(
      videoBinary('ffprobe'),
      ['-v', 'error', ...format, '-select_streams', 'v:0', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', input],
      { timeout: 10_000, maxBuffer: 65536 },
    );
    const info = JSON.parse(probe.stdout);
    const duration = Number(info.format?.duration);
    const stream = info.streams?.[0];
    if (!stream || !Number.isFinite(duration) || duration <= 0 || duration > 600 || stream.width > 4096 || stream.height > 4096)
      throw new BadRequestException('Choose a supported video up to 10 minutes and 4K.');
    await exec(
      videoBinary('ffmpeg'),
      [
        '-nostdin',
        '-v',
        'error',
        ...format,
        '-threads',
        '1',
        '-i',
        input,
        '-an',
        '-sn',
        '-map',
        '0:v:0',
        '-filter_threads',
        '1',
        '-vf',
        `fps=${Math.min(4, candidateCount / duration)}:start_time=0,scale=1280:1280:force_original_aspect_ratio=decrease`,
        '-frames:v',
        String(candidateCount),
        '-threads',
        '1',
        '-q:v',
        '3',
        join(work, '%02d.jpg'),
      ],
      { timeout: 70_000, maxBuffer: 65536 },
    );
    const names = (await readdir(work)).filter((name) => name.endsWith('.jpg')).sort();
    const candidates: ScoredFrame[] = [];
    for (const [index, name] of names.entries()) candidates.push(await score(await readFile(join(work, name)), index));
    const unique: ScoredFrame[] = [];
    for (const candidate of candidates.sort((a, b) => b.quality - a.quality)) {
      if (candidate.quality < 2 || unique.some((prior) => prior.signature.filter((bit, i) => bit !== candidate.signature[i]).length < 9)) continue;
      unique.push(candidate);
      if (unique.length === MAX_PROPERTY_VIDEO_PHOTOS) break;
    }
    return unique.sort((a, b) => a.index - b.index).map((frame) => frame.data);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

@Injectable()
export class PropertyVideoService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: LocalStorageService,
    private readonly jobs: JobsService,
    private readonly ai: AiService,
  ) {}

  onModuleInit() {
    this.jobs.register(jobType, ({ id }) => this.extract(id));
  }

  private scope(id: string, user: RequestUser) {
    return { id, userId: user.id, organizationId: user.orgId ?? null, expiresAt: { gt: new Date() } };
  }

  async create(contentType: string, user: RequestUser) {
    if (!this.storage.enabled || !env().JOBS_ENABLED) throw new IntegrationNotConfiguredException('private_storage', 'Video extraction is unavailable.');
    if (!formats.includes(contentType)) throw new BadRequestException('Choose an MP4, MOV or WebM video.');
    const signed = this.storage.presign('propertyvideo', contentType, user.id);
    const record = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`property-video:${user.id}`}))`;
      const open = await tx.propertyVideoExtraction.count({
        where: { userId: user.id, expiresAt: { gt: new Date() }, state: { in: ['AWAITING_UPLOAD', 'PROCESSING', 'READY'] } },
      });
      if (open >= 4) throw new ConflictException('Complete or cancel an earlier video extraction first.');
      return tx.propertyVideoExtraction.create({
        data: { userId: user.id, organizationId: user.orgId ?? null, sourceKey: signed.key, expiresAt: new Date(Date.now() + ttl) },
      });
    });
    return { id: record.id, uploadUrl: signed.uploadUrl, headers: signed.headers, maxBytes: signed.maxBytes };
  }

  async start(id: string, user: RequestUser) {
    const record = await this.require(id, user);
    if (record.state === 'AWAITING_UPLOAD') {
      await this.storage.read(record.sourceKey);
      await this.db.propertyVideoExtraction.updateMany({ where: { id, state: 'AWAITING_UPLOAD' }, data: { state: 'PROCESSING' } });
    }
    if (['AWAITING_UPLOAD', 'PROCESSING'].includes(record.state))
      await this.jobs.enqueue(jobType, { id, orgId: user.orgId ?? null }, { key: `property-video:${id}`, maxAttempts: 2 });
    return { id };
  }

  private async require(id: string, user: RequestUser) {
    const row = await this.db.propertyVideoExtraction.findFirst({ where: this.scope(id, user) });
    if (!row) throw new NotFoundException('Video extraction not found');
    return row;
  }

  async status(id: string, user: RequestUser) {
    const row = await this.require(id, user);
    const frames =
      row.state === 'READY'
        ? await Promise.all(
            row.frameKeys.map(async (key) => {
              const { body } = await this.storage.read(key, 320);
              return 'data:image/webp;base64,' + body.toString('base64');
            }),
          )
        : [];
    return { state: row.state, aiVerified: row.aiVerified, frames };
  }

  async save(id: string, indices: number[], user: RequestUser) {
    const result = await this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "PropertyVideoExtraction" WHERE id = ${id} FOR UPDATE`;
        const row = await tx.propertyVideoExtraction.findFirst({ where: this.scope(id, user) });
        if (!row) throw new NotFoundException('Video extraction not found');
        if (row.state === 'SAVED') return row;
        if (row.state !== 'READY' || indices.some((index) => !row.frameKeys[index])) throw new ConflictException('Review the extracted photos before saving.');
        const urls: string[] = [];
        for (const index of [...new Set(indices)]) {
          const frame = await this.storage.read(row.frameKeys[index]);
          const name = createHash('sha256').update(`${id}:${index}`).digest('hex').slice(0, 20);
          const key = `listing/${user.id}/${row.sourceKey.split('/')[2]}/${name}`;
          await this.storage.store(key, frame.contentType, frame.body, true);
          urls.push(`${env().PUBLIC_API_URL.replace(/\/$/, '')}/api/media/f/${key}`);
        }
        return tx.propertyVideoExtraction.update({ where: { id }, data: { state: 'SAVED', urls } });
      },
      { timeout: 20_000 },
    );
    return { urls: result.urls };
  }

  async complete(id: string, user: RequestUser) {
    const row = await this.require(id, user);
    if (row.state !== 'SAVED') throw new ConflictException('Save the selected photos before completing extraction.');
    await this.removeTemporary(row);
    return { ok: true };
  }

  async cancel(id: string, user: RequestUser) {
    const row = await this.require(id, user);
    if (row.state === 'SAVED') return this.complete(id, user);
    if (row.state !== 'PROCESSING') {
      const changed = await this.db.propertyVideoExtraction.updateMany({
        where: { id, state: row.state },
        data: { state: 'CANCELLED', expiresAt: new Date(Date.now() + 10 * 60_000) },
      });
      if (changed.count) await this.removeTemporary(row);
      return { ok: true };
    }
    throw new ConflictException('Wait until extraction finishes before cancelling.');
  }

  private async verify(frames: Buffer[], row: { organizationId: string | null; userId: string }) {
    try {
      const width = 320;
      const height = 240;
      const tiles = await Promise.all(
        frames.map(async (frame, index) => {
          const marker = Buffer.from(
            `<svg width="52" height="36"><rect width="52" height="36" fill="black"/><text x="10" y="27" font-size="24" fill="white">${index + 1}</text></svg>`,
          );
          const image = await sharp(frame).resize(width, height, { fit: 'contain' }).toBuffer();
          const input = await sharp(image)
            .composite([{ input: marker, top: 0, left: 0 }])
            .toBuffer();
          return { input, left: (index % 2) * width, top: Math.floor(index / 2) * height };
        }),
      );
      const sheet = await sharp({ create: { width: width * 2, height: height * Math.ceil(frames.length / 2), channels: 3, background: '#000' } })
        .composite(tiles)
        .jpeg({ quality: 80 })
        .toBuffer();
      const answer = await this.ai.vision(
        'data:image/jpeg;base64,' + sheet.toString('base64'),
        'Choose the clearest photo of each distinct room or property area shown. Include useful exterior views. Exclude repeat views of the same room, unreadable images, unrelated subjects, identifiable people and documents. Return only the pictured 1-based labels in {"keep":[1,2]}, or an empty array if none are suitable.',
        { feature: 'property_video', orgId: row.organizationId, userId: row.userId, maxTokens: 100, responseSchema: verifiedFrames, strictSchema: true },
      );
      const indices = [...new Set(verifiedFrames.parse(JSON.parse(answer)).keep)];
      if (indices.some((index) => index > frames.length)) return null;
      return indices.sort((a, b) => a - b).map((index) => frames[index - 1]);
    } catch {
      return null;
    }
  }

  private async extract(id: string) {
    const row = await this.db.propertyVideoExtraction.findUnique({ where: { id } });
    if (!row || row.state !== 'PROCESSING' || row.expiresAt <= new Date()) return;
    let frames: Buffer[];
    try {
      frames = await extractPropertyFrames((await this.storage.read(row.sourceKey)).body);
    } catch {
      await this.db.propertyVideoExtraction.updateMany({ where: { id, state: 'PROCESSING' }, data: { state: 'FAILED' } });
      return;
    }
    const verified = frames.length ? await this.verify(frames, row) : null;
    const selected = verified?.length ? verified : frames;
    const frameKeys: string[] = [];
    for (const [index, data] of selected.entries()) {
      const key = `propertyvideo/${row.userId}/${row.sourceKey.split('/')[2]}/${createHash('sha256').update(`${id}:preview:${index}`).digest('hex').slice(0, 20)}`;
      await this.storage.store(key, 'image/jpeg', data);
      frameKeys.push(key);
    }
    await this.db.propertyVideoExtraction.updateMany({
      where: { id, state: 'PROCESSING' },
      data: { state: frameKeys.length ? 'READY' : 'FAILED', frameKeys, aiVerified: Boolean(verified?.length) },
    });
  }

  private async removeTemporary(row: { sourceKey: string; frameKeys: string[] }) {
    await Promise.all([row.sourceKey, ...row.frameKeys].map((key) => this.storage.remove(key)));
  }

  @Cron('0 */15 * * * *')
  async cleanup() {
    if (!this.storage.enabled) return;
    const expired = await this.db.propertyVideoExtraction.findMany({ where: { expiresAt: { lt: new Date() } }, take: 100 });
    for (const row of expired) {
      await this.removeTemporary(row);
      await this.db.propertyVideoExtraction.deleteMany({ where: { id: row.id } });
    }
  }
}
