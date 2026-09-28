import { Controller, Get, NotFoundException, Param, PayloadTooLargeException, Put, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators';
import { LocalStorageService, RESIZE_WIDTHS } from '../../core/media/local-storage.service';

/** Upload + serve endpoints for the self-hosted media store (MEDIA_ROOT). */
@ApiExcludeController()
@Controller('media')
export class MediaController {
  constructor(private readonly store: LocalStorageService) {}

  /** Body is the raw file; the signed token (from /me/uploads/sign) authorises exactly one key. */
  @Public()
  @Put('upload/:token')
  async upload(@Param('token') token: string, @Req() req: Request) {
    if (!this.store.enabled) throw new NotFoundException();
    const claims = this.store.verifyToken(token);
    const data = await readBody(req, claims.max);
    const contentType = await this.store.store(claims.key, claims.ct, data);
    return { ok: true, key: claims.key, contentType };
  }

  @Public()
  @SkipThrottle()
  @Get('f/:kind/:owner/:month/:id')
  async serve(@Param() p: Record<string, string>, @Query('w') w: string | undefined, @Req() req: Request, @Res() res: Response) {
    if (!this.store.enabled) throw new NotFoundException();
    const key = `${p.kind}/${p.owner}/${p.month}/${p.id}`;
    const width = RESIZE_WIDTHS.find((x) => String(x) === w);
    const etag = `"${p.id}${width ? `-${width}` : ''}"`;
    const isPrivate = this.store.isPrivate(key);
    res.setHeader('Cache-Control', isPrivate ? 'private, no-store' : 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    if (!isPrivate && req.headers['if-none-match'] === etag) return res.status(304).end();

    const { contentType, body } = await this.store.read(key, width);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', body.length);
    // Only images / video / PDF render inline; anything else (svg, html, docs) is downloaded.
    if (!/^(image\/(webp|jpeg|png|gif|avif)|video\/|audio\/|application\/pdf)/.test(contentType)) res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    return res.end(body);
  }
}

function readBody(req: Request, max: number): Promise<Buffer> {
  if (Buffer.isBuffer((req as any).body) && (req as any).body.length) return Promise.resolve((req as any).body);
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > max) return Promise.reject(new PayloadTooLargeException(`File ${Math.round(max / 1048576)}MB से बड़ी है`));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        reject(new PayloadTooLargeException(`File ${Math.round(max / 1048576)}MB से बड़ी है`));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
