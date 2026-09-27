import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@Injectable()
export class AutomationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAutomationDto) {
    return this.prisma.automationRule.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.automationRule.findMany();
  }

  async findOne(id: string) {
    return this.prisma.automationRule.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdateAutomationDto) {
    return this.prisma.automationRule.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.automationRule.delete({ where: { id } as any });
  }
}
