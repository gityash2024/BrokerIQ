import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadsDto } from './dto/create-leads.dto';
import { UpdateLeadsDto } from './dto/update-leads.dto';

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create Leads' })
  create(@Body() dto: CreateLeadsDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Leads' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Leads by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Leads' })
  update(@Param('id') id: string, @Body() dto: UpdateLeadsDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Leads' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
