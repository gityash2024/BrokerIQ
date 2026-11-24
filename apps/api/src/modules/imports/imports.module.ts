import { ImportUploadsService } from './import-uploads.service';
import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { OcrService } from './ocr.service';
import { InventoryModule } from '../inventory/inventory.module';
import { PdfInventoryController } from './pdf-inventory.controller';
import { PdfInventoryService } from './pdf-inventory.service';
@Module({ imports: [InventoryModule], controllers: [ImportsController, PdfInventoryController], providers: [ImportsService, OcrService, ImportUploadsService, PdfInventoryService] })
export class ImportsModule {}
