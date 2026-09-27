import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CredentialsService } from './credentials.service';
import { CreateCredentialsDto } from './dto/create-credentials.dto';
import { UpdateCredentialsDto } from './dto/update-credentials.dto';

@ApiTags('Credentials')
@Controller('credentials')
export class CredentialsController {
  constructor(private readonly service: CredentialsService) {}

  @Post()
  @ApiOperation({ summary: 'Create Credentials' })
  create(@Body() dto: CreateCredentialsDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Credentials' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Credentials by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Credentials' })
  update(@Param('id') id: string, @Body() dto: UpdateCredentialsDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Credentials' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
