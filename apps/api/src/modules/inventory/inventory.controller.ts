import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { inventoryInputSchema, inventoryFilterSchema, availabilitySchema } from '@brokeriq/shared';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { InventoryService } from './inventory.service';
import type { CreateInventoryItemDto, InventoryFilterQuery, UpdateInventoryItemDto } from './inventory.dto';

@ApiTags('inventory')
@Roles('SUPER_ADMIN', 'BROKER_ADMIN')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get() findAll(@Query(new ZodPipe(inventoryFilterSchema)) query: InventoryFilterQuery, @CurrentUser() user: RequestUser) {
    return this.inventory.findAll(query, user);
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
  @Post(':id/publish') publish() {
    return this.inventory.publishToListing();
  }
  @Post('bulk') bulk(
    @Body(new ZodPipe(z.object({ items: z.array(inventoryInputSchema).min(1).max(500) }))) body: { items: CreateInventoryItemDto[] },
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventory.bulkCreate(body.items, user);
  }
}
