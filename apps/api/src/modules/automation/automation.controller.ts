import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@ApiTags('Automation')
@Controller('automation')
export class AutomationController {
  constructor(private readonly service: AutomationService) {}

  @Post()
  @ApiOperation({ summary: 'Create Automation' })
  create(@Body() dto: CreateAutomationDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Automation' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Automation by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Automation' })
  update(@Param('id') id: string, @Body() dto: UpdateAutomationDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Automation' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
