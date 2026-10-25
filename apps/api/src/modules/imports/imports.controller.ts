import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ImportsService, captureInputSchema, reviewSchema } from './imports.service';
import { ImportUploadsService, uploadChunkSchema, uploadStartSchema } from './import-uploads.service';
const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  sourcePage: z.coerce.number().int().min(1).max(10000).optional(),
  reviewState: z.enum(['NEEDS_REVIEW', 'APPROVED', 'IGNORED', 'DUPLICATE']).optional(),
});
@Roles('SUPER_ADMIN', 'BROKER_ADMIN')
@Controller('imports')
export class ImportsController {
  constructor(
    private readonly imports: ImportsService,
    private readonly uploads: ImportUploadsService,
  ) {}

  @Post('uploads')
  startUpload(@Body(new ZodPipe(uploadStartSchema)) input: z.infer<typeof uploadStartSchema>, @CurrentUser() user: RequestUser) {
    return this.uploads.start(input, user);
  }

  @Post('uploads/:id/chunks/:index')
  @Throttle({ default: { limit: 900, ttl: 60_000 } })
  uploadChunk(
    @Param('id') id: string,
    @Param('index', new ZodPipe(z.coerce.number().int().min(0).max(299))) index: number,
    @Body(new ZodPipe(uploadChunkSchema)) input: z.infer<typeof uploadChunkSchema>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploads.chunk(id, index, input.data, user);
  }

  @Post('uploads/:id/complete')
  completeUpload(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.uploads.complete(id, user);
  }
  @Get() list(@CurrentUser() user: RequestUser, @Query(new ZodPipe(paging)) query: z.infer<typeof paging>) {
    return this.imports.list(user, query.page);
  }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() user: RequestUser, @Query(new ZodPipe(paging)) query: z.infer<typeof paging>) {
    return this.imports.get(id, user, query.page, query.sourcePage, query.reviewState);
  }
  @Post() capture(@Body(new ZodPipe(captureInputSchema)) input: z.infer<typeof captureInputSchema>, @CurrentUser() user: RequestUser) {
    return this.imports.capture(input, user);
  }
  @Post(':id/retry') retry(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.imports.retry(id, user);
  }
  @Get(':id/source') async source(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(z.object({ pageNo: z.coerce.number().int().min(1).max(10000).optional(), entryId: z.string().max(100).optional() })))
    query: { pageNo?: number; entryId?: string },
    @Res() response: Response,
  ) {
    const file = await this.imports.source(id, user, query.pageNo, query.entryId);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    if (file.body instanceof Readable) await pipeline(file.body, response);
    else response.end(file.body);
  }
  @Patch('entries/:id') save(@Param('id') id: string, @Body(new ZodPipe(reviewSchema)) input: z.infer<typeof reviewSchema>, @CurrentUser() user: RequestUser) {
    return this.imports.review(id, input, user);
  }
  @Post('entries/:id/approve') approve(
    @Param('id') id: string,
    @Body(new ZodPipe(reviewSchema)) input: z.infer<typeof reviewSchema>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.imports.review(id, input, user, true);
  }
}
