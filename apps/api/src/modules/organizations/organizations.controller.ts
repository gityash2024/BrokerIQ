import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationsDto } from './dto/create-organizations.dto';
import { UpdateOrganizationsDto } from './dto/update-organizations.dto';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create Organizations' })
  create(@Body() dto: CreateOrganizationsDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Organizations' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Organizations by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Organizations' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationsDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Organizations' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
