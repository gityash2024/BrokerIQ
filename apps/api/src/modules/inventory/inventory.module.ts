import { Module } from '@nestjs/common';
import { TodayController } from './today.controller';
import { BrokerRequirementsController } from './requirements.controller';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { PrismaModule } from '../../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, BrokerRequirementsController, TodayController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
