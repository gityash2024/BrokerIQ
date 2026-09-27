import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionsDto } from './dto/create-subscriptions.dto';
import { UpdateSubscriptionsDto } from './dto/update-subscriptions.dto';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create Subscriptions' })
  create(@Body() dto: CreateSubscriptionsDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Subscriptions' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Subscriptions by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Subscriptions' })
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionsDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Subscriptions' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
