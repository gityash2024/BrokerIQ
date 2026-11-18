import { Module } from '@nestjs/common';
import { TodayController } from './today.controller';
import { BrokerRequirementsController } from './requirements.controller';
import { InventoryController } from './inventory.controller';
import { InventoryGalleryController, PublicInventoryGalleryController } from './inventory-gallery.controller';
import { InventoryAccessService } from './inventory-access.service';
import { InventoryService } from './inventory.service';
import { PrismaModule } from '../../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, BrokerRequirementsController, TodayController, InventoryGalleryController, PublicInventoryGalleryController],
  providers: [InventoryService, InventoryAccessService],
  exports: [InventoryService],
})
export class InventoryModule {}
