import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SiteVisitsService } from './site-visits.service';
import { CreateSiteVisitsDto } from './dto/create-site-visits.dto';
import { UpdateSiteVisitsDto } from './dto/update-site-visits.dto';

@ApiTags('SiteVisits')
@Controller('site-visits')
export class SiteVisitsController {
  constructor(private readonly service: SiteVisitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create SiteVisits' })
  create(@Body() dto: CreateSiteVisitsDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all SiteVisits' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get SiteVisits by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update SiteVisits' })
  update(@Param('id') id: string, @Body() dto: UpdateSiteVisitsDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete SiteVisits' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
