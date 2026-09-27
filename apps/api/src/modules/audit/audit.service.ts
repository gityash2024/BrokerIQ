import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAuditDto) {
    return this.prisma.auditLog.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.auditLog.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: true,
        organization: true,
      },
    });
    if (!log) {
      throw new NotFoundException(`Audit log ${id} not found`);
    }
    return log;
  }

  async update(id: string, dto: UpdateAuditDto) {
    return this.prisma.auditLog.update({
      where: { id },
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.auditLog.delete({ where: { id } });
  }
}
