import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { CreateHealthDto } from './dto/create-health.dto';
import { UpdateHealthDto } from './dto/update-health.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Post()
  @ApiOperation({ summary: 'Create Health' })
  create(@Body() dto: CreateHealthDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Health' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Health by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Health' })
  update(@Param('id') id: string, @Body() dto: UpdateHealthDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Health' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
