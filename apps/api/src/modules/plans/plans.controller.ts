import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlansDto } from './dto/create-plans.dto';
import { UpdatePlansDto } from './dto/update-plans.dto';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly service: PlansService) {}

  @Post()
  @ApiOperation({ summary: 'Create Plans' })
  create(@Body() dto: CreatePlansDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Plans' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Plans by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Plans' })
  update(@Param('id') id: string, @Body() dto: UpdatePlansDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Plans' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
