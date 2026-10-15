import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { Roles } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { z } from 'zod';
const querySchema = z.object({
  search: z.string().max(200).optional(),
  sector: z.string().max(100).optional(),
  builder: z.string().max(200).optional(),
  category: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'UNCLASSIFIED']).optional(),
  provider: z.enum(['HARERA', 'GMDA_TCP', 'OSM']).optional(),
  mapped: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
@Roles('SUPER_ADMIN', 'BROKER_ADMIN')
@Controller('area-directory')
export class DirectoryController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async list(@Query(new ZodPipe(querySchema)) q: z.infer<typeof querySchema>) {
    const where = {
      city: 'Gurugram',
      ...(q.category ? { category: q.category } : {}),
      ...(q.provider ? { provider: q.provider } : {}),
      ...(q.sector ? { sector: { contains: q.sector, mode: 'insensitive' as const } } : {}),
      ...(q.builder ? { builderName: { contains: q.builder, mode: 'insensitive' as const } } : {}),
      ...(q.mapped === 'true' ? { latitude: { not: null }, longitude: { not: null } } : q.mapped === 'false' ? { latitude: null } : {}),
      ...(q.search
        ? {
            OR: ['name', 'address', 'builderName', 'registrationNumber', 'sector'].map((field) => ({
              [field]: { contains: q.search, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };
    const [items, total, all, mapped, latest] = await Promise.all([
      this.prisma.areaDirectoryEntry.findMany({
        where,
        select: {
          id: true,
          name: true,
          builderName: true,
          address: true,
          sector: true,
          category: true,
          categoryEvidence: true,
          registrationNumber: true,
          registrationStatus: true,
          registrationUntil: true,
          sourceUrl: true,
          sourceFetchedAt: true,
          provider: true,
          latitude: true,
          longitude: true,
          coordinateSource: true,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.areaDirectoryEntry.count({ where }),
      this.prisma.areaDirectoryEntry.count(),
      this.prisma.areaDirectoryEntry.count({ where: { latitude: { not: null }, longitude: { not: null } } }),
      this.prisma.areaDirectoryEntry.aggregate({ _max: { sourceFetchedAt: true } }),
    ]);
    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
      coverage: {
        sourceRecords: all,
        mappedRecords: mapped,
        lastFetchedAt: latest._max.sourceFetchedAt,
        scope: 'GURUGRAM_CITY',
        note: 'Source records may describe different registrations or phases of the same project. No guessed merging; missing coordinates stay off the map.',
      },
    };
  }
  @Get('map') async map(@Query(new ZodPipe(querySchema)) q: z.infer<typeof querySchema>) {
    const where = {
      city: 'Gurugram',
      latitude: { not: null },
      longitude: { not: null },
      ...(q.category ? { category: q.category } : {}),
      ...(q.provider ? { provider: q.provider } : {}),
      ...(q.builder ? { builderName: { contains: q.builder, mode: 'insensitive' as const } } : {}),
      ...(q.sector ? { sector: { contains: q.sector, mode: 'insensitive' as const } } : {}),
      ...(q.search
        ? {
            OR: ['name', 'builderName', 'address', 'sector', 'registrationNumber'].map((field) => ({
              [field]: { contains: q.search, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };
    const items = await this.prisma.areaDirectoryEntry.findMany({
      where,
      select: { id: true, name: true, sector: true, category: true, latitude: true, longitude: true, coordinateSource: true, sourceUrl: true, geometry: true },
      take: 5000,
    });
    return { items, total: await this.prisma.areaDirectoryEntry.count({ where }), limit: 5000 };
  }
  @Get(':id') async detail(@Param('id') id: string) {
    const item = await this.prisma.areaDirectoryEntry.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Directory entry not found');
    return item;
  }
}
