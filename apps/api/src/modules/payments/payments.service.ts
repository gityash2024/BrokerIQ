import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentsDto } from './dto/create-payments.dto';
import { UpdatePaymentsDto } from './dto/update-payments.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentsDto) {
    return this.prisma.payment.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.payment.findMany();
  }

  async findOne(id: string) {
    return this.prisma.payment.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdatePaymentsDto) {
    return this.prisma.payment.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.payment.delete({ where: { id } as any });
  }
}
