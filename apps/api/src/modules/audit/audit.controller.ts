import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Post()
  @ApiOperation({ summary: 'Create Audit' })
  create(@Body() dto: CreateAuditDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Audit' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Audit by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Audit' })
  update(@Param('id') id: string, @Body() dto: UpdateAuditDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Audit' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
