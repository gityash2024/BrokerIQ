import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { CreateStorageDto } from './dto/create-storage.dto';
import { UpdateStorageDto } from './dto/update-storage.dto';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly service: StorageService) {}

  @Post()
  @ApiOperation({ summary: 'Create Storage' })
  create(@Body() dto: CreateStorageDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Storage' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Storage by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Storage' })
  update(@Param('id') id: string, @Body() dto: UpdateStorageDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Storage' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
