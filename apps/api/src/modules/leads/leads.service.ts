import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadsDto } from './dto/create-leads.dto';
import { UpdateLeadsDto } from './dto/update-leads.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeadsDto) {
    return this.prisma.lead.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.lead.findMany();
  }

  async findOne(id: string) {
    return this.prisma.lead.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdateLeadsDto) {
    return this.prisma.lead.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.lead.delete({ where: { id } as any });
  }
}
