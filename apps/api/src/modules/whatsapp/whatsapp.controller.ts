import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { CreateWhatsappDto } from './dto/create-whatsapp.dto';
import { UpdateWhatsappDto } from './dto/update-whatsapp.dto';

@ApiTags('Whatsapp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}

  @Post()
  @ApiOperation({ summary: 'Create Whatsapp' })
  create(@Body() dto: CreateWhatsappDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Whatsapp' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Whatsapp by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Whatsapp' })
  update(@Param('id') id: string, @Body() dto: UpdateWhatsappDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Whatsapp' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
