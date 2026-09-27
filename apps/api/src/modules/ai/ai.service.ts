import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAiDto) {
    return this.prisma.aIResult.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.aIResult.findMany();
  }

  async findOne(id: string) {
    return this.prisma.aIResult.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdateAiDto) {
    return this.prisma.aIResult.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.aIResult.delete({ where: { id } as any });
  }
}
