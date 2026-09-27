import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';

@ApiTags('Ai')
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Post()
  @ApiOperation({ summary: 'Create Ai' })
  create(@Body() dto: CreateAiDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Ai' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Ai by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Ai' })
  update(@Param('id') id: string, @Body() dto: UpdateAiDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Ai' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
