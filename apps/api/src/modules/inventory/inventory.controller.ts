import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { InventoryService } from './inventory.service';
import type { CreateInventoryItemDto, InventoryFilterQuery, UpdateInventoryItemDto } from './inventory.dto';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'MODERATOR', 'BROKER_ADMIN', 'BROKER_AGENT')
  findAll(@Query() query: InventoryFilterQuery, @CurrentUser() user: RequestUser) {
    return this.inventory.findAll(query, user);
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'MODERATOR', 'BROKER_ADMIN', 'BROKER_AGENT')
  getStats(@Query('organizationId') orgId: string, @CurrentUser() user: RequestUser) {
    return this.inventory.getStats(user, orgId);
  }

  @Get('sectors')
  @Roles('SUPER_ADMIN', 'MODERATOR', 'BROKER_ADMIN', 'BROKER_AGENT')
  getSectors(@Query('organizationId') orgId: string, @CurrentUser() user: RequestUser) {
    return this.inventory.getSectors(user, orgId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT')
  create(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: RequestUser) {
    return this.inventory.create(dto, user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto, @CurrentUser() user: RequestUser) {
    return this.inventory.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'BROKER_ADMIN')
  delete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventory.delete(id, user);
  }

  @Post(':id/publish')
  @Roles('SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT')
  publish(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventory.publishToListing(id, user);
  }

  @Post('bulk')
  @Roles('SUPER_ADMIN', 'BROKER_ADMIN')
  bulk(@Body() body: { items: CreateInventoryItemDto[] }, @CurrentUser() user: RequestUser) {
    return this.inventory.bulkCreate(body.items, user);
  }

  @Patch('bulk/update')
  @Roles('SUPER_ADMIN', 'BROKER_ADMIN')
  bulkUpdate(@Body() body: { ids: string[]; data: UpdateInventoryItemDto }, @CurrentUser() user: RequestUser) {
    return this.inventory.bulkUpdate(body.ids, body.data, user);
  }
}
