import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ShareKitController } from './share-kit.controller';
import { ShareKitService } from './share-kit.service';

@Module({ controllers: [ListingsController, ShareKitController], providers: [ListingsService, ShareKitService], exports: [ListingsService, ShareKitService] })
export class ListingsModule {}
