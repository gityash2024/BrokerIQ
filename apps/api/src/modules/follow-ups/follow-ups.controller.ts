import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FollowUpsService } from './follow-ups.service';
import { CreateFollowUpsDto } from './dto/create-follow-ups.dto';
import { UpdateFollowUpsDto } from './dto/update-follow-ups.dto';

@ApiTags('FollowUps')
@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly service: FollowUpsService) {}

  @Post()
  @ApiOperation({ summary: 'Create FollowUps' })
  create(@Body() dto: CreateFollowUpsDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all FollowUps' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get FollowUps by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update FollowUps' })
  update(@Param('id') id: string, @Body() dto: UpdateFollowUpsDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete FollowUps' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
