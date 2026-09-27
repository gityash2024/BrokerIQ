// apps/api/src/modules/properties/properties.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { CreatePropertiesDto } from './dto/create-properties.dto';
import { UpdatePropertiesDto } from './dto/update-properties.dto';
import { MarketDirectoryQueryDto } from './dto/market-directory-query.dto';
import { ScanExtractDto } from './dto/scan-extract.dto';

@ApiTags('Properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}

  @Post()
  @ApiOperation({ summary: 'Create Properties' })
  create(@Body() dto: CreatePropertiesDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Properties' })
  findAll() {
    return this.service.findAll();
  }

  // =========================================================================
  // CRITICAL: Declare 'market-directory' and 'scan-extract' BEFORE ':id'
  // so Express / NestJS router does not match them as property IDs!
  // =========================================================================

  @Get('market-directory')
  @ApiOperation({
    summary: 'Get micro-market commercial directory, 9 sectors intelligence, and nearby infrastructure points',
  })
  @ApiQuery({ name: 'sector', required: false, description: 'Sector filter (e.g. 86, 88A, 89, 90, mumbai-luxury)' })
  @ApiQuery({ name: 'category', required: false, description: 'Category filter (Retail Shops, SCO Plots, etc.)' })
  @ApiQuery({ name: 'floor', required: false, description: 'Floor filter (GF, FF, SF, Corner)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term across projects, units, contacts' })
  getMarketDirectory(@Query() query: MarketDirectoryQueryDto) {
    return this.service.getMarketDirectory(query);
  }

  @Post('scan-extract')
  @ApiOperation({
    summary: 'Extract structured commercial property listings from physical register OCR text or camera photo',
  })
  scanExtract(@Body() dto: ScanExtractDto) {
    return this.service.scanExtract(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Properties by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Properties' })
  update(@Param('id') id: string, @Body() dto: UpdatePropertiesDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Properties' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
