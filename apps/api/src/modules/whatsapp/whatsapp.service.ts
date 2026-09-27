import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWhatsappDto } from './dto/create-whatsapp.dto';
import { UpdateWhatsappDto } from './dto/update-whatsapp.dto';

@Injectable()
export class WhatsappService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWhatsappDto) {
    return this.prisma.message.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.message.findMany();
  }

  async findOne(id: string) {
    return this.prisma.message.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdateWhatsappDto) {
    return this.prisma.message.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.message.delete({ where: { id } as any });
  }
}
