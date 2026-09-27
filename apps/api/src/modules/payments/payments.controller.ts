import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentsDto } from './dto/create-payments.dto';
import { UpdatePaymentsDto } from './dto/update-payments.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create Payments' })
  create(@Body() dto: CreatePaymentsDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Payments' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Payments by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Payments' })
  update(@Param('id') id: string, @Body() dto: UpdatePaymentsDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Payments' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
