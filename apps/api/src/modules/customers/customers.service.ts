import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomersDto } from './dto/create-customers.dto';
import { UpdateCustomersDto } from './dto/update-customers.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomersDto) {
    return this.prisma.customer.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.customer.findMany();
  }

  async findOne(id: string) {
    return this.prisma.customer.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdateCustomersDto) {
    return this.prisma.customer.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.customer.delete({ where: { id } as any });
  }
}
