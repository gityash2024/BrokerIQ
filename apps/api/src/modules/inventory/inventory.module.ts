import { Module } from '@nestjs/common';
import { TodayController } from './today.controller';
import { BrokerRequirementsController } from './requirements.controller';
import { InventoryController } from './inventory.controller';
import { InventoryGalleryController, PublicInventoryGalleryController } from './inventory-gallery.controller';
import { InventoryAccessService } from './inventory-access.service';
import { InventoryOwnerController, OwnerPropertiesController } from './inventory-owner.controller';
import { InventoryOwnerService } from './inventory-owner.service';
import { InventoryService } from './inventory.service';
import { PrismaModule } from '../../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    InventoryOwnerController,
    OwnerPropertiesController,
    InventoryController,
    BrokerRequirementsController,
    TodayController,
    InventoryGalleryController,
    PublicInventoryGalleryController,
  ],
  providers: [InventoryService, InventoryAccessService, InventoryOwnerService],
  exports: [InventoryService],
})
export class InventoryModule {}
