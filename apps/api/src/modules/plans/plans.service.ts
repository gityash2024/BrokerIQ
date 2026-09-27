import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlansDto } from './dto/create-plans.dto';
import { UpdatePlansDto } from './dto/update-plans.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlansDto) {
    return this.prisma.plan.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.plan.findMany({
      include: {
        features: true,
        limits: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        features: true,
        limits: true,
        subscriptions: {
          include: {
            organization: true,
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return plan;
  }

  async update(id: string, dto: UpdatePlansDto) {
    return this.prisma.plan.update({
      where: { id },
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.plan.delete({ where: { id } });
  }
}
