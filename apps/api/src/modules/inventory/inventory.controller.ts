import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { inventoryInputSchema, inventoryFilterSchema, availabilitySchema, inventoryPublishSchema, type InventoryPublishInput } from '@brokeriq/shared';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { InventoryService } from './inventory.service';
import type { CreateInventoryItemDto, InventoryFilterQuery, UpdateInventoryItemDto } from './inventory.dto';

@ApiTags('inventory')
@Roles('SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get() findAll(@Query(new ZodPipe(inventoryFilterSchema)) query: InventoryFilterQuery, @CurrentUser() user: RequestUser) {
    return this.inventory.findAll(query, user);
  }
  @Get('export')
  async exportCsv(
    @Query(new ZodPipe(inventoryFilterSchema.extend({ ids: z.string().max(200000).optional() }))) q: InventoryFilterQuery & { ids?: string },
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const ids = q.ids === undefined ? undefined : q.ids.split(',').filter(Boolean);
    if (ids && (ids.length === 0 || ids.length > 2000)) throw new BadRequestException('Select between 1 and 2,000 records');
    const csv = await this.inventory.exportCsv(q, user, ids);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="brokeriq-inventory.csv"');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(csv);
  }
  @Roles('SUPER_ADMIN')
  @Get('hierarchy/:kind')
  hierarchy(
    @Param('kind', new ZodPipe(z.enum(['organizations', 'members']))) kind: 'organizations' | 'members',
    @Query(
      new ZodPipe(
        z.object({
          search: z.string().max(200).optional(),
          organizationId: z.string().min(1).max(100).optional(),
          page: z.coerce.number().int().positive().default(1),
        }),
      ),
    )
    q: { search?: string; organizationId?: string; page: number },
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventory.hierarchy(kind, q, user);
  }
  @Get('stats') getStats(@Query('organizationId') orgId: string, @CurrentUser() user: RequestUser) {
    return this.inventory.getStats(user, orgId);
  }
  @Get('sectors') getSectors(@Query('organizationId') orgId: string, @CurrentUser() user: RequestUser) {
    return this.inventory.getSectors(user, orgId);
  }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventory.get(id, user);
  }
  @Post() create(@Body(new ZodPipe(inventoryInputSchema)) dto: CreateInventoryItemDto, @CurrentUser() user: RequestUser) {
    return this.inventory.create(dto, user);
  }
  @Patch('bulk/update') bulkUpdate(
    @Body(
      new ZodPipe(
        z.object({
          ids: z.array(z.string().min(1)).min(1).max(2000),
          data: z
            .object({ status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'RENTED']).optional(), availability: availabilitySchema.optional() })
            .refine((d) => d.status || d.availability, 'Select a change'),
        }),
      ),
    )
    body: { ids: string[]; data: UpdateInventoryItemDto },
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventory.bulkUpdate(body.ids, body.data, user);
  }
  @Patch(':id') update(@Param('id') id: string, @Body(new ZodPipe(inventoryInputSchema)) dto: UpdateInventoryItemDto, @CurrentUser() user: RequestUser) {
    return this.inventory.update(id, dto, user);
  }
  @Delete(':id') delete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventory.delete(id, user);
  }
  @Roles('SUPER_ADMIN', 'BROKER_ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventory.restore(id, user);
  }
  @Post(':id/publish') publish(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(inventoryPublishSchema)) body: InventoryPublishInput,
  ) {
    return this.inventory.publishToListing(id, body, user);
  }
  @Post(':id/publication/review') reviewPublication(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(
      new ZodPipe(z.object({ action: z.enum(['approve', 'reject']), reason: z.string().trim().max(500).optional(), expectedUpdatedAt: z.string().datetime() })),
    )
    body: { action: 'approve' | 'reject'; reason?: string; expectedUpdatedAt: string },
  ) {
    return this.inventory.reviewPublication(id, body, user);
  }
  @Post(':id/publication/withdraw') withdrawPublication(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventory.withdrawPublication(id, user);
  }
  @Get('publications/queue') publicationQueue(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(z.object({ page: z.coerce.number().int().positive().default(1) }))) query: { page: number },
  ) {
    return this.inventory.publicationQueue(user, query.page);
  }
  @Post('publications/:id/review') reviewListingPublication(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(
      new ZodPipe(z.object({ action: z.enum(['approve', 'reject']), reason: z.string().trim().max(500).optional(), expectedUpdatedAt: z.string().datetime() })),
    )
    body: { action: 'approve' | 'reject'; reason?: string; expectedUpdatedAt: string },
  ) {
    return this.inventory.reviewListingPublication(id, body, user);
  }
  @Post('bulk') bulk(
    @Body(new ZodPipe(z.object({ items: z.array(inventoryInputSchema).min(1).max(500) }))) body: { items: CreateInventoryItemDto[] },
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventory.bulkCreate(body.items, user);
  }
}
