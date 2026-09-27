import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HousingService } from './housing.service';
import { CreateHousingDto } from './dto/create-housing.dto';
import { UpdateHousingDto } from './dto/update-housing.dto';

@ApiTags('Housing')
@Controller('housing')
export class HousingController {
  constructor(private readonly service: HousingService) {}

  @Post()
  @ApiOperation({ summary: 'Create Housing' })
  create(@Body() dto: CreateHousingDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Housing' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Housing by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Housing' })
  update(@Param('id') id: string, @Body() dto: UpdateHousingDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Housing' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
