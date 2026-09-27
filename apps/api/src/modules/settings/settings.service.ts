import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSettingsDto } from './dto/create-settings.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSettingsDto) {
    return this.prisma.systemSetting.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.systemSetting.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsert(key: string, value: any, group: any = 'GENERAL') {
    const existing = await this.prisma.systemSetting.findFirst({ where: { key } });
    if (existing) {
      return this.prisma.systemSetting.update({
        where: { id: existing.id },
        data: { value, group },
      });
    }
    return this.prisma.systemSetting.create({
      data: { key, value, group },
    });
  }

  async findOne(id: string) {
    return this.prisma.systemSetting.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdateSettingsDto) {
    return this.prisma.systemSetting.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.systemSetting.delete({ where: { id } as any });
  }

  // Feature Flags
  async getFeatureFlags() {
    return this.prisma.featureFlag.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateFeatureFlag(id: string, data: { isEnabled?: boolean; rolloutPercentage?: number }) {
    return this.prisma.featureFlag.update({
      where: { id },
      data,
    });
  }

  // Integrations
  async getIntegrations() {
    return this.prisma.integration.findMany({
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateIntegration(id: string, data: { status?: string; config?: any }) {
    return this.prisma.integration.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }
}
