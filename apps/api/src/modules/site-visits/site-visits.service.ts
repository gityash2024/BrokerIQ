import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSiteVisitsDto } from './dto/create-site-visits.dto';
import { UpdateSiteVisitsDto } from './dto/update-site-visits.dto';

@Injectable()
export class SiteVisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSiteVisitsDto) {
    return this.prisma.siteVisit.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.siteVisit.findMany();
  }

  async findOne(id: string) {
    return this.prisma.siteVisit.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: UpdateSiteVisitsDto) {
    return this.prisma.siteVisit.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.siteVisit.delete({ where: { id } as any });
  }
}
