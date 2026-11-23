import { BadRequestException, Controller, Get, Header, NotFoundException, Param, Post } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { clientPropertyShare, shareablePropertyPhotoUrls } from '@brokeriq/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { InventoryService } from './inventory.service';
import { PropertyPhotoService } from '../../core/media/property-photo.service';
import { env } from '../../config/env';

@Controller('inventory')
@Roles('SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT')
export class InventoryGalleryController {
  constructor(
    private readonly db: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  @Post(':id/photo-gallery')
  async create(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id=${id} FOR UPDATE`;
      const item = await this.inventory.get(id, user);
      if (!shareablePropertyPhotoUrls(item.photoUrls).length) throw new BadRequestException('This property has no photos available for sharing');
      const gallery = await tx.inventoryPhotoGallery.upsert({
        where: { inventoryId: id },
        update: {},
        create: { id: randomBytes(24).toString('hex'), inventoryId: id, createdById: user.id },
      });
      const url = env().PUBLIC_WEB_URL.replace(/\/$/, '') + '/photos/' + gallery.id;
      return { url, caption: clientPropertyShare(item) };
    });
  }
}

@Controller('public/photo-galleries')
export class PublicInventoryGalleryController {
  constructor(private readonly db: PrismaService, private readonly propertyPhotos: PropertyPhotoService) {}

  @Public()
  @Get(':token')
  @Header('Cache-Control', 'no-store')
  async get(@Param('token') token: string) {
    if (!/^[a-f0-9]{48}$/.test(token)) throw new NotFoundException('Photo gallery not found');
    const gallery = await this.db.inventoryPhotoGallery.findUnique({ where: { id: token }, include: { inventory: { include: { organization: { select: { name: true } } } } } });
    if (!gallery || gallery.inventory.deletedAt) throw new NotFoundException('Photo gallery not found');
    const photos = shareablePropertyPhotoUrls(this.propertyPhotos.inventory(gallery.inventory).photoUrls);
    if (!photos.length) throw new NotFoundException('This gallery no longer has photos');
    // Only the client-facing caption and approved public media cross this unauthenticated boundary.
    return {
      caption: clientPropertyShare({
        ...gallery.inventory,
        monthlyRent: gallery.inventory.monthlyRent == null ? null : Number(gallery.inventory.monthlyRent),
        totalSalePrice: gallery.inventory.totalSalePrice == null ? null : Number(gallery.inventory.totalSalePrice),
      }),
      photos,
    };
  }
}
