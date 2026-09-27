import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFollowUpsDto } from './dto/create-follow-ups.dto';
import { UpdateFollowUpsDto } from './dto/update-follow-ups.dto';

@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFollowUpsDto) {
    return this.prisma.followUp.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.followUp.findMany();
  }

  async findOne(id: string) {
    return this.prisma.followUp.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdateFollowUpsDto) {
    return this.prisma.followUp.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.followUp.delete({ where: { id } as any });
  }
}
