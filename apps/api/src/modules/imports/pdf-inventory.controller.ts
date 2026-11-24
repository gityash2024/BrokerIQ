import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { pdfInventoryFilters, pdfInventoryUpdate, type PdfInventoryFilters, type PdfInventoryUpdate } from '@brokeriq/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ImportUploadsService, uploadStartSchema, uploadChunkSchema } from './import-uploads.service';
import { PdfInventoryService } from './pdf-inventory.service';

@Roles('BROKER_ADMIN')
@Controller('inventory-pdf')
export class PdfInventoryController {
  constructor(private readonly imports: PdfInventoryService, private readonly uploads: ImportUploadsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query(new ZodPipe(pdfInventoryFilters)) query: PdfInventoryFilters) {
    return this.imports.list(user, query);
  }

  @Post('uploads')
  start(@CurrentUser() user: RequestUser, @Body(new ZodPipe(uploadStartSchema)) input: z.infer<typeof uploadStartSchema>) {
    return this.uploads.start(input, user, true);
  }

  @Post('uploads/:id/chunks/:index')
  @Throttle({ default: { limit: 200, ttl: 60_000 } })
  chunk(@Param('id') id: string, @Param('index', new ZodPipe(z.coerce.number().int().min(0).max(31))) index: number,
    @CurrentUser() user: RequestUser, @Body(new ZodPipe(uploadChunkSchema)) input: z.infer<typeof uploadChunkSchema>) {
    return this.uploads.chunk(id, index, input.data, user, true);
  }

  @Post('uploads/:id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.uploads.complete(id, user, true);
  }

  @Post('batches/:id/retry')
  retry(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.imports.retry(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body(new ZodPipe(pdfInventoryUpdate)) dto: PdfInventoryUpdate) {
    return this.imports.update(id, user, dto);
  }

  @Delete(':id')
  archive(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.imports.archive(id, user);
  }
}
